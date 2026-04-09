import { SearchRequest } from '@opensearch-project/opensearch/api/types';
import { JsonSchemaParser } from '@securustablets/libraries.json-schema/dist/src/JsonSchemaParser';
import { Logger } from '@securustablets/libraries.logging';
import { _ } from '@securustablets/libraries.utils';
import { Inject } from 'typescript-ioc';
import { ProductStatus } from '../controllers/models/Product';
import { Search } from '../controllers/models/Search';
import { DigestHelper } from '../lib/DigestHelper';
import { ProductType } from '../lib/models/ProductType';

enum OpenSearchMethod {
  Term = 'term',
  Terms = 'terms',
  Match = 'match',
  MultiMatch = 'multi_match',
}

interface OpenSearchClause {
  [key: string]: { [key: string]: any };
}

/**
 * This class is a helper that converts the Catalog.Search components into open search queries
 */
export class OpenSearchConverter {
  @Inject
  private logger: Logger;

  /**
   * This query will effectively filter by productTypeId and create an OR query that matches either the ruleIds or the current clauses
   * @param search
   * @param productTypeId
   */
  public convertRulesSearchToQuery(
    search: Search,
    isRequireAllClauses: boolean = false,
  ): SearchRequest {
    // If we're searching with empty clauses our should block will be empty so require no min_should_match
    let minShouldMatch = _.isEmpty(search.query.clauses) ? 0 : 1;

    // If our search must match all clauses (essentially an `AND` query) the minimum match should be equal
    // to the number of clauses in the query.
    if (isRequireAllClauses) {
      minShouldMatch = Object.keys(search.query.clauses).length;
    }

    return {
      query: {
        bool: {
          // remove inactive products
          filter: [
            { term: { 'status.keyword': ProductStatus.Active } },
            { term: { isBlocked: false } },
          ],
          // dynamic predicate block from `Search` argument
          should: [
            ..._.keys(search.query.clauses).map((field) =>
              this.getOpenSearchClause(
                OpenSearchMethod.Terms,
                field,
                search.query.clauses[field],
              ),
            ),
          ],
          minimum_should_match: minShouldMatch,
        },
      },
      ...this.getPaginationQueryParams(search),
    } as SearchRequest;
  }

  /**
   * Given a Catalog.Search query, translates it into an OpenSearch query
   * @param search
   * @param productType
   */
  public convertSearchToQuery(
    search: Search,
    productType: ProductType,
  ): SearchRequest {
    return {
      query: {
        bool: {
          // Note: enforce implements a "should" if this query implements "should" they would need to be merged
          ...(search.context?.enforce && this.getEnforceParams(search)),
          must: [
            // User supplied search criteria goes into the "must" query
            ...this.convertMustTerms(search),
          ],
          must_not: [],
        },
      },
      ...this.getPaginationQueryParams(search),
      sort: this.buildOrderBy(search, productType),
    } as SearchRequest;
  }

  private getPaginationQueryParams(search: Search): any {
    return {
      ...(search.pageSize && {
        // If there's no pageSize, pageNumber doesn't make sense
        size: search.pageSize,
        from: search.pageSize * (search.pageNumber || 0),
      }),
      ...(search.total && { track_total_hits: true }),
    };
  }

  /**
   * Used to detect "enforce: true" in the search and apply context and global filtering
   * @param search
   * @private
   */
  private getEnforceParams(search: Search): any {
    return {
      filter: [
        // Must pass basic availability
        { term: { 'status.keyword': ProductStatus.Active } },
        { range: { 'meta.startDate': { lte: 'now' } } },
        { range: { 'meta.endDate': { gte: 'now' } } },
        { term: { isBlocked: false } },
      ],
      should: [
        // Must be on a whitelist
        {
          terms: {
            'digest.whitelist.keyword': [
              search.context.siteId,
              search.context.customerId,
              DigestHelper.GLOBAL_CONTEXT,
            ].filter((i) => !!i),
          },
        },
        // Or context is productId and this product is included
        // OR must not be on a blacklist and must be available globally
        {
          bool: {
            must_not: {
              terms: {
                'digest.blacklist.keyword': [
                  search.context.siteId,
                  search.context.customerId,
                  DigestHelper.GLOBAL_CONTEXT,
                ].filter((i) => !!i),
              },
            },
            must: { term: { 'digest.availableGlobally': true } },
          },
        },
      ],
      minimum_should_match: 1,
    };
  }

  /**
   * Convert a Search.Query into a set of OpenSearch term(s) searches
   * @param search
   * @private
   */
  private convertMustTerms(search: Search): OpenSearchClause[] {
    if (
      _.isEmpty(search.query) &&
      _.isEmpty(search.match) &&
      !search.term &&
      !_.has(search, 'context.productId')
    ) {
      return [];
    }
    return [
      ...this.convertQuery(search),
      ...this.convertMatch(search),
      ...this.convertTerm(search),
      ...this.addSubscriptionProductId(search),
    ];
  }

  private addSubscriptionProductId(search: Search): OpenSearchClause[] {
    if (search.context?.productId) {
      return [
        this.getOpenSearchClause(
          OpenSearchMethod.Term,
          'digest.subscriptionProductIds',
          _.toNumber(search.context.productId),
        ),
      ];
    }
    return [];
  }

  /**
   * Convert a Search.Query into a set of OpenSearch term(s) clauses.
   *  Clauses are converted to terms searches
   *  e.g. query: {clauses: {'meta.name': ['foo'], 'meta.genres': ['Pop', 'World']}}
   *    is converted into: {term: {'meta.name': ['foo']}} and {terms: {'meta.genres': ['Pop', 'World']}}
   * @param search
   * @private
   *
   */
  private convertQuery(search: Search): OpenSearchClause[] {
    return _.keys(search.query?.clauses).map((field) =>
      this.getOpenSearchClause(
        OpenSearchMethod.Terms,
        field,
        search.query.clauses[field],
      ),
    );
  }

  /**
   * Convert a Search.Match into a set of OpenSearch term clauses
   * @param search
   * @private
   */
  private convertMatch(search: Search): OpenSearchClause[] {
    if (!search.match) {
      return [];
    }
    // Deep Flatten object into paths/values
    const pathArray = this.reducePathArray(search.match);
    // remove duplicate key/value matches
    return _.uniqWith(pathArray, _.isEqual);
  }

  /**
   * Given an object 'productMatch', deep traverses the object producing an array of term matches to exactly match the partial product
   * NOTE: This method does not support arrays of arrays (e.g. meta.foo = [[1,2],[3,4]]) and they will be ignored
   * @param productMatch
   * @param path
   * @param method
   * @private
   */
  private reducePathArray(
    productMatch: any,
    path: string = '',
    method: OpenSearchMethod = OpenSearchMethod.Term,
  ): OpenSearchClause[] {
    let pathArray: any[] = [];
    _.keys(productMatch).forEach((key) => {
      const value = productMatch[key];
      const newPath = path.length ? path + '.' + key : key;
      switch (typeof value) {
        case 'object':
          if (!_.isArray(value)) {
            // object
            pathArray = _.concat(
              pathArray,
              this.reducePathArray(value, newPath),
            );
            break;
          }
          if (typeof value[0] === 'object') {
            // array of objects
            value.forEach((arrayObject) => {
              pathArray = _.concat(
                pathArray,
                this.reducePathArray(
                  arrayObject,
                  newPath,
                  OpenSearchMethod.Match,
                ),
              );
            });
            break;
          }
          // array of scalars
          value.forEach((i) => {
            pathArray.push(this.getOpenSearchClause(method, newPath, i));
          });
          break;
        case 'string':
        case 'number':
        case 'boolean':
        default:
          pathArray.push(this.getOpenSearchClause(method, newPath, value));
      }
    });
    return pathArray;
  }

  /**
   * Convert a Search.Term into a OpenSearch match clause
   * @param search
   * @private
   */
  private convertTerm(search: Search): any[] {
    if (search.term) {
      return [
        {
          multi_match: {
            query: search.term,
            type: 'phrase',
            fields: [
              'meta.name',
              'meta.cast.name',
              'meta.directors',
              'meta.description',
            ],
          },
        },
      ];
    }
    return [];
  }

  /**
   * Convert a Search.OrderBy into a set of OpenSearch sort objects
   * @param search
   * @param productType
   * @private
   */
  private buildOrderBy(search: Search, productType: ProductType): any[] {
    const jsp = new JsonSchemaParser(productType.jsonSchema);
    const orderByArray = _.isEmpty(search.orderBy)
      ? []
      : _.castArray<{ [field: string]: 'ASC' | 'DESC' | 'EXPLICIT' }>(
          search.orderBy,
        );
    const orderBy: any[] = [];

    orderByArray.forEach((predicate) => {
      // eslint-disable-next-line prefer-const
      let [field, direction] = _.entries(predicate)[0];
      // This case is to handle mediastore sorting mediaSubscriptions by just 'meta.basePrice'
      // TODO: Remove when mediastore sends correct order by
      if (field === 'meta.basePrice') {
        field = `meta.basePrice.${productType.purchaseTypes[0]}`;
      }

      // NOTE: If the orderBy fieldPath is not valid for the model, swallow the error
      // This supports mediaStore calling multiple productType searches with the same OrderBys that might not match every productType
      // TODO: Remove the try/catch when mediastore is updated to correctly orderBy based on productType
      try {
        const schema = jsp.getSchema(field);
        const order =
          direction.toUpperCase().trim() === 'DESC' ? 'DESC' : 'ASC';
        // check non-date fields to see if they're strings
        if (!field.toLowerCase().includes('date')) {
          // if the type of the values is 'string' then we need to append keyword
          if (
            schema.type === 'string' ||
            (schema.type === 'array' && schema.items.type === 'string')
          ) {
            field = `${field}.keyword`;
          }
        }
        orderBy.push({ [field]: { order, missing: '_last' } });
      } catch (error) {
        this.logger.info(
          `OrderBy [${field}] not valid for ${productType.productTypeId}, skipping`,
        );
      }
    });

    orderBy.push({
      ['digest.sales.totalSales']: { order: 'DESC', missing: '_last' },
    });

    return orderBy;
  }

  /**
   * Builds an OpenSearchMethod from the supplied values
   *  Decorates the fieldPath with 'keyword' if the value is a string
   * @param method OpenSearchMethod
   * @param field FieldPath '.' separated object reference
   * @param value scalar or array of scalar to match
   * @private
   */
  private getOpenSearchClause(
    method: OpenSearchMethod,
    field: string,
    value: any,
  ): any {
    const testValue = _.castArray(value)[0];
    // OpenSearch can sometimes fuzzy search a number field (maybe because they're defined as floats?)
    // This causes undesirable behavior on productId searches. Override to _id to enforce a single match on document._id
    if (field === 'productId') {
      field = '_id';
    }
    // if the values are string, append keyword to the field
    if (typeof testValue === 'string') {
      field = field + '.keyword';
    }
    return { [method]: { [field]: value } };
  }
}

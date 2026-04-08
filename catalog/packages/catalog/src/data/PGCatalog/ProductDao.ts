import { pga } from '@securustablets/libraries.audit-history';
import { Csi, MethodCache } from '@securustablets/libraries.cache';
import { SecurityContextManager } from '@securustablets/libraries.httpsecurity';
import { Schema } from '@securustablets/libraries.json-schema';
import { JsonSchemaParser } from '@securustablets/libraries.json-schema/dist/src/JsonSchemaParser';
import { SpLite } from '@securustablets/libraries.json-schema/dist/src/models/SpLite';
import { Logger } from '@securustablets/libraries.logging';
import {
  FindOneOptions,
  FindOptions,
  PostgresDao,
} from '@securustablets/libraries.postgres';
import { PaginatedFind } from '@securustablets/libraries.postgres/dist/src/PaginatedFind';
import { SearchParameters } from '@securustablets/libraries.postgres/dist/src/models/SearchParameters';
import { _ } from '@securustablets/libraries.utils';
import * as moment from 'moment';
import { Exception } from 'securus.tablets.libraries.exceptions';
import { Container, Inject } from 'typescript-ioc';
import * as util from 'util';
import { Context } from 'vm';
import {
  Availability,
  AvailabilityUpdatedClauses,
} from '../../controllers/models/AvailabilityCheck';
import { BlockActionType } from '../../controllers/models/BlockAction';
import {
  Product,
  ProductStatus,
  ProductTypeIds,
  ThumbnailApprovedStatus,
} from '../../controllers/models/Product';
import { RuleType } from '../../controllers/models/Rule';
import {
  Match,
  OrderBy,
  QueryArgs,
  Search,
} from '../../controllers/models/Search';
import { AuditContext } from '../../lib/models/AuditContext';
import { Paginated } from '../../lib/models/Paginated';
import { AppConfig } from '../../utils/AppConfig';
import {
  AvailabilityCheckKey,
  AvailabilityConverter,
} from '../AvailabilityConverter';
import { BatchManager } from '../BatchManager';
import { ClauseConverter, UpdatedSearchClauses } from '../ClauseConverter';
import { ProductTypeDao } from './ProductTypeDao';
import { RuleDao } from './RuleDao';

export class ProductDao extends PostgresDao<Product> {
  private static readonly NON_DOCUMENT_FIELDS = [
    'cdate',
    'udate',
    'version',
    'product_id',
  ];
  private static readonly BTREE_INDEXED_DATES_FIELDS = [
    'meta.startdate',
    'meta.year',
  ];

  protected pga = pga<AuditContext, Product>(this);

  private defaultCreate = this.pga.create();

  private _find = this.pga.find();
  public findByQueryString = this.pga.findByQueryString();
  public _findOne = this.pga.findOne();
  private _findOneOrFail = this.pga.findOneOrFail();
  public update = this.pga.update();
  public updateAndRetrieve = this.pga.updateAndRetrieve();
  public delete = this.pga.delete();
  public push = this.pga.push();

  protected get noSql(): boolean {
    return true;
  }

  @Inject
  private ruleDao!: RuleDao;

  @Inject
  private productTypeDao!: ProductTypeDao;

  @Inject
  private availabilityConverter!: AvailabilityConverter;

  @Inject
  private clauseConverter!: ClauseConverter;

  @Inject
  private logger!: Logger;

  private _schema: Schema = super.schema;

  protected get schema(): Schema {
    return this._schema;
  }

  // TODO: add schema setter to PostgresDao
  protected set schema(schema: Schema) {
    this._schema = schema;
  }

  public find(
    options: FindOptions<Product, number> & { total: true },
  ): Promise<[Product[], number]>;
  public find(options?: FindOptions<Product, number>): Promise<Product[]>;
  @MethodCache(Csi.Tier3, {
    secondsToLive: Container.get(AppConfig).cache.ttlLong,
    bypass: () =>
      _.isUndefined(
        Container.get(SecurityContextManager).securityContext?.inmateJwt,
      ),
  })
  public find(
    options?: FindOptions<Product, number>,
  ): Promise<Product[] | [Product[], number]> {
    return this._find(options);
  }

  public async findOneByVendorProductId(
    vendorProductId: string,
    vendorName: string,
    productTypeId: string,
  ): Promise<Product> {
    return await this.findOne({
      customClauses: [
        {
          clause: `document->'source'->>'vendorProductId' = $1`,
          params: [vendorProductId],
        },
        {
          clause: `document->'source'->>'vendorName' = $1`,
          params: [vendorName],
        },
        {
          clause: `document->'source'->>'productTypeId' = $1`,
          params: [productTypeId],
        },
      ],
    });
  }

  public async getSearchFromQueryString(
    query: SearchParameters,
  ): Promise<Search> {
    this.schema = query.productTypeId
      ? await this.getSchema(query.productTypeId)
      : super.schema;
    const findOptions = this.buildPaginationOptions(query);
    return {
      match: _.merge(findOptions.contains?.document, findOptions.by),
      context: {
        enforce: query.enforce !== 'false',
        customerId: query.customerId,
        siteId: query.siteId,
      },
      term: query.term,
      total: findOptions.total,
      pageSize: findOptions.pageSize,
      pageNumber: findOptions.pageNumber,
      orderBy: findOptions.orderBy,
    };
  }

  // NOTE: This is here for backwards compatibility with tests only.
  // Many of the tests reach directly to the dao and would require hefty refactoring to handle a full model
  public async create(model: Product, context: AuditContext): Promise<number> {
    return (await this.createAndRetrieve(model, context)).productId;
  }

  public async createAndRetrieve(
    model: Product,
    context: AuditContext,
  ): Promise<Product> {
    try {
      // oh... this is that jank that sticks the productId in the document... Still need to find out why that is happening...
      model[this.modelId] = await this.defaultCreate(
        _.omit(model, this.modelId) as Product,
        context,
      );
      model = await this.updateAndRetrieve(model.productId, model, context);
    } catch (e) {
      if (_.get(e, 'code') === '23505') {
        let description;
        if (_.get(e, 'constraint') === 'product_group_idx') {
          description = {
            errors: ['The vendor product ID already exist in this vendor'],
          };
        }
        throw Exception.Conflict(description);
      } else {
        throw Exception.InternalError(e);
      }
    }
    return model;
  }

  @MethodCache(Csi.Tier3, {
    secondsToLive: Container.get(AppConfig).cache.ttlLong,
    bypass: () =>
      _.isUndefined(
        Container.get(SecurityContextManager).securityContext?.inmateJwt,
      ),
  })
  public async search(
    search: _.Omit<Search, 'query'>,
  ): Promise<Paginated<Product>> {
    const result = await this.searchRaw(search);
    return {
      ...result,
      data: result.data.map((row) => this.convertFrom(row)),
    };
  }

  /**
   * This method should go away when [TP-7720]{@link https://jira.dal.securustech.net/browse/TP-7720} is completed.
   * The private _findOne should have the leading underscore removed and made public
   *
   * @param options FindOneOptions<Product, number>
   * @returns Promise<Product>
   */
  public async findOne(
    options: FindOneOptions<Product, number>,
  ): Promise<Product> {
    if (_.isObject(options)) {
      options = {
        ...options,
        ...(options.contains && {
          contains: { document: this.convertTo(options.contains).document },
        }),
      };
      return (await this.find(options))[0];
    } else {
      return this._findOne(options);
    }
  }

  /**
   * This method should go away when [TP-7720]{@link https://jira.dal.securustech.net/browse/TP-7720} is completed.
   * The private _findOneOrFail should have the leading underscore removed and made public
   *
   * @param options FindOneOptions<Product, number>
   * @returns Promise<Product>
   */
  public async findOneOrFail(
    options: FindOneOptions<Product, number>,
  ): Promise<Product> {
    if (_.isObject(options)) {
      options = {
        ...options,
        ...(options.contains && {
          contains: { document: this.convertTo(options.contains).document },
        }),
      };
      const products = await this.find(options);
      if (products.length < 1) {
        throw Exception.NotFound({
          errors: `No product found matching ${util.inspect(options)}`,
        });
      }
      return products[0];
    } else {
      return this._findOneOrFail(options);
    }
  }

  public async findProductAvailabilityOrFail(
    productId: number,
    context?: Context,
  ): Promise<Availability> {
    const row = (await this.searchRaw({ match: { productId }, context }))
      .data[0];
    if (!row) {
      throw Exception.NotFound({
        errors: `No Product found matching ${util.inspect({ productId })}`,
      });
    }
    return this.availabilityConverter.convertFrom(row);
  }

  @MethodCache(Csi.Tier3, {
    secondsToLive: Container.get(AppConfig).cache.ttlLong,
    bypass: () =>
      _.isUndefined(
        Container.get(SecurityContextManager).securityContext?.inmateJwt,
      ),
  })
  public async findDescendantProductIds(
    productIds: number | number[],
  ): Promise<number[]> {
    if (!_.isArray(productIds)) {
      productIds = [productIds];
    }

    const results = await this.query(
      `SELECT document->'childProductIds' as child_product_ids FROM product WHERE product_id = ANY($1)`,
      [productIds],
    );

    let descendantProductIds = _.filter(
      _.uniq(_.flatMap(results.rows, 'childProductIds').sort((a, b) => a - b)),
      (a) => !_.isNull(a),
    );

    if (!_.isEmpty(descendantProductIds)) {
      descendantProductIds =
        await this.findDescendantProductIds(descendantProductIds);
    }

    return productIds.concat(descendantProductIds).sort((a, b) => a - b);
  }

  private async searchRaw(
    search: _.Omit<Search, 'query'>,
  ): Promise<Paginated<any>> {
    search = _.merge(
      {
        term: '',
        match: {},
        context: { enforce: false },
        pageNumber: 0,
        pageSize: 25,
        orderBy: {},
        total: false,
      },
      search,
    );

    const [rows, total] = await this.searchAndApplyRules(search);

    return {
      data: rows,
      total,
      pageSize: search.pageSize,
      pageNumber: search.pageNumber,
    };
  }

  private _enforceGlobalAvailability(context: Context): boolean {
    return !(
      context.enforce ||
      context.customerId ||
      context.siteId ||
      !context.productId
    );
  }
  /**
   * Returns list of products with (1) rules applied (2) availability details, and (3) a total count of search results (if total:true is specified).
   */
  private async searchAndApplyRules({
    term,
    match,
    context,
    pageNumber,
    pageSize,
    orderBy,
    total,
  }: _.Omit<Search, 'query'>): Promise<[any[], number | undefined]> {
    const matchValue = _.isEmpty(match) ? [] : _.castArray(match);
    const ids = _.chain(matchValue)
      .sortBy('productId')
      .map((el) => (el as any).productId)
      .filter((el) => !!el)
      .uniqBy((el) => el)
      .value();
    const productTypeIds: string[] = _.chain(matchValue)
      .map((el) => (el as any).productTypeId)
      .filter((el) => !!el)
      .uniqBy((el) => el)
      .value();

    // we're still going to support all search for rear cases - none or more then 1 productTypeId provided, and there is no specific ordering required
    let useUpdatedSearch = false;
    const orderByArray = _.isEmpty(orderBy)
      ? []
      : _.castArray<{ [field: string]: 'ASC' | 'DESC' | 'EXPLICIT' }>(orderBy);

    if (
      orderByArray.length > 0 ||
      productTypeIds.length === 1 ||
      ids.length !== 0
    ) {
      if (
        orderByArray.length > 0 &&
        productTypeIds.length === 0 &&
        ids.length === 0
      ) {
        // only order by is part of the request and no ProductTypeId or the ProductIds are part of the requests then throw an error
        const errors = `Order By can only be used in combination with either productTypeId or productId, match - ${JSON.stringify(match)}, orderBy - ${JSON.stringify(orderBy)}`;
        this.logger.error(errors);
        throw Exception.InvalidData({ errors });
      }
      useUpdatedSearch = true;
    }

    // TODO: As new product rule types are added, this statement must be updated... :/
    const productRuleSets = await this.ruleDao.findSetsByContext(context, [
      RuleType.ProductAvailability,
      RuleType.ProductCache,
      RuleType.ProductSubscriptionAvailability,
    ]);

    const productRuleIds = _.chain(productRuleSets)
      .values()
      .flatten()
      .map('ruleId')
      .value();

    const whitelistProductAvailabilityRules = _.chain(
      productRuleSets[RuleType.ProductAvailability],
    )
      .filter({ action: { available: true } })
      .map('ruleId')
      .value();
    const blacklistProductAvailabilityRules = _.chain(
      productRuleSets[RuleType.ProductAvailability],
    )
      .filter({ action: { available: false } })
      .map('ruleId')
      .value();

    const subscriptionSearch = !!context.productId;
    const productRuleIdsForBlackWhiteSubscriptionClauses = subscriptionSearch
      ? productRuleSets[RuleType.ProductSubscriptionAvailability]
      : [];

    const whitelistedSubscriptionProductAvailabilityRuleIds = _.chain(
      productRuleIdsForBlackWhiteSubscriptionClauses,
    )
      .filter(
        (rule) =>
          rule.action.available &&
          rule.productId.toString() === context.productId,
      )
      .map('ruleId')
      .value();

    const blacklistSubscriptionProductAvailabilityRules = _.chain(
      productRuleIdsForBlackWhiteSubscriptionClauses,
    )
      .filter(
        (rule) =>
          !rule.action.available &&
          rule.productId.toString() === context.productId,
      )
      .map('ruleId')
      .value();

    const [
      whitelistClauses,
      blacklistClauses,
      whitelistSubscriptionClauses,
      blacklistSubscriptionClauses,
    ] = await Promise.all([
      this.ruleDao.aggregateClauses(whitelistProductAvailabilityRules),
      this.ruleDao.aggregateClauses(blacklistProductAvailabilityRules),
      this.ruleDao.aggregateClauses(
        whitelistedSubscriptionProductAvailabilityRuleIds,
      ),
      this.ruleDao.aggregateClauses(
        blacklistSubscriptionProductAvailabilityRules,
      ),
    ]);

    const productTypeClauses = _.chain(
      await this.productTypeDao.findByContext(context),
    )
      .filter({ available: true })
      .map((productType) => productType.productTypeId)
      .value();
    const enforceGlobalAvailability = this._enforceGlobalAvailability(context);

    let args: QueryArgs = {
      term: { idx: 1, value: term },
      productTypeClauses: { idx: 2, value: productTypeClauses },
      whitelistClauses: { idx: 3, value: whitelistClauses },
      blacklistClauses: { idx: 4, value: blacklistClauses },
      enforce: { idx: 5, value: context.enforce },
      productRuleIds: { idx: 6, value: productRuleIds },
      total: { idx: 7, value: total },
      limit: { idx: 8, value: pageSize },
      offset: { idx: 9, value: pageSize * pageNumber },
      whitelistSubscriptionClauses: {
        idx: 10,
        value: whitelistSubscriptionClauses,
      },
      enforceGlobalAvailability: { idx: 11, value: enforceGlobalAvailability },
      subscriptionSearch: { idx: 12, value: subscriptionSearch },
      blacklistSubscriptionClauses: {
        idx: 13,
        value: blacklistSubscriptionClauses,
      },
    };

    let documentMatchingBlock = '';
    let orderByBlock = '';
    let initialWhereBlock = '';
    if (!useUpdatedSearch) {
      args = {
        ...args,
        match: {
          idx: Object.keys(args).length + 1,
          value: _.isEmpty(match) ? [] : _.castArray(match),
        },
      };

      documentMatchingBlock = `-- Only attempt to match if we were actually given something to match with.
                AND (cardinality($${args.match.idx}::jsonb[]) = 0 OR lower(document::text)::jsonb @> ANY(lower($${args.match.idx}::jsonb[]::text)::jsonb[]))
            `;
      orderByBlock = `-- no order by since we're using gin index`;
    } else {
      // get request for product id, all other request for new search should have productId in the params
      if (ids.length > 0 && productTypeIds.length === 0) {
        args = {
          ...args,
          productIds: { idx: Object.keys(args).length + 1, value: [ids] },
        };

        initialWhereBlock = `AND product_id = ANY($${args.productIds.idx})`;
      } else {
        const productTypeId = productTypeIds[0];
        const [whereBlock, whereBlockIncluded, whereUpdatedArgs] =
          this.createInitialWhereBlock(ids, productTypeId, args);

        initialWhereBlock = whereBlock as string;
        args = { ...(whereUpdatedArgs as QueryArgs) };

        const [
          documentMatchingBlockString,
          orderByBlockString,
          mainUpdatedArgs,
        ] = await this.createMainMatchAndOrderBy(
          matchValue,
          orderByArray,
          productTypeId,
          whereBlockIncluded as string[],
          args,
        );

        args = { ...(mainUpdatedArgs as QueryArgs) };
        documentMatchingBlock = documentMatchingBlockString as string;
        orderByBlock = orderByBlockString as string;
      }
    }
    const matchBlock = `
            -- Enforce (or not) Availability
            ((NOT $${args.enforce.idx} AND NOT $${args.enforceGlobalAvailability.idx}) OR available)

            -- limiting our query by id or productTypeId
            ${initialWhereBlock}

            -- Document matching by other fields
            ${documentMatchingBlock}

            -- Intelligent search based on a user-provided term.
            AND (
                -- Don't perform any queries if we didn't actually get a search term.
                $${args.term.idx} = ''

                -- Trigram matching
                OR (document->'meta'->>'name') % $${args.term.idx}

                -- Full text search
                OR tsv @@ plainto_tsquery('english', $${args.term.idx})
            )`;

    let availabilityQuery = this.getAvailabilityQuery(args);
    if (subscriptionSearch) {
      const [argsModified, allUpdatedClauses] =
        await this.getOptimizedAvailabilityArgs(args);
      args = { ...args, ...(argsModified as QueryArgs) };
      availabilityQuery = this.getOptimizedAvailabilityQuery(
        args,
        allUpdatedClauses,
      );
    }

    const finalQuery = `
        SELECT
            total,
            product_id,
            version,
            cdate,
            udate,
            jsonb_merge(document, action) as document,
            coalesce(rule_ids, '{}') as rule_ids,
                -- Effective availability result true or false
            available,
            jsonb_build_object(
                '${AvailabilityCheckKey.ActiveStatus}', active_status,
                '${AvailabilityCheckKey.ActiveDateRange}', active_date_range,
                '${AvailabilityCheckKey.ProductTypeAvailabile}', available_product_type,
                '${AvailabilityCheckKey.Blacklisted}', blacklisted,
                '${AvailabilityCheckKey.Whitelisted}', whitelisted
            ) as availability_checks
        FROM (
            SELECT
                *,
                (CASE WHEN $${args.total.idx} THEN (SELECT count(*) FROM (${availabilityQuery}) availability WHERE ${matchBlock}) ELSE NULL END) as total
            FROM (${availabilityQuery}) availability

        WHERE
            ${matchBlock}
        -- order by
            ${orderByBlock}
        -- Pagination
        LIMIT $${args.limit.idx} OFFSET $${args.offset.idx}

        -- Apply rules _after_ the search is conducted
        ) product LEFT JOIN LATERAL (

            -- Build up all rule actions into one final 'action' to be applied.
            SELECT uniq(array_agg(rule_id)) as rule_ids, jsonb_object_agg(key, value
                -- Sort rules according to the order in which they should be applied.
                -- First, sort by availability, then sort by price (yes, the price sort is a hack)
                ORDER BY jsonb_build_object(key, value)->>'available' DESC
            ) as action

            -- Find all rules that are relevant to the product in question.
            FROM (
                SELECT rule_id, json.key, json.value FROM rule, jsonb_each(rule.action) as json
                WHERE rule_id = ANY($${args.productRuleIds.idx})
                AND product.document @> jsonb_build_object('productTypeId', rule.product_type_id)
                AND (product.document @> ANY(rule.clauses) OR cardinality(rule.clauses) = 0)
            ) actions
        ) action_agg on true`;

    const result = await this.query(
      finalQuery,
      _.map(_.sortBy(_.mapValues(args), 'idx'), 'value'),
    );

    return [
      result.rows,
      total ? _.toNumber(_.get(result, 'rows[0].total', 0)) : undefined,
    ];
  }

  // :/
  private buildOrderBy(orderByArray: OrderBy[]) {
    if (orderByArray.length === 0) {
      return '';
    }
    return (
      orderByArray
        .map((predicate) => {
          const [field, direction] = _.entries(predicate)[0];
          // TODO: This was lifted straight from libraries.postgres.
          // Should be good enough to prevent SQL injection... -Connor Lirot ft. James Brooks
          const isDereferenced = new RegExp(/->/).test(field);
          if (!new RegExp(/^[A-Za-z_.]*$/).test(field) && !isDereferenced) {
            throw Exception.InvalidData({
              errors: `Invalid sort specified: ${JSON.stringify({ [field]: direction })}`,
            });
          }
          if (ProductDao.NON_DOCUMENT_FIELDS.includes(field)) {
            return `${_.snakeCase(field)} ${direction}`;
          }
          // Prevents adding another document-> if one already exists
          let trueField = isDereferenced
            ? field
            : this.parseJsonPropertyToJsonbSearch('document', field, false);

          if (
            ProductDao.BTREE_INDEXED_DATES_FIELDS.includes(field.toLowerCase())
          ) {
            trueField = `f_cast_isots(${trueField})`; // use function to be able to use btree index for ordering
          }

          let noNullDirection = 'ASC';
          if (direction.trim() === 'DESC') {
            noNullDirection = 'DESC NULLS LAST';
          }

          return `${trueField} ${noNullDirection}`;
        })
        .join(', ') + ', '
    ); // append trailing comma;
  }

  public findDistinctForSchema(
    productTypeId: string,
    schema: SpLite,
  ): Promise<any[]> {
    /**
     * TODO?: This does not support tuples as represented by `purchaseTypes: ['rental', 'purchase']`
     * You cannot get a distinct set of values from the above, the query will reference specific indexes and not an array
     * This is technically according to spec, we're doing it funny in our templates
     */
    let queryString = '';
    schema.typedPath.split('.').forEach((p) => {
      const typing = p.split('|');
      if (typing[0] === 'SCHEMA') {
        queryString = `document`;
      } else if (typing[1] === 'array') {
        queryString = `jsonb_array_elements(${queryString}->'${typing[0]}')`;
      } else {
        queryString = `${queryString}->'${typing[0]}'`;
      }
    });
    queryString = `SELECT DISTINCT(${queryString}) as value_list FROM product WHERE document @> '{"productTypeId": "${productTypeId}"}'`;
    return this.query(queryString).then((i) => _.map(i.rows, 'valueList'));
  }

  public async updateProductThumbnailStatus(
    productIds: number[],
    status: ThumbnailApprovedStatus,
    securityContext: AuditContext,
    thumbnail?: string,
  ): Promise<Product[]> {
    securityContext = { ...securityContext, reason: 'Update thumbnail status' };
    const query = `
            WITH audit AS
                (UPDATE product SET document = jsonb_set(jsonb_set(document, '{meta, thumbnail}', $2), '{meta, thumbnailApproved}', $1)
                    WHERE product_id = ANY($3)
                        RETURNING *
                )
                INSERT INTO audit_history(action, entity_type, entity_id, context, document)
                SELECT 'UPDATE','product', audit.product_id, $4, row_to_json(audit) 
                FROM audit
                RETURNING document;
        `;
    const result = await this.write(query, [
      `"${status}"`,
      `"${thumbnail}"`,
      productIds,
      securityContext,
    ]);
    // it already has all property of product, so no need to convert
    return result.rows.map((row) => this.convertFrom(row.document));
  }

  public stripReservedColumns(model: Partial<Product>): Partial<Product> {
    return _.omit(model, ['cdate', 'udate']);
  }

  public convertFrom(row: any): Product {
    return {
      ...row.document,
      productId: row.productId ?? row.product_id,
      cdate: moment(row.cdate).utc().toISOString(),
      udate: moment(row.udate).utc().toISOString(),
      version: row.version,
      ...(row.available && { available: row.available }),
    };
  }

  public convertTo(model: Partial<Product>): any {
    const document = _.omit(model, ProductDao.NON_DOCUMENT_FIELDS);
    return {
      ...(_.get(model, this.modelId) && {
        [this.tableId]: _.get(model, this.modelId),
      }), // {product_id: productId}
      ...(_.get(model, 'cdate') && { cdate: _.get(model, 'cdate') }),
      ...(_.get(model, 'udate') && { udate: _.get(model, 'udate') }),
      ...(_.get(model, 'version') && { version: _.get(model, 'version') }),
      ...(!_.isEmpty(document) && { document }),
    };
  }

  public buildPaginationOptions(query: SearchParameters) {
    return PaginatedFind.parseQueryString<Product, number>(this, { query });
  }

  public async convertRules(
    rules: Array<{ productTypeId: string; [key: string]: any }>,
    args: QueryArgs,
  ) {
    let finalSearchString = '';
    for (const rule of rules) {
      const jsonSchema = await this.getSchema(rule.productTypeId);
      const matchData = await this.clauseConverter.convertToWhereClauses(
        [rule],
        jsonSchema,
        rule.productTypeId,
      );
      const [updatedMatchingBlock, argsUpdated] = this.convertToWhereString(
        matchData,
        args,
      );

      // first iteration
      if (!finalSearchString) {
        finalSearchString = `(${updatedMatchingBlock})`;
      } else {
        finalSearchString = `${finalSearchString} OR (${updatedMatchingBlock})`;
      }
      args = { ...argsUpdated };
    }
    if (finalSearchString) {
      finalSearchString = `AND ${finalSearchString}`;
    }
    return [args, finalSearchString];
  }

  @MethodCache(Csi.Tier1, {
    secondsToLive: Container.get(AppConfig).cache.ttlLong,
  })
  private async getSchema(productTypeId: string): Promise<Schema> {
    return JsonSchemaParser.getSchemaForInterface(_.upperFirst(productTypeId));
  }

  private getAvailabilityQuery(args: QueryArgs) {
    return `
            SELECT *,
            active_status
            AND active_date_range
            AND (available_product_type OR $${args.enforceGlobalAvailability.idx})
            AND NOT is_blocked
            AND ((NOT blacklisted OR whitelisted)
                AND ((whitelisted_subscription AND NOT blacklisted_subscription) OR NOT $${args.subscriptionSearch.idx}))
            as available
        FROM (
            SELECT
                *,
                -- Availability
                product.document->>'status' = '${ProductStatus.Active}' as active_status,
                coalesce(product.document->>'isBlocked', 'false') = 'true' as is_blocked,
                (CASE WHEN
                    coalesce(product.document->'meta'->>'endDate', 'infinity')::timestamp > coalesce(product.document->'meta'->>'startDate', '-infinity')::timestamp
                THEN
                tsrange(
                    coalesce(product.document->'meta'->>'startDate', '-infinity')::timestamp,
                    coalesce(product.document->'meta'->>'endDate', 'infinity')::timestamp) @> timezone('UTC', NOW())
                ELSE false
                END)
                    as active_date_range,
                    product.document->>'productTypeId' = ANY($${args.productTypeClauses.idx})
                    as available_product_type,
                (cardinality($${args.blacklistClauses.idx}::jsonb[]) > 0 AND product.document @> ANY($${args.blacklistClauses.idx}::jsonb[]))
                    as blacklisted,
                (cardinality($${args.whitelistClauses.idx}::jsonb[]) > 0 AND product.document @> ANY($${args.whitelistClauses.idx}::jsonb[]))
                    as whitelisted,
                (cardinality($${args.whitelistSubscriptionClauses.idx}::jsonb[]) > 0 AND product.document @> ANY($${args.whitelistSubscriptionClauses.idx}::jsonb[]))
                    as whitelisted_subscription,
                (cardinality($${args.blacklistSubscriptionClauses.idx}::jsonb[]) > 0 AND product.document @> ANY($${args.blacklistSubscriptionClauses.idx}::jsonb[]))
                    as blacklisted_subscription
            FROM product
        ) availability_checks`;
  }

  private async getOptimizedAvailabilityArgs(
    args: QueryArgs,
  ): Promise<[QueryArgs, AvailabilityUpdatedClauses]> {
    // string contained AND if there is something in the string
    const [blacklistClausesArgs, blacklistClausesWhereBlock] =
      await this.convertRules(args.blacklistClauses.value as any[], args);
    const [whitelistClausesArgs, whitelistClausesWhereBlock] =
      await this.convertRules(
        args.whitelistClauses.value as any[],
        blacklistClausesArgs as QueryArgs,
      );
    const [whitelistSubscriptionArgs, whitelistSubscriptionClausesWhereBlock] =
      await this.convertRules(
        args.whitelistSubscriptionClauses.value as any[],
        whitelistClausesArgs as QueryArgs,
      );
    const [blacklistSubscriptionArgs, blacklistSubscriptionClausesWhereBlock] =
      await this.convertRules(
        args.blacklistSubscriptionClauses.value as any[],
        whitelistSubscriptionArgs as QueryArgs,
      );

    return [
      blacklistSubscriptionArgs as QueryArgs,
      {
        blacklistClausesWhereBlock,
        whitelistClausesWhereBlock,
        whitelistSubscriptionClausesWhereBlock,
        blacklistSubscriptionClausesWhereBlock,
      } as AvailabilityUpdatedClauses,
    ];
  }

  private getOptimizedAvailabilityQuery(
    args: QueryArgs,
    allUpdatedClauses: AvailabilityUpdatedClauses,
  ) {
    return `
            SELECT *,
            active_status
            AND active_date_range
            AND (available_product_type OR $${args.enforceGlobalAvailability.idx})
            AND NOT is_blocked
            AND ((NOT blacklisted OR whitelisted)
                AND ((whitelisted_subscription AND NOT blacklisted_subscription) OR NOT $${args.subscriptionSearch.idx}))
            as available
        FROM (
            SELECT
                *,
                -- Availability
                product.document->>'status' = '${ProductStatus.Active}' as active_status,
                coalesce(product.document->>'isBlocked', 'false') = 'true' as is_blocked,
                (CASE WHEN
                    coalesce(product.document->'meta'->>'endDate', 'infinity')::timestamp > coalesce(product.document->'meta'->>'startDate', '-infinity')::timestamp
                THEN
                tsrange(
                    coalesce(product.document->'meta'->>'startDate', '-infinity')::timestamp,
                    coalesce(product.document->'meta'->>'endDate', 'infinity')::timestamp) @> timezone('UTC', NOW())
                ELSE false
                END)
                    as active_date_range,
                    product.document->>'productTypeId' = ANY($${args.productTypeClauses.idx})
                    as available_product_type,
                (cardinality($${args.blacklistClauses.idx}::jsonb[]) > 0 ${allUpdatedClauses.blacklistClausesWhereBlock})
                    as blacklisted,
                (cardinality($${args.whitelistClauses.idx}::jsonb[]) > 0 ${allUpdatedClauses.whitelistClausesWhereBlock})
                    as whitelisted,
                (cardinality($${args.whitelistSubscriptionClauses.idx}::jsonb[]) > 0 ${allUpdatedClauses.whitelistSubscriptionClausesWhereBlock})
                    as whitelisted_subscription,
                (cardinality($${args.blacklistSubscriptionClauses.idx}::jsonb[]) > 0 ${allUpdatedClauses.blacklistSubscriptionClausesWhereBlock})
                    as blacklisted_subscription
            FROM product
        ) availability_checks`;
  }

  /**
   *  This method parse 'meta.name' string to meta->>'name'  search block
   * @param jsonbColumnName name of jsonb column 'document' for product table
   * @param propertyName string, property name dot separated like 'meta.name'
   * @param isJsonbArray a boolean indicating whether this is an array
   * @returns Promise<Product>
   */
  private parseJsonPropertyToJsonbSearch(
    jsonbColumnName: string,
    propertyName: string,
    isJsonbArray: boolean,
  ): string {
    let finalWhereKey = `${jsonbColumnName}`;
    const keySplit = propertyName.split('.');
    if (keySplit.length === 1) {
      const operator = isJsonbArray ? '->' : '->>';
      finalWhereKey = `${finalWhereKey}${operator}'${propertyName}'`;
    } else {
      keySplit.forEach((value, index) => {
        if (index === keySplit.length - 1 && !isJsonbArray) {
          finalWhereKey = `${finalWhereKey}->>'${value}'`;
        } else {
          finalWhereKey = `${finalWhereKey}->'${value}'`;
        }
      });
    }
    return finalWhereKey;
  }

  /**
   * This method parse each clause and returns as a string that can be included in the where condition of the search query
   * e.g - clauses - [{isArray: [true], key: ['meta.rating'], value: [['PG']]}, {isArray: [false], key: ['source.vendorName'], value: ['swank']}] returns
   * AND document->'meta'->'rating' @> $15 AND document->'source'->>'vendorName' = ANY($16)
   * $15 and $16 are the the max numbers that would changed based on the array length of the args.
   */
  private convertToWhereString(
    clauses: UpdatedSearchClauses[],
    args: QueryArgs,
    initialWhereBlockIncluded?: string[],
  ): [string, object] {
    let finalString = '';
    const columnName = 'document';
    Object.entries(clauses).forEach(([, clause], index) => {
      if (!_.isEmpty(clause)) {
        const whereKey: string = clause.key[0];
        const whereValue = clause.value[0];
        const isArray: boolean = clause.isArray[0];

        if (
          !initialWhereBlockIncluded ||
          !initialWhereBlockIncluded.includes(whereKey)
        ) {
          // replace the dots with -> or ->> based on the lengths, single quotes and the column name - document at the front of all the clauses.
          const finalWhereKey = this.parseJsonPropertyToJsonbSearch(
            columnName,
            whereKey,
            isArray,
          );

          // will add AND to result string on return - so we can reuse this method for availability query
          let leadingAnd = '';
          if (finalString && index !== 0) {
            leadingAnd = 'AND';
          }
          const idx = Object.keys(args).length + 1;
          args[idx] = {
            idx,
            value: isArray ? JSON.stringify(whereValue) : whereValue,
          };
          const whereFieldStringToAppend = isArray
            ? ` ${leadingAnd} ${finalWhereKey} @> $${args[idx].idx} `
            : ` ${leadingAnd} ${finalWhereKey} = ANY($${args[idx].idx}) `;

          finalString = finalString + whereFieldStringToAppend;
        }
      }
    });

    return [finalString, args];
  }

  /**
   * this method will use productId or productTypeId as 1st filter in the main query
   * @param ids productIds if requested
   * @param productTypeId productTypeId always required
   * @param args Existing query arguments
   * @returns
   */
  private createInitialWhereBlock(
    ids: string[],
    productTypeId: string,
    args: QueryArgs,
  ) {
    let initialWhereBlock = '';
    const initialWhereBlockIncluded: string[] = [];
    if (ids.length > 0) {
      args = {
        ...args,
        productIds: { idx: Object.keys(args).length + 1, value: [ids] },
      };

      initialWhereBlock = `AND product_id = ANY($${args.productIds.idx})`;
      initialWhereBlockIncluded.push('product_id', 'productId');
    }

    args = {
      ...args,
      productTypeIds: {
        idx: Object.keys(args).length + 1,
        value: productTypeId,
      },
    };
    initialWhereBlock =
      initialWhereBlock +
      `AND document->>'productTypeId' = ($${args.productTypeIds.idx})`;
    initialWhereBlockIncluded.push('productTypeId');

    return [initialWhereBlock, initialWhereBlockIncluded, args];
  }

  private async createMainMatchAndOrderBy(
    matchValue: Match[],
    orderByArray: OrderBy[],
    productTypeId: string,
    whereBlockIncluded: string[],
    args: QueryArgs,
  ) {
    let documentMatchingBlock = '';
    const orderByBlock = `
        ORDER BY
            -- Order by user-specified fields.
            ${this.buildOrderBy(orderByArray)}

            -- Otherwise, order by search relevance.
            CASE WHEN $${args.term.idx} = '' THEN 0 ELSE
                similarity(document->'meta'->>'name', $${args.term.idx}) + ts_rank(tsv, plainto_tsquery('english', $${args.term.idx}), 32)
            END DESC,
            -- Always order by product_id so that pagination returns consistent results if no other clauses are provided.
            product_id `;

    if (matchValue.length > 0) {
      // if we were actually given something to match with
      const jsonSchema = await this.getSchema(productTypeId);
      // parse request to use equal match
      const matchData = await this.clauseConverter.convertToWhereClauses(
        matchValue,
        jsonSchema,
        productTypeId,
      );
      const [updatedMatchingBlock, argsUpdated] = this.convertToWhereString(
        matchData,
        args,
        whereBlockIncluded,
      );
      args = { ...argsUpdated };
      if (updatedMatchingBlock.trim()) {
        documentMatchingBlock = `AND ${updatedMatchingBlock}`;
      }
    }

    return [documentMatchingBlock, orderByBlock, args];
  }

  /**
   * We only interested in products that have no blocked reasons for this term or they have the reason, but it's inactive
   * @param term
   * @param termId
   * @param productTypeGroupId
   * @param batchSize
   */
  private blockByTermQuery(
    term: string,
    termId: number,
    productTypeGroupId: string,
    batchSize: number,
  ) {
    // Escape regex characters from the term (add "\" before special characters)
    const termRegex = term.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
    const args = {
      term: { idx: 1, value: termRegex },
      termId: { idx: 2, value: termId },
      productTypeGroupId: { idx: 3, value: productTypeGroupId },
      batchSize: { idx: 4, value: batchSize },
    };

    const query = `
      SELECT PR.*
      FROM product as PR
      LEFT JOIN block_reason as BR 
        ON BR.product_id=PR.product_id AND BR.term_id=$${args.termId.idx}
      WHERE 
          (BR.block_reason_id IS NULL OR (BR.is_active = false OR BR.is_active IS NULL))
          AND (document->>'productTypeGroupId') = $${args.productTypeGroupId.idx}
          AND lower(document->'meta'->>'name') ~ ('(^|[^a-zA-Z0-9])' || $${args.term.idx} || '($|[^a-zA-Z0-9])')
      LIMIT $${args.batchSize.idx}
      `;
    return { query, args };
  }

  /**
   * We only interested in products that have a blocked reasons for this term and it's inactive
   * @param termId
   * @param productTypeGroupId
   * @param batchSize
   * @returns
   */
  private unblockByTermQuery(
    termId: number,
    productTypeGroupId: string,
    batchSize: number,
  ) {
    const args = {
      termId: { idx: 1, value: termId },
      productTypeGroupId: { idx: 2, value: productTypeGroupId },
      batchSize: { idx: 3, value: batchSize },
    };

    const query = `
      SELECT PR.* 
      FROM block_reason as BR
        LEFT JOIN product as PR
        ON BR.product_id = PR.product_id
      WHERE 
        BR.term_id=$${args.termId.idx} 
        AND BR.is_active=true
        AND PR.document->>'productTypeGroupId' = $${args.productTypeGroupId.idx}
      LIMIT $${args.batchSize.idx}
      `;
    return { query, args };
  }

  /**
   * action add
   * -> there are no reasons for this particular term or they are inactive
   * action remove
   * -> there are reasons for this particular term and they are active
   * @param term
   * @param termId
   * @param productTypeGroupId
   * @param blockActionId
   * @param batchSize
   * @returns
   */
  public async findProductsByTerm(
    term: string,
    termId: number,
    productTypeGroupId: string,
    blockActionType: BlockActionType,
    batchSize: number,
  ): Promise<Product[]> {
    const { query, args } =
      blockActionType == BlockActionType.Add
        ? this.blockByTermQuery(term, termId, productTypeGroupId, batchSize)
        : this.unblockByTermQuery(termId, productTypeGroupId, batchSize);

    const { rows } = await this.query(
      query,
      _.map(_.sortBy(_.mapValues(args), 'idx'), 'value'),
    );
    return _.map(rows, (r) => this.convertFrom(r));
  }

  private blockByArtistQuery(
    vendorArtistId: string,
    vendorName: string,
    productTypeIds: string[],
    artistProductId: number,
    batchSize: number,
  ) {
    const args = {
      vendorArtistId: { idx: 1, value: vendorArtistId },
      vendorName: { idx: 2, value: vendorName },
      productTypeIds: { idx: 3, value: productTypeIds },
      artistProductId: { idx: 4, value: artistProductId },
      batchSize: { idx: 5, value: batchSize },
    };
    const query = `
        SELECT PR.*
        FROM product as PR
        LEFT JOIN block_reason as BR ON BR.product_id = PR.product_id 
        AND BR.blocked_by_product=$${args.artistProductId.idx}
        WHERE 
            (BR.block_reason_id IS NULL OR (BR.is_active=false OR BR.is_active IS NULL))
            AND (document->>'productTypeId') = ANY($${args.productTypeIds.idx})
            AND document->'source'->>'vendorArtistId' = $${args.vendorArtistId.idx}
            AND document->'source'->>'vendorName' = $${args.vendorName.idx}
        LIMIT $${args.batchSize.idx}
        `;
    return { query, args };
  }

  private unblockByArtistQuery(
    artistProductId: number,
    productTypeIds: string[],
    batchSize: number,
  ) {
    const args = {
      artistProductId: { idx: 1, value: artistProductId },
      productTypeIds: { idx: 2, value: productTypeIds },
      batchSize: { idx: 3, value: batchSize },
    };

    const query = `
      SELECT PR.* 
      FROM block_reason as BR
        LEFT JOIN product as PR
        ON BR.product_id = PR.product_id AND term_id IS NULL AND BR.blocked_by_product=$${args.artistProductId.idx}
      WHERE 
        BR.is_active=true
        AND (document->>'productTypeId') = ANY($${args.productTypeIds.idx})
      LIMIT $${args.batchSize.idx}
      `;
    return { query, args };
  }

  public async findProductsByArtist(
    vendorArtistId: string,
    vendorName: string,
    productTypeIds: string[],
    blockActionType: BlockActionType,
    artistProductId: number,
    batchSize: number,
  ): Promise<Product[]> {
    const { query, args } =
      blockActionType == BlockActionType.Add
        ? this.blockByArtistQuery(
            vendorArtistId,
            vendorName,
            productTypeIds,
            artistProductId,
            batchSize,
          )
        : this.unblockByArtistQuery(artistProductId, productTypeIds, batchSize);

    const { rows } = await this.query(
      query,
      _.map(_.sortBy(_.mapValues(args), 'idx'), 'value'),
    );
    return _.map(rows, (r) => this.convertFrom(r));
  }

  public async getAllDistinctProductValueCombinations(
    sourcePath: string,
    productTypeGroupId: string,
    sourceValueName: string,
  ): Promise<string[][]> {
    // gets all genres in lower case
    const query = `SELECT DISTINCT LOWER(document->${BatchManager.getClauseString(sourcePath)})::JSONB genres_combinations
        FROM product
        where LOWER(document->${BatchManager.getClauseString(sourcePath)})::JSONB ? $1
        AND document->>'productTypeGroupId'=$2`;
    const { rows } = await this.query(query, [
      sourceValueName.toLowerCase(),
      productTypeGroupId,
    ]);
    return rows.map(
      (row: { genresCombinations: string[] }) => row.genresCombinations,
    );
  }

  public async findArtist(product: Product): Promise<Product> {
    return (
      await this.find({
        customClauses: [
          {
            clause: `document->'source'->>'vendorProductId' = $1`,
            params: [product.source?.vendorArtistId],
          },
          {
            clause: `document->'source'->>'vendorName' = $1`,
            params: [product.source?.vendorName],
          },
          {
            clause: `document->'source'->>'productTypeId' = $1`,
            params: [ProductTypeIds.Artist],
          },
        ],
      })
    )[0];
  }
}

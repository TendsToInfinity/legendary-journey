import { Paginated } from '@securustablets/libraries.postgres';
import { _ } from '@securustablets/libraries.utils';
import { Exception } from 'securus.tablets.libraries.exceptions';
import { PricedProduct } from '../controllers/models/Product';
import { Search } from '../controllers/models/Search';

export class ExplicitSearchHelper {
  public static checkExplicitField(search: Search): string | undefined {
    let orderByExplicit;
    if (!_.isEmpty(search.orderBy)) {
      const orderByArray = _.castArray<{
        [field: string]: 'ASC' | 'DESC' | 'EXPLICIT';
      }>(search.orderBy);
      orderByArray.map((predicate) => {
        const [field, direction] = _.entries(predicate)[0];
        if (direction.trim().toUpperCase() === 'EXPLICIT') {
          if (!search.query) {
            throw Exception.InvalidData(
              'EXPLICIT OrderBy only supported with Query Search',
            );
          }

          const matchClause = _.find(
            Object.keys(search.query.clauses),
            (clause) => {
              return clause === field;
            },
          );
          if (!matchClause) {
            throw Exception.InvalidData(
              'Field Values are missing in Input JSON for EXPLICIT sort order',
            );
          }
          if (_.get(search.query.clauses, field).length > 100) {
            throw Exception.InvalidData(
              'Maximum number of clause values is 100',
            );
          }
          if (orderByArray.length > 1) {
            throw Exception.InvalidData(
              'EXPLICIT OrderBy only supports one OrderBy',
            );
          }
          orderByExplicit = field;
        }
      });
    }
    return orderByExplicit;
  }

  /**
   * When performing an EXPLICIT orderBy search remove orderBy and adjust paging information
   * Paginating/Ordering the result of this query will be done in memory and not by OpenSearch
   * @see mutateExplicitSearchReturn
   */
  public static mutateExplicitSearchQuery(
    search: Search,
    explicitField: string,
  ): Search {
    search.orderBy = {};
    search.pageSize = _.get(search.query.clauses, explicitField).length;
    search.pageNumber = 0;
    return search;
  }

  /**
   * Update paginatedProducts to respect the pagination parameters passed in
   * This method will also sort the results based on the explicit field clause
   */
  public static mutateExplicitSearchReturn(
    search: Search,
    explicitField: string,
    paginatedProducts: Paginated<PricedProduct>,
    pageSize: number | undefined,
    pageNumber: number | undefined,
  ): Paginated<PricedProduct> {
    pageSize = pageSize ?? 100;
    pageNumber = pageNumber ?? 0;

    const matchArray = _.get(search.query.clauses, explicitField);
    const pageStart = pageNumber * pageSize;
    paginatedProducts.data = paginatedProducts.data
      .sort(
        (a, b) =>
          matchArray.indexOf(_.get(a, explicitField)) -
          matchArray.indexOf(_.get(b, explicitField)),
      )
      .slice(pageStart, pageStart + pageSize);
    paginatedProducts.pageSize = pageSize;
    paginatedProducts.pageNumber = pageNumber;
    return paginatedProducts;
  }
}

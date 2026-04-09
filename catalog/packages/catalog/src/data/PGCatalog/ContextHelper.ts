import {
  CacheContainer,
  Csi,
  MethodCache,
} from '@securustablets/libraries.cache';
import { PostgresDao } from '@securustablets/libraries.postgres';
import { _ } from '@securustablets/libraries.utils';
import * as Bluebird from 'bluebird';
import { QueryResult } from 'pg';
import { Container } from 'typescript-ioc';
import { RuleType } from '../../controllers/models/Rule';
import { Context } from '../../controllers/models/Search';
import { AppConfig } from '../../utils/AppConfig';

@CacheContainer(Csi.Tier3, {
  secondsToLive: Container.get(AppConfig).cache.ttlShort,
})
export class ContextHelper<T extends object> extends PostgresDao<T> {
  /**
   * Finds the relevant set (Rule/Fee) according to the provided context.
   *
   * No particular sort order is guaranteed for the set returned from this method.
   *
   * If no context is provided, only global sets are returned
   */
  @MethodCache(Csi.Tier3)
  public async findByContext(context?: Context, type?: RuleType): Promise<T[]> {
    const result = await this.query(
      `SELECT * FROM ${this.table}
                    WHERE (customer_id = $1 OR customer_id IS NULL)
                    AND (site_id = $2 OR site_id IS NULL)
                    ${type ? 'AND type = $3 AND enabled' : ''}`,
      _.concat(
        [_.get(context, 'customerId', ''), _.get(context, 'siteId', '')],
        type ? [type] : [],
      ),
    );

    return this.convertQueryResult(result);
  }

  /**
   * Finds the relevant set (Rule/Fee) according to the provided context.
   * No particular sort order is guaranteed for the set returned from this method.
   * If no context is provided, only global sets are returned
   *
   * @param context Allows filtering by context
   * @param ruleTypes Allows filtering for ruleTypes if provided
   * @param productTypeIds Allows filtering for productTypeIds if provided
   *
   * @returns Returns back Rules/Fees with clauses formatted for matching against product data
   */
  @MethodCache(Csi.Tier3)
  public async findByContextWithJsonClauses(
    context?: Context,
    productTypeIds?: string[],
    ruleTypes?: RuleType[],
  ): Promise<T[]> {
    const values = [
      _.get(context, 'customerId', ''),
      _.get(context, 'siteId', ''),
      productTypeIds,
    ];
    if (!_.isEmpty(ruleTypes)) {
      values.push(ruleTypes);
    }

    const result = await this.query(
      `SELECT * FROM ${this.table}
                  WHERE (customer_id = $1 OR customer_id IS NULL)
                  AND (site_id = $2 OR site_id IS NULL)
                  AND ($3::text[] IS NULL OR product_type_id = ANY($3::text[]))` +
        `${context?.enforce === false ? '' : ' AND enabled'}` +
        `${_.isEmpty(ruleTypes) ? '' : ' AND type = ANY($4::text[])'}`,
      values,
    );
    return this.convertQueryResultWithJsonClauses(result);
  }

  private async convertQueryResultWithJsonClauses(
    queryResult: QueryResult,
  ): Promise<T[]> {
    return Bluebird.map(
      queryResult.rows,
      (row) => this.convertFromWithJsonClauses(row),
      { concurrency: 5 },
    );
  }

  private async convertFromWithJsonClauses(row: any): Promise<T> {
    return {
      ..._.omit(row, 'siteId', 'customerId', 'amount'),
      ...(row.siteId && { siteId: row.siteId }),
      ...(row.customerId && { customerId: row.customerId }),
      ...(row.amount && { amount: parseFloat(row.amount) }),
      clauses: row.clauses,
    } as T;
  }
}

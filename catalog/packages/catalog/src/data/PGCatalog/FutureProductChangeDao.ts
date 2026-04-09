import { pga } from '@securustablets/libraries.audit-history';
import { PostgresDao } from '@securustablets/libraries.postgres';
import { SearchParameters } from '@securustablets/libraries.postgres/dist/src/models/SearchParameters';
import { _ } from '@securustablets/libraries.utils';
import { Exception } from 'securus.tablets.libraries.exceptions';
import { Inject } from 'typescript-ioc';
import { SearchHelper } from '../../controllers/SearchHelper';
import { FutureProductChange } from '../../controllers/models/FutureProductChange';
import { Product } from '../../controllers/models/Product';
import { AuditContext } from '../../lib/models/AuditContext';
import { Paginated } from '../../lib/models/Paginated';

export class FutureProductChangeDao extends PostgresDao<FutureProductChange> {
  @Inject
  private searchHelper!: SearchHelper;

  protected pga = pga<AuditContext, FutureProductChange>(this);

  public find = this.pga.find();
  public create = this.pga.create();
  public update = this.pga.update();
  public exists = this.pga.exists();

  public findByQueryString = this.pga.findByQueryString();

  public async findFutureProductByVendorAndDate(
    vendorProductId: string,
    vendorName: string,
    effectiveDate: string,
    productTypeId: string,
    ingestionBatchId?: string,
  ): Promise<FutureProductChange[]> {
    const date = effectiveDate.includes('T')
      ? effectiveDate.split('T')[0]
      : effectiveDate;
    const start = date + 'T00:00:00Z';
    const end = date + 'T23:59:59Z';
    const effectiveDateRange = { start, end };
    const results = await this.find({
      by: {
        productTypeId: productTypeId,
        vendorProductId: vendorProductId,
        vendorName: vendorName,
        actionDate: effectiveDateRange,
        ingestionBatchId: ingestionBatchId,
      },
    });
    return results;
  }

  public async findFutureProducts(
    query: SearchParameters,
  ): Promise<Paginated<FutureProductChange>> {
    const effectiveDateRange = query.actionDate
      ? {
          start: this.convertDateToYMD(query.actionDate),
          end: `${this.convertDateToYMD(query.actionDate)} 23:59:59`,
        }
      : undefined; // full day range
    const searchArgs = _.omitBy(
      {
        productId: query.productId ? Number(query.productId) : undefined,
        vendorProductId: query.vendorProductId,
        vendorName: query.vendorName,
        state: query.state,
        productTypeId: query.productTypeId,
        actionDate: effectiveDateRange,
      },
      _.isNil,
    );
    const findOptions = {
      ...this.searchHelper.buildPaginationOptions(query),
      by: searchArgs,
    };
    return this.searchHelper.buildResponse(
      await this.find(findOptions),
      findOptions,
    );
  }

  public async productsToUpdateCount(): Promise<number> {
    const response = await this.query(
      'SELECT ' +
        'count(future_product_change_id) as productsCount ' +
        'FROM future_product_change fpc ' +
        "WHERE lower(state) = 'pending' " +
        'AND action_date <= CURRENT_DATE',
    );
    return response.rows[0].productscount;
  }

  public async futureProductPerformChanges(): Promise<Product[]> {
    const res = await this.write(
      `SELECT * FROM future_product_perform_changes();`,
    );
    return res.rows.map((row) => {
      return row.document as Product;
    });
  }

  public convertDateToYMD(dateForConvert: string): string {
    try {
      const date = new Date(dateForConvert);
      if (date && !isNaN(date.getTime())) {
        return `${date.getFullYear()}-${this.addZeroes(date.getMonth() + 1)}-${this.addZeroes(date.getDate())}`;
      } else {
        throw Error;
      }
    } catch (error) {
      throw Exception.InvalidData({ errors: ['Invalid date format'] });
    }
  }

  private addZeroes(num: number): string {
    // Format integers to have at least two digits.
    return num < 10 ? `0${num}` : num.toString();
  }
}

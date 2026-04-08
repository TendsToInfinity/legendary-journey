import { pga } from '@securustablets/libraries.audit-history';
import { CacheContainer, Csi } from '@securustablets/libraries.cache';
import { PostgresDao } from '@securustablets/libraries.postgres';
import { _ } from '@securustablets/libraries.utils';
import { Exception } from 'securus.tablets.libraries.exceptions';
import { Container } from 'typescript-ioc';
import { ProductSales } from '../../controllers/models/Product';
import { AuditContext } from '../../lib/models/AuditContext';
import { AppConfig } from '../../utils/AppConfig';

@CacheContainer(Csi.Tier3, {
  secondsToLive: Container.get(AppConfig).cache.ttlMedium,
})
export class ProductSalesDao extends PostgresDao<ProductSales> {
  protected pga = pga<AuditContext, ProductSales>(this);

  public findOne = this.pga.findOne();
  public defaultCreateAndRetrieve = this.pga.createAndRetrieve();
  public findByQueryString = this.pga.findByQueryString();
  public update = this.pga.update();
  public updateAndRetrieve = this.pga.updateAndRetrieve();
  public increment = this.pga.increment();
  public query = this.query;

  public async createAndRetrieve(
    model: ProductSales,
    context: AuditContext,
  ): Promise<ProductSales> {
    try {
      return await this.defaultCreateAndRetrieve(
        _.omit(model, this.modelId) as ProductSales,
        context,
      );
    } catch (e) {
      if (_.get(e, 'code') === '23505') {
        let description;
        if (_.get(e, 'constraint') === 'product_sales_day_idx') {
          description = {
            errors: ['The vendor product ID already exist in this vendor'],
          };
        }
        throw Exception.Conflict(description);
      } else {
        throw Exception.InternalError(e);
      }
    }
  }

  public async incrementCompletedOrders(productSalesId: number): Promise<void> {
    await this.increment(productSalesId, 'completedOrders');
  }
}

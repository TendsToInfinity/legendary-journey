import { Logger } from '@securustablets/libraries.logging';
import { Inject, Singleton } from 'typescript-ioc';
import {
  ProductSales,
  ProductSalesSearch,
} from '../../controllers/models/Product';
import { ProductSalesManager } from '../../lib/ProductSalesManager';
import { Order, OrderState } from '../../models/Order';
import { MessagingConstants } from '../MessagingConstants';

@Singleton
export class OrderCompleteHandler {
  @Inject
  private productSalesManager!: ProductSalesManager;

  @Inject
  private log!: Logger;

  public readonly bindingKeys = [
    MessagingConstants.ORDER_COMPLETE_PURCHASE_ROUTING_KEY,
    MessagingConstants.ORDER_COMPLETE_SUBSCRIPTION_ROUTING_KEY,
    MessagingConstants.ORDER_COMPLETE_RENTAL_ROUTING_KEY,
  ];

  public async handleMessage(
    routingKey: string,
    order: Order,
  ): Promise<boolean> {
    if (order.state !== OrderState.Complete) {
      return true;
    }

    if (order.product.productTypeGroupId === 'tabletPackage') {
      return true;
    }

    try {
      const productSalesSearchRecord: ProductSalesSearch =
        this.productSalesManager.toProductSalesSearch(order);
      const productSalesRecord: ProductSales = {
        ...productSalesSearchRecord,
        completedOrders: 1,
        productName: order.product.name,
      };
      const existingSalesRecord: ProductSales =
        await this.productSalesManager.findOne({
          by: productSalesSearchRecord,
        });

      if (!existingSalesRecord) {
        await this.productSalesManager.createProductSales(productSalesRecord, {
          routingKey,
        });
      } else {
        await this.productSalesManager.incrementCompletedOrders(
          existingSalesRecord.productSalesId,
          existingSalesRecord.productId,
          existingSalesRecord.productTypeId,
          existingSalesRecord.artistProductId,
        );
      }
    } catch (error) {
      this.log.error(`handleMessage error: ${JSON.stringify(error)}`);
      this.log.error(error);
    }
    return true;
  }
}

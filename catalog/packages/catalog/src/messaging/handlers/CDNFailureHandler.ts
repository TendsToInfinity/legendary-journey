import { Logger } from '@securustablets/libraries.logging/dist/src/Logger';
import { Inject, Singleton } from 'typescript-ioc';
import { Product } from '../../controllers/models/Product';
import { ProductManager } from '../../lib/ProductManager';
import { MessagingConstants } from '../MessagingConstants';
import { CDNFailureMessage } from '../models/CDNFailureMessage';

@Singleton
export class CDNFailureHandler {
  @Inject
  private log!: Logger;

  @Inject
  private productManager!: ProductManager;

  public readonly bindingKeys = [
    MessagingConstants.CIDN_ORDER_PRODUCT_UNSUBSCRIBABLE,
    MessagingConstants.CIDN_ORDER_PRODUCT_UNPURCHASABLE,
  ];

  public async handleMessage(
    routingKey: string,
    message: CDNFailureMessage,
  ): Promise<boolean> {
    const existingProduct: Product =
      await this.productManager.findOneByVendorProductId(
        message.vendorProductId,
        message.vendorName,
        message.productTypeId,
      );

    if (!existingProduct) {
      this.log.info(
        `Product not found for vendorProductId: ${message.vendorProductId}, vendorName: ${message.vendorName}, productTypeId: ${message.productTypeId}`,
      );
      return true;
    }

    switch (routingKey) {
      case MessagingConstants.CIDN_ORDER_PRODUCT_UNSUBSCRIBABLE: {
        existingProduct.source.availableForSubscription = false;
        break;
      }
      case MessagingConstants.CIDN_ORDER_PRODUCT_UNPURCHASABLE: {
        existingProduct.source.availableForPurchase = false;
        break;
      }
    }
    await this.productManager.updateProduct(existingProduct, { routingKey });

    return true;
  }
}

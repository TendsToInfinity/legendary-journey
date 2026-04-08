import { Logger } from '@securustablets/libraries.logging';
import { _ } from '@securustablets/libraries.utils';
import { Inject, Singleton } from 'typescript-ioc';
import { Product, ProductStatus } from '../../controllers/models/Product';
import { ProductManager } from '../../lib/ProductManager';
import { MessagingConstants } from '../MessagingConstants';
import { ProductMessage } from '../models/ProductMessage';

/**
 * This handler is specifically added for migration of Jpay facilities to make sure we are not replacing existing catalog items.
 * This handler will be used until we are able to add a dedicated API to the Legacy system or all Jpay facilities are migrated.
 * After one of those conditions is resolved this handler should be removed.
 * @see https://confluence.dal.securustech.net/x/WYFHCQ
 */
@Singleton
export class LegacyInactiveProductHandler {
  @Inject
  private productManager!: ProductManager;

  @Inject
  private log!: Logger;

  public readonly bindingKeys = [
    MessagingConstants.LEGACY_PRODUCT_INACTIVE_ROUTING_KEY,
  ];

  public async handleMessage(
    routingKey: string,
    productMessage: ProductMessage,
  ): Promise<boolean> {
    try {
      const existingProduct =
        await this.productManager.findOneByVendorProductId(
          productMessage.product.source?.vendorProductId,
          productMessage.product.source?.vendorName,
          productMessage.product.productTypeId,
        );

      if (existingProduct) {
        return true;
      }

      if (!_.has(productMessage, 'product.source.vendorParentProductId')) {
        productMessage.product.childProductIds = [];
      }
      this.setInactiveOverrides(productMessage.product);
      await this.productManager.createProduct(productMessage.product, {
        routingKey,
      });
    } catch (error) {
      this.log.error(
        `Legacy Inactive Ingestion process error. id: ${_.get(productMessage, 'product.source.vendorProductId')}`,
        error,
      );
      this.log.error(
        `Legacy Inactive Ingestion process error, message:`,
        productMessage,
      );
      throw error;
    }

    return true;
  }

  public setInactiveOverrides(product: Product) {
    product.source.availableForPurchase = false;
    product.source.availableForSubscription = false;
    product.status = ProductStatus.Inactive;
  }
}

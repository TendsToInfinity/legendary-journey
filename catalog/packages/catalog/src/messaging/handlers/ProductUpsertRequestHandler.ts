import { Logger } from '@securustablets/libraries.logging';
import { _ } from '@securustablets/libraries.utils';
import { Inject, Singleton } from 'typescript-ioc';
import { ProductManager } from '../../lib/ProductManager';
import { MessagingConstants } from '../MessagingConstants';
import { ProductMessage } from '../models/ProductMessage';

@Singleton
export class ProductUpsertRequestHandler {
  @Inject
  private productManager!: ProductManager;

  @Inject
  private log!: Logger;

  public readonly bindingKeys = [
    MessagingConstants.PRODUCT_UPSERT_REQUEST_ROUTING_KEY,
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
        await this.productManager.updateProduct(
          _.mergeWith(
            existingProduct,
            productMessage.product,
            _.mergeArrayOverride,
          ),
          { routingKey },
        );
      } else {
        if (
          productMessage.product.source?.vendorParentProductId === undefined
        ) {
          productMessage.product.childProductIds = [];
        }
        await this.productManager.createProduct(productMessage.product, {
          routingKey,
        });
      }
    } catch (error) {
      this.log.error(
        `Ingestion process error. id: ${_.get(productMessage, 'product.source.vendorProductId')}`,
        error,
      );
      this.log.error(`Ingestion process error, message:`, productMessage);
      throw error;
    }

    return true;
  }
}

import { Logger } from '@securustablets/libraries.logging';
import { Inject, Singleton } from 'typescript-ioc';
import { ProductTypeIds, VendorNames } from '../../controllers/models/Product';
import { ProductManager } from '../../lib/ProductManager';
import { MessagingConstants } from '../MessagingConstants';
import { CidnMusicSharedOutput } from '../models/CidnFulfillmentMessage';

@Singleton
export class ProductUpdateCidnFulfillmentResponseHandler {
  @Inject
  private productManager!: ProductManager;

  @Inject
  private log!: Logger;

  public readonly bindingKeys = [
    MessagingConstants.CIDN_FULFILLMENT_UPDATE_KEY,
  ];

  // subscribe to CIDN fulfillment - when download is complete save actual s3Path
  public async handleMessage(
    routingKey: string,
    message: CidnMusicSharedOutput,
  ): Promise<boolean> {
    const vendorName = message.vendor;
    await Promise.all(
      message.contentToDeliver.map(async (item) => {
        // If the message was created with errors, which happens when the cdn fulfillment wasn't successful, then we do not have to update the product.
        if (item.error) {
          this.log.debug(
            `Input message has error - ${item.error}, for Vendor Product Id: ${item.vendorProductId} for vendor: ${vendorName}`,
          );
          return;
        }

        /**
         * Forward and backward compatible without having to change cidn fulfillment code.
         * Currently the item.productTypeId is not sent by the source. These RMQ messages are currently created only for vendor - Audible Magic - tracks.
         * So, if item.productTypeId is missing based on the vendor type assigning the value to productTypeId as track
         * Else there is possibility of getting a product record which is not track with findOne with only vendorProductId and vendorName(example - artist and tracks may have same Id)
         */
        let productTypeId = item.productTypeId;
        if (!productTypeId && vendorName === VendorNames.AudibleMagic) {
          productTypeId = ProductTypeIds.Track;
        }
        if (!productTypeId) {
          this.log.error(
            `Missing ProductTypeId, cannot search for the product with vendorProductId: ${item.vendorProductId} and vendorName: ${vendorName}`,
          );
          return;
        }
        const existingProduct =
          await this.productManager.findOneByVendorProductId(
            item.vendorProductId,
            vendorName,
            productTypeId,
          );

        if (!existingProduct) {
          this.log.error(
            `Cannot find product ${item.vendorProductId} for vendor: ${vendorName}`,
          );
          return;
        }

        // To avoid too many versions and audits of product, if the s3Path is same as current, no update is needed, just log the message.
        if (existingProduct.source.s3Path === item.s3Path) {
          this.log
            .debug(`Vendor Product Id: ${item.vendorProductId} for vendor: ${vendorName} exists, but has the same path,
                    existing: ${existingProduct.source.s3Path}, new :${item.s3Path}`);
          return;
        }

        existingProduct.source.s3Path = item.s3Path;
        await this.productManager.updateProduct(existingProduct, {
          routingKey,
        });
      }),
    );

    return true;
  }
}

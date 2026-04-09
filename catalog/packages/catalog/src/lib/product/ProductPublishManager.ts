import { Logger } from '@securustablets/libraries.logging';
import { MessagingManager } from '@securustablets/libraries.messaging';
import { _ } from '@securustablets/libraries.utils';
import * as Bluebird from 'bluebird';
import { Exception } from 'securus.tablets.libraries.exceptions';
import { Inject } from 'typescript-ioc';
import { Product, ProductTypeIds } from '../../controllers/models/Product';
import { MessagingConstants } from '../../messaging/MessagingConstants';
import { SqsService } from '../../services/SqsService';
import { OpenSearchManager } from '../OpenSearchManager';

/**
 * This Manager class handles publishing the products to RMQ
 */
export class ProductPublishManager {
  @Inject
  private messagingManager!: MessagingManager;

  @Inject
  private openSearchManager!: OpenSearchManager;

  @Inject
  private logger!: Logger;

  @Inject
  private sqsSongSampleService: SqsService;

  /**
   * Publish a message that consumed by Chris' "Legacy" system
   * TODO Remove after all migrations are done
   */
  public async publishLegacyMessage(legacyMessage: any): Promise<void> {
    await this.messagingManager.publish(
      MessagingConstants.PUBLICATION_ID,
      'legacy.product.art.updated',
      legacyMessage,
    );

    return Promise.resolve();
  }

  /**
   * Publish message without sync digesting
   * @param product
   * @returns
   */
  public async publishProductMessageWithoutDigest(
    product: Product,
  ): Promise<void> {
    await this.messagingManager.publish(
      MessagingConstants.PUBLICATION_ID,
      this.routingKeyFor(product),
      { ...product },
    );
    return Promise.resolve();
  }

  public async publishProductMessage(product: Product): Promise<void> {
    await this.messagingManager.publish(
      MessagingConstants.PUBLICATION_ID,
      this.routingKeyFor(product),
      { ...product },
    );
    try {
      await this.openSearchManager.digestProductsIntoOpenSearch([product]);
    } catch (error) {
      this.logger.error(
        `Error digesting product ${JSON.stringify(product)}`,
        error,
      );
    }
    return Promise.resolve();
  }

  public async publishRemovalMessage(
    removedProducts: Product[],
  ): Promise<void> {
    await Bluebird.map(
      removedProducts,
      async (product) => {
        await this.messagingManager.publish(
          MessagingConstants.PUBLICATION_ID,
          MessagingConstants.REDEEM_PRODUCT_REMOVED_ROUTING_KEY,
          product,
        );
      },
      { concurrency: 10 },
    );
  }

  public async publishSongSampleDownloadRequest(product: Product) {
    // remove auto increment fields from the product and child products
    const allProducts: Product[] = [product, ...(product.childProducts || [])];
    const tracks = allProducts
      .filter((p) => p.productTypeId === ProductTypeIds.Track)
      .map((p) => _.omit(p, 'cdate', 'udate', 'version'));
    try {
      await Promise.all(
        tracks.map(async (track) => {
          await this.sqsSongSampleService.sendJob({ product: track });
        }),
      );
    } catch (error) {
      // throw 500 error
      throw Exception.InternalError({
        errors: `Error sending song sample download request. Error: ${error.message}`,
      });
    }
  }

  private routingKeyFor(
    product: Product,
    version = 2,
    action: 'updated' = 'updated',
  ) {
    return `product-${version}.${product.productTypeGroupId}.${product.productTypeId}.${action}`;
  }
}

import { Logger } from '@securustablets/libraries.logging';
import * as Retry from 'async-retry';
import { Exception } from 'securus.tablets.libraries.exceptions';
import { Inject, Singleton } from 'typescript-ioc';
import { ProductStatus } from '../../controllers/models/Product';
import { AppConfig } from '../../utils/AppConfig';
import { FutureProductChangeManager } from '../FutureProductChangeManager';
import { ProductPublishManager } from '../product/ProductPublishManager';

export interface ProductsToUpdateStatus {
  status: string;
  count: number;
}

export interface ProductsUpdateJobStatus {
  status: string;
}

@Singleton
export class FutureProductChangeUpdateJob {
  @Inject
  private logger!: Logger;

  @Inject
  private futureProductChangeManager!: FutureProductChangeManager;

  @Inject
  private productPublishManager!: ProductPublishManager;

  @Inject
  private config!: AppConfig;

  private jobInProgress: boolean = false;
  private readonly retry = Retry;

  private readonly retryAttempts = 3;
  private readonly retryAttemptsMinTime = 10;
  private readonly retryAttemptsMaxTime = 10;

  // 1. An API for triggering the Product Update procedure from CloudFront. The API response: number of products to be updated.
  // 2. An API for getting the status of the running the Product Update procedure.
  // 3. The Product Update procedure - is idempotent.
  // 4. The Product Update procedure logic is:
  // 4.1. Takes FutureProductChanges records for batches of 100 Products.
  // 4.2. Updates the 100 Products by Postgres script and returns updated products.
  // 4.3. Publishes on RMQ the 100 updated Products with action = 'updated'. Error logging by using the 'log.error' method.
  // 4.4. Re-evaluates subscriptions for the 100 updated Products. Error logging by using the 'log.error' method.
  public async execute(): Promise<ProductsUpdateJobStatus> {
    try {
      const isProductsToUpdateExist =
        await this.futureProductChangeManager.isProductsToUpdateExist();
      if (isProductsToUpdateExist) {
        this.runBatch(); // don't use await here!
      }
      return {
        status: isProductsToUpdateExist
          ? 'The update has been started'
          : 'Nothing to update. The update is stopped',
      };
    } catch (error) {
      throw Exception.InternalError({
        errors: `Batch execute error. Error: ${error.message}`,
      });
    }
  }

  public async getCurrentJobStatus(): Promise<ProductsToUpdateStatus> {
    const count = await this.futureProductChangeManager.productsToUpdateCount();

    const currentJobStatus = {
      status: this.jobInProgress
        ? 'The update is running'
        : 'The update is not running',
      count: count,
    };
    return currentJobStatus;
  }

  public async runBatch(): Promise<void> {
    try {
      this.jobInProgress = true;
      do {
        // Update products and getting a list of updated Products
        const products =
          await this.futureProductChangeManager.futureProductPerformChanges();

        if (products.length > 0) {
          // If we have product to update
          for (const product of products) {
            await this.retry(
              async () => {
                this.productPublishManager.publishProductMessage(product);
              },
              {
                retries: this.retryAttempts,
                minTimeout: this.retryAttemptsMinTime,
                maxTimeout: this.retryAttemptsMaxTime,
                onRetry: (err: any, num: number) => {
                  this.logger.error(
                    `Retry ${num} to publish re-evaluation for the product, id: ${product.productId}`,
                  );
                  this.logger.error(err);
                },
              },
            );
            if (
              this.config.sqsConfig.sqsEnabled &&
              product.productTypeGroupId === 'music' &&
              !product.source.sampleUrl &&
              product.status === ProductStatus.Active
            ) {
              this.logger.info(
                `Publishing song sample download request for product ${product.productId}`,
              );
              await this.productPublishManager.publishSongSampleDownloadRequest(
                product,
              );
            }
          }
        }
      } while (await this.futureProductChangeManager.isProductsToUpdateExist());
    } catch (error) {
      throw Exception.InternalError({
        errors: `Post script error. Error: ${error.message}`,
      });
    } finally {
      this.jobInProgress = false;
    }
  }
}

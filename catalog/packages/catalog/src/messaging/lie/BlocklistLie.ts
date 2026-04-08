import { _ } from '@securustablets/libraries.utils';
import * as Bluebird from 'bluebird';
import { Inject, Singleton } from 'typescript-ioc';
import {
  BlockAction,
  BlockActionBy,
  BlockActionState,
  BlockActionType,
} from '../../controllers/models/BlockAction';
import {
  BlockReason,
  BlockReasonConstruct,
} from '../../controllers/models/BlockReason';
import { BlocklistTerm } from '../../controllers/models/BlocklistTerm';
import { Product, ProductTypeIds } from '../../controllers/models/Product';
import { BatchManager, BatchTransform } from '../../data/BatchManager';
import { BlocklistTermDao } from '../../data/PGCatalog/BlocklistTermDao';
import { ProductDao } from '../../data/PGCatalog/ProductDao';
import { BlocklistActionManager } from '../../lib/BlocklistActionManager';
import { BlocklistReasonManager } from '../../lib/BlocklistReasonManager';
import { AuditContext } from '../../lib/models/AuditContext';
import { ParentProductManager } from '../../lib/product/ParentProductManager';
import { ProductPublishManager } from '../../lib/product/ProductPublishManager';
import { AppConfig } from '../../utils/AppConfig';

interface BatchUpdate {
  entities: any[];
  transform: BatchTransform;
}

interface ProductBlockBatch extends BlockReasonsBatch {
  products: Product[];
}

interface BlockReasonsBatch {
  creates: BlockReason[];
  updates: BlockReason[];
}

interface AutoReviewResults {
  blocked: boolean;
  blocklistTerms: BlocklistTerm[];
  parents: Product[];
}

enum BatchBlockReasonTypes {
  Updates = 'updates',
  Creates = 'creates',
}

/**
 * Check for parent.isBlocked and block self (auto review)
 * Check for terms and productId on BA (handle action)
 *      if product is artist process related products
 * Remove updates for isBlocked=X already (product update)
 * Remove updates for blockReason=(existing) (blockReason update)
 * Add check for artist when auto-review of track/album
 *
 */
@Singleton
export class BlocklistLie {
  @Inject
  private blocklistActionManager!: BlocklistActionManager;

  @Inject
  private batchManager!: BatchManager;

  @Inject
  private productDao!: ProductDao;

  @Inject
  private blocklistReasonManager!: BlocklistReasonManager;

  @Inject
  private blocklistTermDao!: BlocklistTermDao;

  @Inject
  private parentProductManager!: ParentProductManager;

  @Inject
  private productPublishManager!: ProductPublishManager;

  @Inject
  private appConfig!: AppConfig;

  private readonly batchSize = 1000;
  private readonly mainConcurrency = this.appConfig.autoReview.concurrency;
  private readonly artistConcurrency = Math.round(this.mainConcurrency / 2);

  /**
   *
   * @param blockBatch
   * @param blockAction
   */
  private async runBatchAndPublish(
    blockBatch: ProductBlockBatch,
    blockAction: BlockAction,
  ) {
    await this.runUpdates(blockBatch, blockAction);
    if (!_.isEmpty(blockBatch.products)) {
      const updatedProducts = await this.productDao.find({
        ids: blockBatch.products.map((p) => p.productId),
      });
      await Bluebird.map(
        updatedProducts,
        async (product) => {
          await this.productPublishManager.publishProductMessage(product);
        },
        { concurrency: 10 },
      );
      await Bluebird.delay(500);
    }
  }

  /**
   * Get all the child products that are affected by the block action
   * @param product
   * @param blockAction
   * @returns
   */
  private async getAffectedChildProducts(product: Product): Promise<Product[]> {
    const descendant = await this.productDao.findDescendantProductIds(
      product.productId,
    );
    const childIds: number[] = _.filter(
      descendant,
      (i: number) => i !== product.productId,
    );
    if (childIds.length === 0) {
      return [];
    }

    // return all products even if they are already in the required state to check if the reasons were updated
    return this.productDao.find({
      ids: childIds,
    });
  }

  private isBatchComplete = (entitiesBatch: any[]) => {
    // If we didn't get the batch size then we're through with this term
    return entitiesBatch.length === this.batchSize;
  };

  /**
   * Called from Terms and Product block action handlers
   * Check all products that are affected by the action and needs to be updated
   * also prepare (find existing/create) all the reasons explaining why
   * @param productsToBlock
   * @param blockAction
   * @private
   */
  private async getBlockReasonsForBlockedDescendant(
    productsToBlock: Product[],
    blockAction: BlockAction,
  ): Promise<ProductBlockBatch> {
    const blockBatch: ProductBlockBatch = {
      products: [],
      creates: [],
      updates: [],
    };
    const productsToUpdate = [];

    // filter out products with no child/parent relationship
    const parentProducts = productsToBlock
      .map((product) => {
        if (!_.isEmpty(product.childProductIds)) {
          return product;
        }
        return undefined;
      })
      .filter((i) => i);

    await Bluebird.map(
      parentProducts,
      async (product) => {
        const affectedChildProducts =
          await this.getAffectedChildProducts(product);
        if (affectedChildProducts.length === 0) {
          return;
        }

        // should it be filtered here?
        const affectedChildProductsNeedUpdate = affectedChildProducts.filter(
          (childProduct) => this.productNeedsUpdate(childProduct, blockAction),
        );
        productsToUpdate.push(...affectedChildProductsNeedUpdate);

        // add block reasons
        const blockReasons = await this.getBlockReasonsBy(
          affectedChildProducts.map((p) => p.productId),
          [product.productId],
          blockAction,
        );

        blockBatch.creates.push(...blockReasons.creates);
        blockBatch.updates.push(...blockReasons.updates);
      },
      { concurrency: this.mainConcurrency },
    );

    const uniqueProducts = _.uniqBy(productsToUpdate, 'productId');
    blockBatch.products.push(...uniqueProducts);

    return blockBatch;
  }

  private async runUpdates(
    blockBatch: ProductBlockBatch,
    blockAction: BlockAction,
  ): Promise<void> {
    const updates: BatchUpdate[] = [];
    if (!_.isEmpty(blockBatch.products)) {
      updates.push({
        entities: blockBatch.products,
        transform: BatchManager.getProductTransform(blockAction),
      });
    }
    if (!_.isEmpty(blockBatch.creates)) {
      updates.push({
        entities: blockBatch.creates,
        transform: BatchManager.getBlockInsertTransform(),
      });
    }
    if (!_.isEmpty(blockBatch.updates)) {
      updates.push({
        entities: blockBatch.updates,
        transform: BatchManager.getBlockUpdateTransform(blockAction),
      });
    }

    if (!_.isEmpty(updates)) {
      // update in 1 transaction
      return this.batchManager.runMultipleUpdates(updates);
    }
  }

  /**
   * A small util to keep the code clean
   * Block Reasons may already exit, so we need to update them. Or we just prepare new ones, so we need to create
   * This method will return the correct object to be used in the batch update
   * @param blockReason
   * @param blockAction
   * @returns
   */
  private markAsUpdateCreateBlockReason(
    blockReason: BlockReason,
    blockAction: BlockAction,
  ) {
    if (
      blockReason.blockReasonId &&
      (blockReason.blockActionId !== blockAction.blockActionId ||
        blockReason.isActive !== (blockAction.action === BlockActionType.Add))
    ) {
      // only update if there is a change
      return {
        [BatchBlockReasonTypes.Updates]: {
          ...blockReason,
          isActive: blockAction.action === BlockActionType.Add,
        },
      };
    }
    return {
      [BatchBlockReasonTypes.Creates]: {
        ...blockReason,
      },
    };
  }

  /**
   * For a given product, retrieves all related parent products that are blocked
   * @param product
   * @private
   */
  private async getBlockedParents(
    product: Product,
    parentProduct?: Product,
  ): Promise<Product[]> {
    // check if parent is blocked, if true block child
    const blockedParents: Product[] = [];
    if (product.source?.vendorParentProductId) {
      const parent =
        parentProduct ??
        (await this.parentProductManager.getParentProduct(product));
      if (parent?.isBlocked) {
        blockedParents.push(parent);
      }
    }

    if (
      product.productTypeId === ProductTypeIds.Track ||
      product.productTypeId === ProductTypeIds.Album
    ) {
      const artist = await this.productDao.findArtist(product);
      if (artist?.isBlocked) {
        blockedParents.push(artist);
      }
    }

    return blockedParents;
  }

  /**
   * Check the product (from db) and the blockAction to see if the blockFlag on the product is set or needs an update
   * @param product
   * @param blockAction
   * @private
   */
  private productNeedsUpdate(
    product: Product,
    blockAction: BlockAction,
  ): boolean {
    return product.isBlocked !== (blockAction.action === BlockActionType.Add);
  }

  /**
   * Used for a terms block action,
   *   1. Retrieves and processes the block terms from the action
   *   2. Retrieves affected products by batch and executes blocking of parent and child
   * @param blockAction
   * @param termData
   * @private
   */
  private async handleTerms(blockAction: BlockAction): Promise<void> {
    // process all terms and create all blockReasons
    const termsData = await this.blocklistTermDao.find({
      ids: blockAction.blocklistTermIds,
    });

    // process each term one after another
    for (const termData of termsData) {
      let process = true;
      while (process) {
        // this can be album / tracks / artist
        const productsToBlock: Product[] =
          await this.productDao.findProductsByTerm(
            termData.term,
            termData.blocklistTermId,
            termData.productTypeGroupId,
            blockAction.action,
            this.batchSize,
          );

        // 1. handle products for this batch
        if (productsToBlock.length === 0) {
          process = false;
          continue;
        }

        // add term reasons for the directly blocked products
        const termsBlockBatch = await this.getBlockReasonsBy(
          productsToBlock.map((product) => product.productId),
          [termData],
          blockAction,
        );

        // add block reasons for descendants of the directly blocked product
        const parentBlockBatch = await this.getBlockReasonsForBlockedDescendant(
          productsToBlock,
          blockAction,
        );
        const uniqueProducts = _.uniqBy(
          [...parentBlockBatch.products, ...productsToBlock],
          'productId',
        );

        // run update
        await this.runBatchAndPublish(
          {
            products: uniqueProducts,
            creates: _.concat(
              parentBlockBatch.creates,
              termsBlockBatch.creates,
            ),
            updates: _.concat(
              parentBlockBatch.updates,
              termsBlockBatch.updates,
            ),
          },
          blockAction,
        );

        await Bluebird.map(
          productsToBlock,
          async (product) => {
            if (product.productTypeId === ProductTypeIds.Artist) {
              await this.handleArtist(product, blockAction);
            }
          },
          { concurrency: this.artistConcurrency },
        );

        // If we didn't get the batch size then we're through with this term
        process = this.isBatchComplete(productsToBlock);
      }
    }
  }

  /**
   * Used for an artist block action, retrieves affected products by batch and executes blocking of parent and child
   *    This is a potentially long-running update
   * @param product - The Artist product
   * @param blockAction
   * @private
   */
  private async handleArtist(
    artist: Product,
    blockAction: BlockAction,
  ): Promise<void> {
    let process = true;
    while (process) {
      const productsToHandle: Product[] =
        await this.productDao.findProductsByArtist(
          artist.source.vendorProductId,
          artist.source.vendorName,
          [ProductTypeIds.Album, ProductTypeIds.Track],
          blockAction.action,
          artist.productId,
          this.batchSize,
        );

      // 1. handle products for this batch
      if (productsToHandle.length === 0) {
        process = false;
        continue;
      }

      /**
       * check if some of the products already updated,
       * then we only need to check the reason status
       */
      const productsToUpdate = productsToHandle
        .map((productToBlock) => {
          if (this.productNeedsUpdate(productToBlock, blockAction)) {
            return productToBlock;
          }
        })
        .filter((i) => i);

      // check all the reasons for the artist (notice we use all products even if they are unblocked)
      const artistBlockBatch = await this.getBlockReasonsBy(
        productsToUpdate.map((product) => product.productId),
        [artist.productId],
        blockAction,
      );

      // check all the child product - they can be blocked twice - by artist and by Album
      const parentBlockBatch = await this.getBlockReasonsForBlockedDescendant(
        productsToHandle,
        blockAction,
      );

      const uniqueProducts = _.uniqBy(
        [...productsToUpdate, ...parentBlockBatch.products],
        'productId',
      );

      // apply
      await this.runBatchAndPublish(
        {
          products: uniqueProducts,
          creates: [...artistBlockBatch.creates, ...parentBlockBatch.creates],
          updates: [...artistBlockBatch.updates, ...parentBlockBatch.updates],
        },
        blockAction,
      );

      // 2. continue with other chunk
      process = this.isBatchComplete(productsToHandle);
    }
  }

  /**
   * This handler will be used by LIE (large impact event) to handle all blockActions
   * @param blockAction
   * @param routingKey
   */
  public async blockActionProcessHandler(
    routingKey: string,
    blockAction: BlockAction,
  ) {
    switch (blockAction.type) {
      case BlockActionBy.AutoReview: {
        const product = await this.productDao.findOne(blockAction.productId);

        // backward compatibility remove it after the initial deployment for auto-review v2
        // allow to process messages in flight during the switch
        const legacySwitch = this.appConfig.autoReviewV2DateSwitch;
        if (
          legacySwitch &&
          new Date(legacySwitch) > new Date(blockAction.udate)
        ) {
          const reviewResult = await this.blockAutoReviewHandler(product);
          if (reviewResult.blocked) {
            this.productDao.update(
              product.productId,
              { ...product, isBlocked: true },
              { reason: 'legacyAutoReview', routingKey },
            );
            await this.addDirectBlockReasons(
              { ...product, isBlocked: true },
              reviewResult,
              true,
              {
                routingKey,
              },
            );
          }
        }

        // all direct blocks were done on the ingestion stage. If we are here - it should have been an artist
        if (product.productTypeId === ProductTypeIds.Artist) {
          // if artist, block dependent tracks, albums
          await this.handleArtist(product, blockAction);
        }

        // 2. completed action
        await this.blocklistActionManager.updateBlockAction(
          blockAction.blockActionId,
          { state: BlockActionState.Applied },
          { routingKey },
        );
        break;
      }
      case BlockActionBy.Terms: {
        // a user added block terms that need to be evaluated
        await this.handleTerms(blockAction);
        // completed action
        await this.blocklistActionManager.updateBlockAction(
          blockAction.blockActionId,
          { state: BlockActionState.Applied },
          { routingKey },
        );
        break;
      }
      // this is only for manually blocked artist
      case BlockActionBy.Product: {
        const product = await this.productDao.findOne(blockAction.productId);
        if (product.productTypeId === ProductTypeIds.Artist) {
          // if artist, block dependent tracks, albums
          await this.handleArtist(product, blockAction);
        }
        await this.blocklistActionManager.updateBlockAction(
          blockAction.blockActionId,
          { state: BlockActionState.Applied },
          { routingKey },
        );
        break;
      }
    }
  }

  /**
   * This method will check if a newly ingested/changed product should be blocked:
   *      1. By any of the existing block terms
   *      2. By its parent
   * If the product needs to be it will create all the actions and reasons inline without creating an LIE process
   * @param product
   * @returns boolean - the "isBlocked" flag for the product
   */
  public async blockAutoReviewHandler(
    product: Product,
    parentProduct?: Product,
  ): Promise<AutoReviewResults> {
    const results: AutoReviewResults = {
      blocked: false,
      blocklistTerms: [],
      parents: [],
    };

    // get all the terms for the productTypeGroup
    const termRecords =
      await this.blocklistActionManager.findActiveByProductTypeGroupId(
        product.productTypeGroupId,
      );

    for (const termData of termRecords) {
      // Escape regex characters from the term (add "\" before special characters)
      const termRegex = termData.term
        .toLowerCase()
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
      const termRx = new RegExp(`(^|[^a-zA-Z0-9])${termRegex}($|[^a-zA-Z0-9])`);
      if (termRx.test(product.meta.name.toLowerCase())) {
        results.blocklistTerms.push(termData);
      }
    }

    // get blocked parents
    results.parents = await this.getBlockedParents(product, parentProduct);

    /**
     * block product if it has blocked parent or blocked by term or manually blocked,
     * otherwise default is false. So if the product was manually renamed, it will be unblocked
     */
    if (results.blocklistTerms.length > 0 || results.parents.length > 0) {
      results.blocked = true;
    }
    if (product.isManuallyBlocked) {
      results.blocked = true;
    }
    return results;
  }

  /**
   * This method add necessary block reasons for directly related products during the ingestion process
   * Going downwards if the parent blocked -> the current product should be blocked.
   * Here are some weird cases tat could happened as well:
   * 1. Product Name "Boo Foo" is blocked by term "Foo" and "Boo"
   * 2. Rename it to "Moo" - all the reasons should be removed
   * 3. Rename it to "Boo" - Reason "Boo" should stay the same, but reason "Foo" should be updated
   * @param product
   * @param autoReviewResults
   * @param context
   */
  public async addDirectBlockReasons(
    product: Product,
    autoReviewResults: AutoReviewResults,
    isBlockStatusChanged: boolean,
    context: AuditContext,
  ) {
    /**
     * if it's a new product and it wasn't blocked - stopt the process
     * if it's an updated product - we need to check if it was blocked before
     * */
    if (!isBlockStatusChanged) return;

    // create a block action in pending state - our transaction record
    const blockActionDoc = {
      blocklistTermIds: _.isEmpty(autoReviewResults.blocklistTerms)
        ? null
        : autoReviewResults.blocklistTerms.map((t) => t.blocklistTermId),
      type: BlockActionBy.AutoReview,
      productId: product.productId,
      action: product.isBlocked ? BlockActionType.Add : BlockActionType.Remove,
      state: BlockActionState.Pending,
    } as BlockAction;
    const blockAction = await this.blocklistActionManager.create(
      blockActionDoc,
      context,
    );

    // 1. create block reasons by blocked parent products
    const productReasonsByBlockedParents = await this.getBlockReasonsBy(
      [product.productId],
      autoReviewResults.parents.map((parent) => parent.productId),
      blockAction,
    );

    // 2. get block reasons for terms
    const termsReasons = await this.getBlockReasonsBy(
      [product.productId],
      autoReviewResults.blocklistTerms,
      blockAction,
    );

    // if we unblocking this, check that there is no leftover reasons
    const leftoverReasonsToRemove = [];
    if (blockActionDoc.action === BlockActionType.Remove) {
      const allTermsReasonsByProduct = (
        await this.blocklistReasonManager.getBlockReasons({
          productId: product.productId.toString(),
        })
      ).data;
      const reasonsToUpdate = allTermsReasonsByProduct.map((reason) => ({
        ...reason,
        isActive: false,
      }));
      leftoverReasonsToRemove.push(...reasonsToUpdate);
    }

    // 3. get direct child products that should be blocked by the current product
    const batchForChildren = await this.getBlockReasonsForBlockedDescendant(
      [product],
      blockAction,
    );

    // 4. update / create reasons - we already updated the parent product at this point
    await this.runBatchAndPublish(
      {
        products: [...batchForChildren.products],
        creates: [
          ..._.concat(
            termsReasons.creates,
            productReasonsByBlockedParents.creates,
            batchForChildren.creates,
          ),
        ],
        updates: [
          ..._.concat(
            termsReasons.updates,
            productReasonsByBlockedParents.updates,
            batchForChildren.updates,
            ...leftoverReasonsToRemove,
          ),
        ],
      },
      blockAction,
    );

    // if not artist - we are done, so just update the action
    // if (product.productTypeId !== ProductTypeIds.Artist || legacyToggle) {
    if (
      product.productTypeId !== ProductTypeIds.Artist ||
      (this.appConfig.autoReviewV2DateSwitch &&
        new Date(this.appConfig.autoReviewV2DateSwitch) >
          new Date(blockAction.udate))
    ) {
      await this.blocklistActionManager.updateBlockAction(
        blockAction.blockActionId,
        { state: BlockActionState.Applied },
        context,
      );
      return;
    }
    // if artist publish action to LIE to check related products
    await this.blocklistActionManager.publishBlocklistAction(blockAction);
  }

  /**
   * This method will find / prepare for creation all the reasons for the block action
   * blockingEntities either products or terms
   * entitiesToBlock always a list of product ids
   * @param product
   * @param parentProductIds
   * @param blockAction
   * @returns
   */
  private async getBlockReasonsBy(
    entitiesToBlock: number[], // product to block
    blockingEntities: number[] | BlocklistTerm[], // products or terms to block by
    blockAction: BlockAction,
  ): Promise<BlockReasonsBatch> {
    const blockBatch: BlockReasonsBatch = {
      [BatchBlockReasonTypes.Creates]: [],
      [BatchBlockReasonTypes.Updates]: [],
    };
    if (blockingEntities.length === 0 || entitiesToBlock.length === 0) {
      return blockBatch;
    }

    await Bluebird.map(
      blockingEntities,
      async (blockingEntity: number | BlocklistTerm) => {
        await Promise.all(
          entitiesToBlock.map(async (entityToBlock) => {
            // check the blocking entity type to decide what to do
            const options: BlockReasonConstruct = {
              productId: entityToBlock,
              blockAction,
            };

            if (typeof blockingEntity === 'number') {
              options['blockedByProduct'] = blockingEntity;
            } else {
              options['termData'] = blockingEntity;
            }

            const blockReason: BlockReason =
              await this.blocklistReasonManager.getOrConstructBlockReason(
                options,
              );
            const reason = this.markAsUpdateCreateBlockReason(
              blockReason,
              blockAction,
            );
            const key = Object.keys(reason)[0] as BatchBlockReasonTypes;
            blockBatch[key].push(reason[key]);
          }),
        );
      },
      { concurrency: this.mainConcurrency },
    );
    return blockBatch;
  }
}

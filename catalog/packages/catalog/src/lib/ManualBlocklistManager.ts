import { SvSecurityContext } from '@securustablets/libraries.httpsecurity';
import { Logger } from '@securustablets/libraries.logging';
import { Inject, Singleton } from 'typescript-ioc';
import {
  BlockAction,
  BlockActionBy,
  BlockActionState,
  BlockActionType,
  LegacyAdditionalData,
  ManuallyBlockedReason,
} from '../controllers/models/BlockAction';
import { PricedProduct } from '../controllers/models/Product';
import { BlockActionDao } from '../data/PGCatalog/BlockActionDao';
import { BlocklistActionManager } from './BlocklistActionManager';
import { BlocklistReasonManager } from './BlocklistReasonManager';
import { ProductManager } from './ProductManager';

@Singleton
export class ManualBlocklistManager {
  @Inject
  private readonly logger!: Logger;
  @Inject
  private readonly blockActionDao!: BlockActionDao;
  @Inject
  private readonly blocklistActionManager!: BlocklistActionManager;
  @Inject
  private readonly productManager!: ProductManager;
  @Inject
  private readonly blocklistReasonManager!: BlocklistReasonManager;

  public async manualBlocklistProduct(
    product: PricedProduct,
    isBlocked: boolean,
    securityContext: SvSecurityContext,
    manuallyBlockedReason?: ManuallyBlockedReason,
  ): Promise<void> {
    // Create a block action for the product - our transaction record
    const blockAction = await this.createBlockActionByProduct(
      product,
      isBlocked,
      securityContext,
      manuallyBlockedReason,
    );

    const legacyAdditionalData: LegacyAdditionalData = {
      productTypeId: product.productTypeId,
      vendorProductId: product.source.vendorProductId,
    };
    await this.blocklistActionManager.notifyLegacySystem(
      blockAction,
      legacyAdditionalData,
    );
    this.logger.info(
      `Manual blocklist product ${product.productId} to ${isBlocked}`,
    );

    // add all reasons for the block inline
    const blockReason =
      await this.blocklistReasonManager.getOrConstructBlockReason({
        productId: product.productId,
        isManuallyBlocked: true,
        blockAction,
      });

    blockReason.blockReasonId
      ? await this.blocklistReasonManager.updateBlockReason(
          blockReason.blockReasonId,
          blockReason,
          securityContext,
        )
      : await this.blocklistReasonManager.createBlockReason(
          blockReason,
          securityContext,
        );

    // all the related child blocks will be done as part of auto-review
    await this.productManager.updateProduct(
      { ...product, isManuallyBlocked: isBlocked },
      securityContext,
    );

    // artist will be handle as part of auto review, so we can close this action
    await this.blockActionDao.update(
      blockAction.blockActionId,
      { state: BlockActionState.Applied },
      securityContext,
    );
    return;
  }

  private async createBlockActionByProduct(
    product: PricedProduct,
    isBlocked: boolean,
    securityContext: SvSecurityContext,
    manuallyBlockedReason?: ManuallyBlockedReason,
  ) {
    let blockAction = {
      type: BlockActionBy.Product,
      productId: product.productId,
      action: isBlocked ? BlockActionType.Add : BlockActionType.Remove,
      state: BlockActionState.Pending,
    } as BlockAction;
    if (isBlocked) {
      blockAction.manuallyBlockedReason = manuallyBlockedReason;
    }
    blockAction = await this.blockActionDao.createAndRetrieve(
      blockAction,
      securityContext,
    );
    return blockAction;
  }
}

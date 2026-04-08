import { Inject, Singleton } from 'typescript-ioc';
import { BlockActionType } from '../controllers/models/BlockAction';
import {
  BlockReason,
  BlockReasonConstruct,
} from '../controllers/models/BlockReason';
import { BlockReasonDao } from '../data/PGCatalog/BlockReasonDao';

@Singleton
export class BlocklistReasonManager {
  @Inject
  private readonly blockReasonDao!: BlockReasonDao;

  public getBlockReason = this.blockReasonDao.findOneOrFail;
  public getBlockReasons = this.blockReasonDao.findByQueryString;
  public updateBlockReason = this.blockReasonDao.update;
  public createBlockReason = this.blockReasonDao.create;

  /**
   * This method will generate a Block Reason depends on provided data
   * @param productId
   * @param blockAction
   * @param blockedByProduct
   * @param termData
   * @returns
   */
  public constructBlockReason(data: BlockReasonConstruct): BlockReason {
    return {
      productId: data.productId,
      blockActionId: data.blockAction?.blockActionId,
      blockedByProduct: data.blockedByProduct,
      termId: data.termData?.blocklistTermId,
      term: data.termData?.term,
      manuallyBlockedReason: data.blockAction?.manuallyBlockedReason,
      isManuallyBlocked: data.isManuallyBlocked,
      isActive: data.blockAction
        ? data.blockAction.action === BlockActionType.Add
        : true,
    };
  }

  /**
   * Find a block reason based on block criteria
   * Possible use cases:
   *  BlockReason fields to check: [productId, term, isManuallyBlocked, blockedByProduct]
   *      [productId, null, true, null] = Product manually blocked
   *      [productId, 'notnull', null, null] = Product term blocked
   *      [productId, null, null, parentProductId] = Product blocked by parent
   *
   * Application checks enforce uniqueness across these criteria with the use of this function,
   *    so only one result will be expected and returned
   * Will return undefined if not found
   */
  public async findBlockReason(
    blockReason: BlockReason,
  ): Promise<BlockReason | undefined> {
    return (
      await this.blockReasonDao.find({
        by: {
          productId: blockReason.productId,
          ...(blockReason.termId && { termId: blockReason.termId }),
          ...(blockReason.isManuallyBlocked && {
            isManuallyBlocked: blockReason.isManuallyBlocked,
          }),
          ...(blockReason.blockedByProduct && {
            blockedByProduct: blockReason.blockedByProduct,
          }),
        },
      })
    )[0];
  }

  public async getOrConstructBlockReason(
    options: BlockReasonConstruct,
  ): Promise<BlockReason> {
    const reason: BlockReason = this.constructBlockReason(options);
    const existingBlock = await this.findBlockReason(reason);
    if (existingBlock) {
      return existingBlock;
    } else {
      return reason;
    }
  }
}

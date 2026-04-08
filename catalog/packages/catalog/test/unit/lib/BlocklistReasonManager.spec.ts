import { expect } from 'chai';
import * as sinon from 'sinon';
import { Product } from '../../../db/reference/Product';
import { ManuallyBlockedReason } from '../../../src/controllers/models/BlockAction';
import { BlockReason } from '../../../src/controllers/models/BlockReason';
import { BlocklistReasonManager } from '../../../src/lib/BlocklistReasonManager';
import { ModelFactory } from '../../utils/ModelFactory';

describe('BlocklistReasonManager - unit', () => {
  let manager: BlocklistReasonManager;
  let blockReasonDaoMock: sinon.SinonMock;

  beforeEach(() => {
    manager = new BlocklistReasonManager();
    blockReasonDaoMock = sinon.mock((manager as any).blockReasonDao);
  });

  describe('constructBlockReason', () => {
    let child1: Product;
    let child2: Product;
    let product: Product;
    beforeEach(() => {
      child1 = ModelFactory.product({ productTypeGroupId: 'music' });
      child2 = ModelFactory.product({ productTypeGroupId: 'music' });
      const childProductIds = [child1.productId, child2.productId];
      product = ModelFactory.product({
        productTypeGroupId: 'music',
        meta: { name: 'Purple People eater' },
        childProductIds,
      });
    });
    it('should return a block reason for ato-review', async () => {
      const blockReasonChild2: BlockReason = {
        productId: child2.productId,
        blockedByProduct: product.productId,
        isManuallyBlocked: undefined,
        isActive: true,
        blockActionId: undefined,
        term: undefined,
        termId: undefined,
        manuallyBlockedReason: undefined,
      };

      const result = await manager.constructBlockReason({
        productId: child2.productId,
        blockedByProduct: product.productId,
      });
      expect(result).to.deep.equal(blockReasonChild2);
    });
    it('should return a block reason for manual block', async () => {
      const blockAction = ModelFactory.blockAction({
        manuallyBlockedReason: ManuallyBlockedReason.Explicit,
      });
      const blockReasonChild2: BlockReason = {
        productId: child2.productId,
        blockedByProduct: product.productId,
        isManuallyBlocked: true,
        isActive: true,
        blockActionId: blockAction.blockActionId,
        term: undefined,
        termId: undefined,
        manuallyBlockedReason: blockAction.manuallyBlockedReason,
      };

      const result = await manager.constructBlockReason({
        productId: child2.productId,
        blockedByProduct: product.productId,
        blockAction,
        isManuallyBlocked: true,
      });
      expect(result).to.deep.equal(blockReasonChild2);
    });
    it('should return a block reason for term block', async () => {
      const blockAction = ModelFactory.blockAction({
        manuallyBlockedReason: ManuallyBlockedReason.Explicit,
      });
      const blockTerm = ModelFactory.blocklistTerm();

      const blockReasonChild2: BlockReason = {
        productId: child2.productId,
        blockedByProduct: product.productId,
        isManuallyBlocked: undefined,
        isActive: true,
        blockActionId: blockAction.blockActionId,
        term: blockTerm.term,
        termId: blockTerm.blocklistTermId,
        manuallyBlockedReason: blockAction.manuallyBlockedReason,
      };

      const result = await manager.constructBlockReason({
        productId: child2.productId,
        blockedByProduct: product.productId,
        blockAction,
        termData: blockTerm,
      });
      expect(result).to.deep.equal(blockReasonChild2);
    });
  });

  describe('findBlockReason', () => {
    const productId = 24601;
    it('should call the dao fbqs method for a term blockAction query', async () => {
      const termBlockReason = ModelFactory.blockReason({
        termId: 123,
        term: 'xerox',
        productId,
      });
      blockReasonDaoMock
        .expects('find')
        .withExactArgs({
          by: {
            productId,
            termId: termBlockReason.termId,
          },
        })
        .resolves({ data: [] });
      await manager.findBlockReason(termBlockReason);
      blockReasonDaoMock.verify();
    });
    it('should call the dao fbqs method for a blockedByParent blockAction query', async () => {
      const manualBlockReason = ModelFactory.blockReason({
        isManuallyBlocked: true,
        productId,
      });
      delete manualBlockReason.term;
      blockReasonDaoMock
        .expects('find')
        .withExactArgs({
          by: {
            productId,
            isManuallyBlocked: true,
          },
        })
        .resolves({ data: [] });
      await manager.findBlockReason(manualBlockReason);
      blockReasonDaoMock.verify();
    });
    it('should call the dao fbqs method for a manual blockAction query', async () => {
      const parentBlockReason = ModelFactory.blockReason({
        blockedByProduct: 42,
        productId,
      });
      delete parentBlockReason.term;
      blockReasonDaoMock
        .expects('find')
        .withExactArgs({
          by: {
            productId,
            blockedByProduct: parentBlockReason.blockedByProduct,
          },
        })
        .resolves({ data: [] });
      await manager.findBlockReason(parentBlockReason);
      blockReasonDaoMock.verify();
    });
  });
});

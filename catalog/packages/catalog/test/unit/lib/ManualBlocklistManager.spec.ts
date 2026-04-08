import { CorpJwt } from '@securustablets/libraries.httpsecurity';
import { JsonSchemaParser } from '@securustablets/libraries.json-schema';
import { _ } from '@securustablets/libraries.utils';
import * as sinon from 'sinon';
import { Product } from '../../../db/reference/Product';
import {
  BlockAction,
  BlockActionBy,
  BlockActionState,
  BlockActionType,
  ManuallyBlockedReason,
} from '../../../src/controllers/models/BlockAction';
import { ManualBlocklistManager } from '../../../src/lib/ManualBlocklistManager';
import { fakeGetSchemaForInterface } from '../../utils/FakeGetSchemaForInterface';
import { ModelFactory } from '../../utils/ModelFactory';

const securityContext = {
  corpJwt: {
    username: 'test',
  } as CorpJwt,
};

describe('ManualBlocklistManager - unit', () => {
  let manager: ManualBlocklistManager;
  let mockBlockActionDao: sinon.SinonMock;
  let mockProductManager: sinon.SinonMock;
  let mockBlocklistActionManager: sinon.SinonMock;
  let mockBlocklistReasonManager: sinon.SinonMock;

  beforeEach(() => {
    const stubGetSchemaForInterface = sinon.stub(
      JsonSchemaParser,
      'getSchemaForInterface',
    );
    stubGetSchemaForInterface.callsFake(fakeGetSchemaForInterface);
    manager = new ManualBlocklistManager();
    mockBlockActionDao = sinon.mock((manager as any).blockActionDao);
    mockBlocklistActionManager = sinon.mock(
      (manager as any).blocklistActionManager,
    );
    mockProductManager = sinon.mock((manager as any).productManager);
    mockBlocklistReasonManager = sinon.mock(
      (manager as any).blocklistReasonManager,
    );
  });

  afterEach(() => {
    sinon.restore();
  });

  const addTestMocks = (
    blockAction: BlockAction,
    product: Product,
    create = true,
  ) => {
    const blockReason = ModelFactory.blockReason({
      productId: blockAction.productId,
    });
    create
      ? (blockReason.blockReasonId = undefined)
      : (blockReason.blockReasonId = 1);
    const block = blockAction.action === BlockActionType.Add;
    mockBlockActionDao
      .expects('createAndRetrieve')
      .withExactArgs(blockAction, securityContext)
      .resolves(_.mergeWith(_.clone(blockAction), { blockActionId: 1 }));
    mockBlocklistActionManager
      .expects('notifyLegacySystem')
      .withExactArgs(sinon.match(blockAction), {
        productTypeId: product.productTypeId,
        vendorProductId: product.source.vendorProductId,
      })
      .once()
      .resolves();
    mockBlocklistReasonManager
      .expects('getOrConstructBlockReason')
      .once()
      .resolves(blockReason);
    create
      ? mockBlocklistReasonManager.expects('createBlockReason').once()
      : mockBlocklistReasonManager.expects('updateBlockReason').once();
    mockProductManager
      .expects('updateProduct')
      .withArgs({ ...product, isManuallyBlocked: block }, securityContext)
      .once()
      .resolves();
  };

  describe('manualBlocklistProduct', () => {
    it('should unblock product already blocked product', async () => {
      const product = ModelFactory.pricedProduct({
        productId: 1,
        subscribable: true,
        source: {
          vendorName: 'AudibleMagic',
          vendorProductId: '12345',
          productTypeId: 'track',
        },
        productTypeId: 'track',
        isBlocked: true,
        isManuallyBlocked: true,
      });
      const blockAction = ModelFactory.blockAction({
        type: BlockActionBy.Product,
        productId: product.productId,
        action: BlockActionType.Remove,
        state: BlockActionState.Pending,
      });
      addTestMocks(blockAction, product, false);
      // for non artist should just update the block action
      mockBlockActionDao
        .expects('update')
        .withExactArgs(1, { state: BlockActionState.Applied }, securityContext)
        .resolves();

      await manager.manualBlocklistProduct(product, false, securityContext);
      sinon.verify();
    });

    it('should block product not blocked artist and create LIE', async () => {
      const product = ModelFactory.pricedProduct({
        productId: 1,
        subscribable: true,
        source: {
          vendorName: 'AudibleMagic',
          vendorProductId: '12345',
          productTypeId: 'track',
        },
        productTypeId: 'artist',
        isBlocked: false,
        isManuallyBlocked: false,
      });

      const blockAction = ModelFactory.blockAction({
        type: BlockActionBy.Product,
        productId: product.productId,
        action: BlockActionType.Add,
        state: BlockActionState.Pending,
        manuallyBlockedReason: ManuallyBlockedReason.Explicit,
      });
      addTestMocks(blockAction, product);

      mockBlockActionDao.expects('update').atLeast(1).resolves();
      await manager.manualBlocklistProduct(
        product,
        true,
        securityContext,
        ManuallyBlockedReason.Explicit,
      );
      sinon.verify();
    });
  });
});

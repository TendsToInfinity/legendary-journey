import { _ } from '@securustablets/libraries.utils';
import * as Bluebird from 'bluebird';
import { expect } from 'chai';
import * as Sinon from 'sinon';
import { Container } from 'typescript-ioc';
import {
  BlockActionBy,
  BlockActionState,
  BlockActionType,
  ManuallyBlockedReason,
} from '../../../../src/controllers/models/BlockAction';
import { BlockReason } from '../../../../src/controllers/models/BlockReason';
import { ProductTypeIds } from '../../../../src/controllers/models/Product';
import { BlockActionDao } from '../../../../src/data/PGCatalog/BlockActionDao';
import { BlocklistTermDao } from '../../../../src/data/PGCatalog/BlocklistTermDao';
import { ProductDao } from '../../../../src/data/PGCatalog/ProductDao';
import { ProductManager } from '../../../../src/lib/ProductManager';
import { BlocklistLie } from '../../../../src/messaging/lie/BlocklistLie';
import { AppConfig } from '../../../../src/utils/AppConfig';
import { ModelFactory } from '../../../utils/ModelFactory';
import * as client from '../../../utils/client';
import { IntegrationTestSuite } from '../../IntegrationTestSuite';
import '../../global.spec';

describe('BlocklistLie - Integration', function () {
  IntegrationTestSuite.setUp(this, { openSearch: true, cache: true });
  let blocklistLie: BlocklistLie;
  let blocklistTermDao: BlocklistTermDao;
  let blockActionDao: BlockActionDao;
  let productDao: ProductDao;
  let productManager: ProductManager;

  const context = { apiKey: 'test' };

  beforeEach(async () => {
    blocklistLie = new BlocklistLie();
    blocklistTermDao = new BlocklistTermDao();
    blockActionDao = new BlockActionDao();
    productDao = new ProductDao();
    productManager = new ProductManager();
  });

  const createTermAndAction = async (
    type: BlockActionBy,
    term: string,
    productTypeGroupId: string,
    productId?: number,
    manuallyBlockedReason?: ManuallyBlockedReason,
  ) => {
    const blocklistTermDoc = ModelFactory.blocklistTerm({
      term,
      productTypeGroupId,
    });
    const blocklistTerm = await blocklistTermDao.createAndRetrieve(
      blocklistTermDoc,
      ModelFactory.auditContext(),
    );

    const blockActionDoc = ModelFactory.blockAction({
      blocklistTermIds: [blocklistTerm.blocklistTermId],
      state: BlockActionState.Pending,
      action: BlockActionType.Add,
      type,
      productId,
      manuallyBlockedReason,
    });
    const blockAction = await blockActionDao.createAndRetrieve(
      blockActionDoc,
      ModelFactory.auditContext(),
    );

    return { blocklistTerm, blockAction };
  };

  const addArtistAlbumTrackCombo = async (options: {
    vendorArtistId: string;
    vendorName: string;
    artistBlock?: boolean;
  }) => {
    const vendorArtistId = options.vendorArtistId;
    const vendorName = options.vendorName;
    const artistBlocked = options.artistBlock ?? true;
    const childProduct = ModelFactory.product({
      source: {
        vendorParentProductId: 'vpi1',
        vendorArtistId: 'notTheVendorArtistId',
        vendorName,
      },
      childProductIds: [],
      productTypeId: ProductTypeIds.Track,
      productTypeGroupId: 'music',
    });
    const childId = await productDao.create(childProduct, context);

    const parentProduct = ModelFactory.product({
      productId: 1,
      source: { vendorProductId: 'vpi2', vendorArtistId, vendorName },
      childProductIds: [childId],
      productTypeId: ProductTypeIds.Album,
      productTypeGroupId: 'music',
    });
    const parentId = await productDao.create(parentProduct, context);
    await productDao.update(
      childId,
      { ...childProduct, parentProductId: parentId },
      context,
    );

    const artistProduct = ModelFactory.product({
      source: {
        vendorProductId: vendorArtistId,
        vendorName,
      },
      isBlocked: artistBlocked,
      productTypeId: ProductTypeIds.Artist,
      meta: { name: 'purple people eater' },
      productTypeGroupId: 'music',
    });
    const artist = await productDao.createAndRetrieve(artistProduct, context);
    return { artistId: artist.productId, parentId, childId };
  };

  describe('Main handler - blockActionProcessHandler ', () => {
    it('should process block by term', async () => {
      const { blocklistTerm, blockAction } = await createTermAndAction(
        BlockActionBy.Terms,
        'Purple',
        'music',
      );

      const badProductChildDoc = ModelFactory.product({
        productTypeGroupId: 'music',
        productTypeId: ProductTypeIds.Track,
      });
      const badProductChildId = await productDao.create(
        badProductChildDoc,
        context,
      );
      const badProductId = await productDao.create(
        ModelFactory.product({
          meta: { name: 'Purple people eater' },
          childProductIds: [badProductChildId],
          source: {
            vendorProductId: badProductChildDoc.source.vendorProductId,
            vendorName: badProductChildDoc.source.vendorName,
          },
          productTypeGroupId: 'music',
          productTypeId: ProductTypeIds.Album,
        }),
        context,
      );
      const productId1 = await productDao.create(
        ModelFactory.product({
          isBlocked: false,
          meta: { name: 'Im a good guy' },
          productTypeGroupId: 'music',
          productTypeId: ProductTypeIds.Track,
        }),
        context,
      );

      await blocklistLie.blockActionProcessHandler('test', blockAction);

      const badProductResult = await productManager.findOneByProductIdOrFail(
        badProductId,
        true,
      );
      const goodProductResult = await productManager.findOneByProductIdOrFail(
        productId1,
        false,
      );

      // parent and child should be blocked
      expect(badProductResult.isBlocked).to.be.true;
      expect(badProductResult.childProducts[0].isBlocked).to.be.true;
      // good product should be skipped
      expect(goodProductResult.isBlocked).to.be.false;

      // verify block reasons
      const blockReasons = await client.fbqsBlockReasons({});
      expect(blockReasons.data.length).to.equal(2);
      const parentBlock = _.find(blockReasons.data, {
        productId: badProductId,
      });
      const expectedParentReason: BlockReason = {
        productId: badProductId,
        isActive: true,
        term: 'Purple',
        blockedByProduct: null,
        isManuallyBlocked: null,
        manuallyBlockedReason: null,
        blockActionId: blockAction.blockActionId,
        termId: blocklistTerm.blocklistTermId,
      };
      expect(
        _.omit(parentBlock, 'blockReasonId', 'cdate', 'udate'),
      ).to.deep.equal(expectedParentReason);

      const childBlock = _.find(blockReasons.data, {
        productId: badProductChildId,
      });
      const expectedChildReason: BlockReason = {
        productId: badProductChildId,
        isActive: true,
        term: null,
        blockedByProduct: badProductId,
        isManuallyBlocked: null,
        manuallyBlockedReason: null,
        blockActionId: blockAction.blockActionId,
        termId: null,
      };
      expect(
        _.omit(childBlock, 'blockReasonId', 'cdate', 'udate'),
      ).to.deep.equal(expectedChildReason);
    });
    it('should process block by term word boundaries', async () => {
      const { blockAction } = await createTermAndAction(
        BlockActionBy.Terms,
        'Purple',
        'movie',
      );

      // Test word boundaries at ^, $, and mid
      const badProducts = await Promise.all([
        productDao.create(
          ModelFactory.product({ meta: { name: 'Purple people eater' } }),
          context,
        ),
        productDao.create(
          ModelFactory.product({ meta: { name: 'green people purple' } }),
          context,
        ),
        productDao.create(
          ModelFactory.product({ meta: { name: 'yellow purple eater' } }),
          context,
        ),
      ]);

      // Test word boundaries at ^, $, and mid
      const goodProducts = await Promise.all([
        productDao.create(
          ModelFactory.product({ meta: { name: 'PurpleX people eater' } }),
          context,
        ),
        productDao.create(
          ModelFactory.product({ meta: { name: 'green people Xpurple' } }),
          context,
        ),
        productDao.create(
          ModelFactory.product({ meta: { name: 'yellow purpleX eater' } }),
          context,
        ),
      ]);

      await blocklistLie.blockActionProcessHandler('test', blockAction);

      for (const badProduct of badProducts) {
        const badProductResult = await productManager.findOneByProductIdOrFail(
          badProduct,
          true,
        );
        expect(badProductResult.isBlocked).to.be.true;
      }
      for (const goodProduct of goodProducts) {
        const goodProductResult = await productManager.findOneByProductIdOrFail(
          goodProduct,
          true,
        );
        expect(goodProductResult.isBlocked).to.be.undefined;
      }
    });
    it('should process block by term $sep$', async () => {
      const { blocklistTerm, blockAction } = await createTermAndAction(
        BlockActionBy.Terms,
        '$sep$',
        'movie',
      );

      const badProductChildId = await productDao.create(
        ModelFactory.product(),
        context,
      );
      const badProductId = await productDao.create(
        ModelFactory.product({
          meta: { name: '$sep$ hack me' },
          childProductIds: [badProductChildId],
        }),
        context,
      );

      await blocklistLie.blockActionProcessHandler('test', blockAction);

      const badProductResult = await productManager.findOneByProductIdOrFail(
        badProductId,
        true,
      );

      // parent and child should be blocked
      expect(badProductResult.isBlocked).to.be.true;
      expect(badProductResult.childProducts[0].isBlocked).to.be.true;

      // verify block reasons
      const blockReasons = await client.fbqsBlockReasons({});
      expect(blockReasons.data.length).to.equal(2);
      const parentBlock = _.find(blockReasons.data, {
        productId: badProductId,
      });
      const expectedParentReason: BlockReason = {
        productId: badProductId,
        isActive: true,
        term: '$sep$',
        blockedByProduct: null,
        isManuallyBlocked: null,
        manuallyBlockedReason: null,
        blockActionId: blockAction.blockActionId,
        termId: blocklistTerm.blocklistTermId,
      };
      expect(
        _.omit(parentBlock, 'blockReasonId', 'cdate', 'udate'),
      ).to.deep.equal(expectedParentReason);

      const childBlock = _.find(blockReasons.data, {
        productId: badProductChildId,
      });
      const expectedChildReason: BlockReason = {
        productId: badProductChildId,
        isActive: true,
        term: null,
        blockedByProduct: badProductId,
        isManuallyBlocked: null,
        manuallyBlockedReason: null,
        blockActionId: blockAction.blockActionId,
        termId: null,
      };
      expect(
        _.omit(childBlock, 'blockReasonId', 'cdate', 'udate'),
      ).to.deep.equal(expectedChildReason);
    });
    it('should process block by term and unblock if the term was disabled', async () => {
      const { blocklistTerm, blockAction } = await createTermAndAction(
        BlockActionBy.Terms,
        'a$$',
        'movie',
      );

      const badProductChildId = await productDao.create(
        ModelFactory.product(),
        context,
      );
      const badProductId = await productDao.create(
        ModelFactory.product({
          meta: { name: 'a$$ and elbows' },
          childProductIds: [badProductChildId],
        }),
        context,
      );

      await blocklistLie.blockActionProcessHandler('test', blockAction);

      const badProductResult = await productManager.findOneByProductIdOrFail(
        badProductId,
        true,
      );

      // parent and child should be blocked
      expect(badProductResult.isBlocked).to.be.true;
      expect(badProductResult.childProducts[0].isBlocked).to.be.true;

      // verify block reasons
      const blockReasons = await client.fbqsBlockReasons({});
      expect(blockReasons.data.length).to.equal(2);
      const parentBlock = _.find(blockReasons.data, {
        productId: badProductId,
      });
      const expectedParentReason: BlockReason = {
        productId: badProductId,
        isActive: true,
        term: 'a$$',
        blockedByProduct: null,
        isManuallyBlocked: null,
        manuallyBlockedReason: null,
        blockActionId: blockAction.blockActionId,
        termId: blocklistTerm.blocklistTermId,
      };
      expect(
        _.omit(parentBlock, 'blockReasonId', 'cdate', 'udate'),
      ).to.deep.equal(expectedParentReason);

      const childBlock = _.find(blockReasons.data, {
        productId: badProductChildId,
      });
      const expectedChildReason: BlockReason = {
        productId: badProductChildId,
        isActive: true,
        term: null,
        blockedByProduct: badProductId,
        isManuallyBlocked: null,
        manuallyBlockedReason: null,
        blockActionId: blockAction.blockActionId,
        termId: null,
      };
      expect(
        _.omit(childBlock, 'blockReasonId', 'cdate', 'udate'),
      ).to.deep.equal(expectedChildReason);

      // mark the term as inactive and send the action
      await blocklistTermDao.setTermsStatus(
        [blocklistTerm.blocklistTermId],
        false,
      );
      const disabledAction = { ...blockAction, action: BlockActionType.Remove };
      const blockActionDisable = await blockActionDao.createAndRetrieve(
        disabledAction,
        ModelFactory.auditContext(),
      );

      await blocklistLie.blockActionProcessHandler('test', blockActionDisable);
      const blockReasonsDisabled = await client.fbqsBlockReasons({});

      // should be the same reasons, but disabled
      expect(blockReasonsDisabled.data[0].isActive).to.be.false;
      expect(blockReasonsDisabled.data[1].isActive).to.be.false;
    });
  });

  describe('Artist Blocks', () => {
    const vendorArtistId = 'vendorArtistId';
    const vendorName = 'vendorName';
    const productTypeGroupId = 'music';
    const date = new Date();
    this.afterEach(() => {
      Sinon.restore();
    });
    it('should block related products if an Artist goes through auto review and is blocked (legacy toggle, kill me)', async () => {
      const { artistId, parentId } = await addArtistAlbumTrackCombo({
        vendorArtistId,
        vendorName,
        artistBlock: false,
      });
      const { blockAction } = await createTermAndAction(
        BlockActionBy.AutoReview,
        'Purple',
        productTypeGroupId,
        artistId,
      );

      // date tomorrow for legacy
      const appConfig = Container.get(AppConfig);
      const appConfigGetStub = Sinon.stub(appConfig as any, 'get');
      const tomorrow = new Date(
        date.setDate(date.getDate() + 1),
      ).toLocaleString();
      appConfigGetStub
        .withArgs('autoReviewV2DateSwitch')
        .returns(tomorrow)
        .onFirstCall();
      appConfigGetStub.callThrough();

      await blocklistLie.blockActionProcessHandler(
        'blockaction_routingkey',
        blockAction,
      );

      const { data: blockReasons } = await client.fbqsBlockReasons({});
      expect(blockReasons.length).to.equal(3);
      const products = await productDao.find();

      // verify block reasons
      products.forEach((p) => {
        expect(p.isBlocked).to.equal(true);
        const reason = _.find(blockReasons, { productId: p.productId });
        if (p.productTypeId === ProductTypeIds.Artist) {
          expect(reason.termId).to.equal(blockAction.blocklistTermIds[0]);
        }
        if (p.productTypeId === ProductTypeIds.Album) {
          expect(reason.blockedByProduct).to.equal(artistId);
        }
        if (p.productTypeId === ProductTypeIds.Track) {
          expect(reason.blockedByProduct).to.equal(parentId);
        }
      });
    });

    it('should block related products if an Artist goes through auto review and is blocked', async () => {
      const { artistId, parentId } = await addArtistAlbumTrackCombo({
        vendorArtistId,
        vendorName,
        artistBlock: true,
      });
      const { blockAction } = await createTermAndAction(
        BlockActionBy.AutoReview,
        'Purple',
        productTypeGroupId,
        artistId,
      );

      // sinon date switch config to return old date
      await blocklistLie.blockActionProcessHandler(
        'blockaction_routingkey',
        blockAction,
      );

      const { data: blockReasons } = await client.fbqsBlockReasons({});
      expect(blockReasons.length).to.equal(2);
      const products = await productDao.find();

      // verify block reasons
      products.forEach((p) => {
        expect(p.isBlocked).to.equal(true);
        const reason = _.find(blockReasons, { productId: p.productId });
        if (p.productTypeId === ProductTypeIds.Album) {
          expect(reason.blockedByProduct).to.equal(artistId);
        }
        if (p.productTypeId === ProductTypeIds.Track) {
          expect(reason.blockedByProduct).to.equal(parentId);
        }
      });
    });
    it('should block all related products if an Artist goes through TermsBlock and is blocked', async () => {
      const { artistId, parentId } = await addArtistAlbumTrackCombo({
        vendorArtistId,
        vendorName,
        artistBlock: false,
      });
      const { blocklistTerm, blockAction } = await createTermAndAction(
        BlockActionBy.Terms,
        'Purple',
        productTypeGroupId,
      );

      await blocklistLie.blockActionProcessHandler(
        'blockaction_routingkey',
        blockAction,
      );

      const { data: blockReasons } = await client.fbqsBlockReasons({});
      expect(blockReasons.length).to.equal(3);
      const products = await productDao.find();

      // verify block reasons
      products.forEach((p) => {
        expect(p.isBlocked).to.equal(true);
        const reason = _.find(blockReasons, { productId: p.productId });
        if (p.productTypeId === ProductTypeIds.Artist) {
          expect(reason.termId).to.equal(blocklistTerm.blocklistTermId);
        }
        if (p.productTypeId === ProductTypeIds.Album) {
          expect(reason.blockedByProduct).to.equal(artistId);
        }
        if (p.productTypeId === ProductTypeIds.Track) {
          expect(reason.blockedByProduct).to.equal(parentId);
        }
      });
    });
    it('should block all related products if an Artist goes through ManualBlock and is blocked', async () => {
      const { artistId, parentId } = await addArtistAlbumTrackCombo({
        vendorArtistId,
        vendorName,
        artistBlock: true,
      });
      const { blockAction } = await createTermAndAction(
        BlockActionBy.Product,
        'Purple',
        productTypeGroupId,
        artistId,
        ManuallyBlockedReason.Explicit,
      );

      await blocklistLie.blockActionProcessHandler(
        'blockaction_routingkey',
        blockAction,
      );

      const { data: blockReasons } = await client.fbqsBlockReasons({});
      expect(blockReasons.length).to.equal(2);
      const products = await productDao.find();

      // verify block reasons
      products.forEach((p) => {
        expect(p.isBlocked).to.equal(true);
        const reason = _.find(blockReasons, { productId: p.productId });
        if (p.productTypeId === ProductTypeIds.Album) {
          expect(reason.blockedByProduct).to.equal(artistId);
        }
        if (p.productTypeId === ProductTypeIds.Track) {
          expect(reason.blockedByProduct).to.equal(parentId);
        }
      });
    });
    it('should block all products for an artist in batches of batchSize for termsAction', async function () {
      this.timeout(20000);

      const artistProduct = ModelFactory.product({
        source: {
          vendorProductId: vendorArtistId,
          vendorName,
        },
        productTypeId: ProductTypeIds.Artist,
        meta: { name: 'purple people eater' },
        productTypeGroupId,
      });
      await productDao.create(artistProduct, context);

      for (let x = 0; x <= 5; x++) {
        const children = Array(10)
          .fill(null)
          .map((i) =>
            ModelFactory.product({
              source: {
                vendorParentProductId: `vpid${x}`,
                vendorArtistId,
                vendorName,
              },
              childProductIds: [],
              productTypeId: ProductTypeIds.Track,
              productTypeGroupId,
            }),
          );
        const ids = [];
        const products = await Bluebird.map(children, async (i) => {
          const product = await productDao.createAndRetrieve(i, context);
          ids.push(product.productId);
          return product;
        });
        const parentProduct = ModelFactory.product({
          source: { vendorProductId: `vpid${x}`, vendorArtistId, vendorName },
          childProductIds: ids,
          productTypeId: ProductTypeIds.Album,
          productTypeGroupId,
        });
        const parentId = await productDao.create(parentProduct, context);
        await Bluebird.map(products, async (child) => {
          await productDao.update(
            child.productId,
            { ...child, parentProductId: parentId },
            context,
          );
        });
      }

      const { blockAction } = await createTermAndAction(
        BlockActionBy.Terms,
        'Purple',
        productTypeGroupId,
      );

      // set the batch size small for integration
      (blocklistLie as any).batchSize = 20;
      await blocklistLie.blockActionProcessHandler(
        'blockaction_routingkey',
        blockAction,
      );
      // reset the batch size
      (blocklistLie as any).batchSize = 500;
    });
  });
});

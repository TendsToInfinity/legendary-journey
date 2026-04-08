import { JsonSchemaParser } from '@securustablets/libraries.json-schema';
import { _ } from '@securustablets/libraries.utils';
import { expect } from 'chai';
import * as sinon from 'sinon';
import {
  BlockAction,
  BlockActionBy,
  BlockActionState,
  BlockActionType,
} from '../../../../src/controllers/models/BlockAction';
import { BlockReason } from '../../../../src/controllers/models/BlockReason';
import { BlocklistTerm } from '../../../../src/controllers/models/BlocklistTerm';
import {
  Product,
  ProductTypeIds,
} from '../../../../src/controllers/models/Product';
import { BlocklistReasonManager } from '../../../../src/lib/BlocklistReasonManager';
import { BlocklistLie } from '../../../../src/messaging/lie/BlocklistLie';
import { fakeGetSchemaForInterface } from '../../../utils/FakeGetSchemaForInterface';
import { ModelFactory } from '../../../utils/ModelFactory';

describe('BlocklistLie - Unit', () => {
  let blocklistLie: BlocklistLie;
  let mockBlocklistTermDao: sinon.SinonMock;
  let mockProductDao: sinon.SinonMock;
  let mockBlocklistActionManager: sinon.SinonMock;
  let mockBlocklistReasonManager: sinon.SinonMock;
  let mockParentProductManager: sinon.SinonMock;
  let productPublishManager: sinon.SinonMock;
  let mockBatchManager: sinon.SinonMock;
  let mockBlockListLie: sinon.SinonMock;
  let mockAppConfig: sinon.SinonMock;

  let blocklistReasonManager: BlocklistReasonManager;
  const termsBatch = 1000;
  const context = { apiKey: 'test' };
  const routingKey = 'blockAction.pending';

  const productTransform = {
    table: 'product',
    idColumn: 'product_id',
    idColumnToPropertyName: 'productId',
    transform: sinon.match.func,
    sql: sinon.match.func,
  };
  const blockReasonTransform = {
    table: 'block_reason',
    idColumn: 'block_reason_id',
    idColumnToPropertyName: 'blockReasonId',
    transform: sinon.match.func,
    sql: sinon.match.func,
  };

  beforeEach(() => {
    const stubGetSchemaForInterface = sinon.stub(
      JsonSchemaParser,
      'getSchemaForInterface',
    );
    stubGetSchemaForInterface.callsFake(fakeGetSchemaForInterface);
    blocklistLie = new BlocklistLie();
    mockBatchManager = sinon.mock((blocklistLie as any).batchManager);
    mockBlocklistTermDao = sinon.mock((blocklistLie as any).blocklistTermDao);
    mockProductDao = sinon.mock((blocklistLie as any).productDao);
    mockBlocklistActionManager = sinon.mock(
      (blocklistLie as any).blocklistActionManager,
    );
    blocklistReasonManager = new BlocklistReasonManager();
    mockBlocklistReasonManager = sinon.mock(
      (blocklistLie as any).blocklistReasonManager,
    );
    mockParentProductManager = sinon.mock(
      (blocklistLie as any).parentProductManager,
    );
    mockBlockListLie = sinon.mock(blocklistLie);
    mockAppConfig = sinon.mock((blocklistLie as any).appConfig);
    productPublishManager = sinon.mock(
      (blocklistLie as any).productPublishManager,
    );
  });

  afterEach(() => {
    sinon.restore();
  });

  const addTestProducts = (productName: string, addArtist = false) => {
    let artistProduct: Product | undefined;
    if (addArtist) {
      artistProduct = ModelFactory.product({
        productId: 100,
        productTypeId: ProductTypeIds.Artist,
        source: { vendorProductId: 'vendorArtistId' },
        isBlocked: false,
      });
    }

    const parentProduct = ModelFactory.product({
      productId: 1,
      productTypeId: ProductTypeIds.Album,
      meta: { name: productName },
      isBlocked: false,
      source: {
        artists: addArtist
          ? [
              {
                artistId: artistProduct!.productId,
                name: 'testArtist',
                vendorArtistId: 'vendorArtistId',
              },
            ]
          : [],
      },
    });
    // add some child products
    const childProducts: Product[] = [];
    for (let x = 0; x < 3; x++) {
      childProducts.push(
        ModelFactory.product({
          productId: x + 10,
          parentProductId: parentProduct.productId,
          productTypeId: ProductTypeIds.Track,
          isBlocked: false,
          source: {
            vendorParentProductId: parentProduct.source.vendorProductId,
          },
        }),
      );
    }
    parentProduct.childProductIds = _.map(childProducts, 'productId');

    return { parentProduct, childProducts, artistProduct };
  };

  const addTestBlockDataData = (
    parentProduct: Product,
    childProducts: Product[],
    type: BlockActionBy,
    action: BlockActionType,
    term?: string,
    productId?: number,
  ) => {
    let blocklistTerm: BlocklistTerm | undefined;
    if (type == BlockActionBy.Terms) {
      blocklistTerm = ModelFactory.blocklistTerm({
        term,
        blocklistTermId: 1,
      });
    }

    const blockAction = ModelFactory.blockAction({
      type,
      blocklistTermIds:
        type == BlockActionBy.Terms
          ? [blocklistTerm.blocklistTermId]
          : undefined,
      action,
      productId: type == BlockActionBy.Product ? productId : undefined,
      blockActionId: 1,
    });

    // reasons should be terms for the parent and parent for the children
    const blocklistReasons = [
      blocklistReasonManager.constructBlockReason({
        productId: parentProduct.productId,
        blockAction,
        termData: blocklistTerm,
        blockedByProduct: type == BlockActionBy.Product ? productId : undefined,
      }),
      ..._.map(childProducts, (p) =>
        blocklistReasonManager.constructBlockReason({
          productId: p.productId,
          blockAction,
          blockedByProduct: parentProduct.productId,
        }),
      ),
    ];
    return { blockAction, blocklistTerm, blocklistReasons };
  };

  const addTermsExpectation = (
    blocklistTerm: BlocklistTerm,
    blockAction: BlockAction,
    parentProduct: Product,
    termsBatchSize = termsBatch,
  ) => {
    // add extra term to check an empty product result
    const notMatchingTerm = 'booFoo';
    const notMatchingBlockTerm = ModelFactory.blocklistTerm({
      term: notMatchingTerm,
      blocklistTermId: 2,
    });

    const terms = [blocklistTerm, notMatchingBlockTerm];
    mockBlocklistTermDao
      .expects('find')
      .withExactArgs({ ids: blockAction.blocklistTermIds })
      .resolves(terms);

    mockProductDao
      .expects('findProductsByTerm')
      .withExactArgs(
        blocklistTerm.term,
        blocklistTerm.blocklistTermId,
        blocklistTerm.productTypeGroupId,
        blockAction.action,
        termsBatchSize,
      )
      .resolves([parentProduct]);

    // for batch test add the second call for the same term
    // if we provided a small bach to check the loop - this get expected
    if (terms.length != termsBatchSize && termsBatchSize != termsBatch) {
      mockProductDao
        .expects('findProductsByTerm')
        .withExactArgs(
          blocklistTerm.term,
          blocklistTerm.blocklistTermId,
          blocklistTerm.productTypeGroupId,
          blockAction.action,
          termsBatchSize,
        )
        .resolves([]);
    }

    // res
    mockProductDao
      .expects('findProductsByTerm')
      .withArgs(
        notMatchingBlockTerm.term,
        notMatchingBlockTerm.blocklistTermId,
        notMatchingBlockTerm.productTypeGroupId,
        blockAction.action,
        termsBatchSize,
      )
      .resolves([]);
  };

  const makeFancySinonMatch = (entities: any[]) => {
    const customMatch = sinon.match((value) => {
      return _.isEqual(
        _.sortBy(value, 'productId'),
        _.sortBy(entities, 'productId'),
      );
    });
    return customMatch;
  };

  const addUpdateAndPublishExpectation = (
    parentProduct: Product,
    childProducts: Product[],
    blocklistReasons: BlockReason[],
    blockAction: BlockAction,
    updateParentAndChildren = true,
  ) => {
    const descendantIds = _.map(childProducts, 'productId');
    mockProductDao
      .expects('findDescendantProductIds')
      .withExactArgs(parentProduct.productId)
      .resolves(descendantIds);

    mockProductDao
      .expects('find')
      .withArgs({ ids: descendantIds })
      .resolves(childProducts);

    mockBlocklistReasonManager
      .expects('findBlockReason')
      .atLeast(1)
      .resolves(undefined);

    addRunBatchExpectation(
      parentProduct,
      childProducts,
      { creates: blocklistReasons, updates: [] },
      blockAction,
      updateParentAndChildren,
    );
  };

  const addRunBatchExpectation = (
    parentProduct: Product,
    childProducts: Product[],
    batch: { updates: BlockReason[]; creates: BlockReason[] },
    blockAction: BlockAction,
    updateParentAndChildren = true,
  ) => {
    const allUpdatedProducts = updateParentAndChildren
      ? [parentProduct, ...childProducts]
      : childProducts;

    const sinonMatchUpdatedProducts = makeFancySinonMatch(allUpdatedProducts);
    const sinonMatchUpdatedBlockReasons = makeFancySinonMatch(batch.updates);
    const sinonMatchCreatedBlockReasons = makeFancySinonMatch(batch.creates);

    const batchArgs = [
      { entities: sinonMatchUpdatedProducts, transform: productTransform },
    ];
    if (batch.creates.length > 0) {
      batchArgs.push({
        entities: sinonMatchCreatedBlockReasons,
        transform: { ...blockReasonTransform },
      });
    }
    if (batch.updates.length > 0) {
      batchArgs.push({
        entities: sinonMatchUpdatedBlockReasons,
        transform: { ...blockReasonTransform },
      });
    }

    mockBatchManager
      .expects('runMultipleUpdates')
      .withArgs(batchArgs)
      .resolves();

    mockProductDao
      .expects('find')
      .withExactArgs({
        ids: sinon.match((ids) => {
          return (
            Array.isArray(ids) &&
            ids.length === allUpdatedProducts.map((p) => p.productId).length &&
            ids.every((id) =>
              allUpdatedProducts.map((p) => p.productId).includes(id),
            )
          );
        }),
      })
      .resolves(allUpdatedProducts);

    productPublishManager
      .expects('publishProductMessage')
      .atLeast(allUpdatedProducts.length)
      .resolves();

    mockBlocklistActionManager
      .expects('updateBlockAction')
      .withExactArgs(
        blockAction.blockActionId,
        { state: BlockActionState.Applied },
        sinon.match.any,
      )
      .resolves();
  };

  describe('blockActionProcessHandler - Terms', () => {
    it('blocks by terms with child products with batch update', async () => {
      const term = 'badTerm';
      const { parentProduct, childProducts } = addTestProducts(term, false);
      const { blockAction, blocklistTerm, blocklistReasons } =
        addTestBlockDataData(
          parentProduct,
          childProducts,
          BlockActionBy.Terms,
          BlockActionType.Add,
          term,
        );
      addTermsExpectation(blocklistTerm, blockAction, parentProduct, 1);
      addUpdateAndPublishExpectation(
        parentProduct,
        childProducts,
        blocklistReasons,
        blockAction,
      );

      // there is no artists - no extra call
      mockProductDao.expects('findProductsByArtist').never();

      (blocklistLie as any).batchSize = 1;
      await blocklistLie.blockActionProcessHandler(routingKey, blockAction);
      sinon.verify();
    });
    it('blocks a product by terms when there are no childProducts', async () => {
      const term = 'badTerm';
      const { parentProduct, childProducts } = addTestProducts(term, false);
      const { blockAction, blocklistTerm, blocklistReasons } =
        addTestBlockDataData(
          parentProduct,
          childProducts,
          BlockActionBy.Terms,
          BlockActionType.Add,
          term,
        );
      addTermsExpectation(blocklistTerm, blockAction, parentProduct, 2);

      mockProductDao
        .expects('findDescendantProductIds')
        .withExactArgs(parentProduct.productId)
        .resolves([]);

      mockProductDao.expects('find').never();

      mockBlocklistReasonManager
        .expects('findBlockReason')
        .atLeast(1)
        .resolves(undefined);

      const blockReasonTermForParent = blocklistReasons.filter(
        (reason) => reason.productId === parentProduct.productId,
      );
      addRunBatchExpectation(
        parentProduct,
        [],
        { creates: blockReasonTermForParent, updates: [] },
        blockAction,
        true,
      );

      // there is no artists - no extra call
      mockProductDao.expects('findProductsByArtist').never();

      (blocklistLie as any).batchSize = 2;
      await blocklistLie.blockActionProcessHandler(routingKey, blockAction);
      sinon.verify();
    });
    it('unblock when term is removed', async () => {
      const term = 'badTerm';
      const { parentProduct, childProducts } = addTestProducts(term, false);
      const { blockAction, blocklistTerm, blocklistReasons } =
        addTestBlockDataData(
          parentProduct,
          childProducts,
          BlockActionBy.Terms,
          BlockActionType.Remove,
          term,
        );

      parentProduct.isBlocked = true;
      childProducts.forEach((p) => (p.isBlocked = true));

      addTermsExpectation(blocklistTerm, blockAction, parentProduct);
      mockProductDao
        .expects('findDescendantProductIds')
        .withExactArgs(parentProduct.productId)
        .resolves(
          _.concat(
            [parentProduct.productId],
            _.map(childProducts, 'productId'),
          ),
        );
      mockProductDao
        .expects('find')
        .withExactArgs({ ids: _.map(childProducts, 'productId') })
        .resolves(childProducts);

      // get 1 existing back
      const existingBlockReason = {
        ...blocklistReasons[0],
        isActive: true,
        blockReasonId: 2,
      };
      mockBlocklistReasonManager
        .expects('findBlockReason')
        .withArgs(
          sinon.match({ ...blocklistReasons[0], blockReasonId: undefined }),
        )
        .resolves(existingBlockReason);

      mockBlocklistReasonManager
        .expects('findBlockReason')
        .atLeast(3)
        .resolves(undefined);

      addRunBatchExpectation(
        parentProduct,
        childProducts,
        {
          creates: blocklistReasons.slice(1),
          updates: [{ ...existingBlockReason, isActive: false }],
        },
        blockAction,
      );
      mockProductDao.expects('findProductsByArtist').never();
      await blocklistLie.blockActionProcessHandler(routingKey, blockAction);
      sinon.verify();
    });
    it('call artist handler for artist terms', async () => {
      const term = 'badTerm';
      const { artistProduct } = addTestProducts(term, true);
      artistProduct.meta.name = term;
      const { blockAction, blocklistTerm, blocklistReasons } =
        addTestBlockDataData(
          artistProduct,
          [],
          BlockActionBy.Terms,
          BlockActionType.Add,
          term,
        );
      addTermsExpectation(blocklistTerm, blockAction, artistProduct);

      mockBlockListLie
        .expects('getBlockReasonsBy')
        .atLeast(1)
        .resolves(blocklistReasons[0]);
      mockBlockListLie.expects('runBatchAndPublish').atLeast(1).resolves();
      mockBlockListLie
        .expects('handleArtist')
        .withArgs(artistProduct, blockAction)
        .resolves();
      mockBlocklistActionManager
        .expects('updateBlockAction')
        .withExactArgs(
          blockAction.blockActionId,
          { state: BlockActionState.Applied },
          { routingKey },
        )
        .resolves();

      await blocklistLie.blockActionProcessHandler(routingKey, blockAction);
      sinon.verify();
    });
  });

  describe('blockActionProcessHandler - AutoReview', () => {
    it('skip autoreview if the type is not artist', async () => {
      const blockAction = ModelFactory.blockAction({
        type: BlockActionBy.AutoReview,
        productId: 1,
      });
      mockProductDao
        .expects('findOne')
        .withArgs(1)
        .resolves(
          ModelFactory.product({
            productId: 1,
            productTypeId: ProductTypeIds.Track,
          }),
        );
      mockProductDao.expects('findProductsByArtist').never();
      mockBlocklistActionManager
        .expects('updateBlockAction')
        .withArgs(
          blockAction.blockActionId,
          { state: BlockActionState.Applied },
          { routingKey },
        )
        .once();

      await blocklistLie.blockActionProcessHandler(routingKey, blockAction);
      sinon.verify();
    });
    it('Use new autoreview handler for V1 messages if legacy toggle is on (kill me)', async () => {
      const product = ModelFactory.product({
        productId: 1,
        productTypeId: ProductTypeIds.Track,
      });
      const blockAction = ModelFactory.blockAction({
        type: BlockActionBy.AutoReview,
        productId: 1,
        udate: new Date().toLocaleString(),
      });
      mockProductDao.expects('findOne').withArgs(1).resolves(product);

      // set the switch to tomorrow
      const date = new Date();
      const tomorrow = new Date(
        date.setDate(date.getDate() + 1),
      ).toLocaleString();
      mockAppConfig
        .expects('get')
        .withArgs('autoReviewV2DateSwitch')
        .returns(tomorrow);

      const reviewResult = { blocked: true, blocklistTerms: [], parents: [] };
      mockBlockListLie
        .expects('blockAutoReviewHandler')
        .withArgs(product)
        .resolves(reviewResult);

      mockProductDao
        .expects('update')
        .withArgs(
          product.productId,
          { ...product, isBlocked: true },
          { reason: 'legacyAutoReview', routingKey },
        )
        .resolves();
      mockBlockListLie
        .expects('addDirectBlockReasons')
        .withArgs({ ...product, isBlocked: true }, reviewResult, true, {
          routingKey,
        })
        .resolves();

      mockProductDao.expects('findProductsByArtist').never();
      mockBlocklistActionManager
        .expects('updateBlockAction')
        .withArgs(
          blockAction.blockActionId,
          { state: BlockActionState.Applied },
          { routingKey },
        )
        .once();

      await blocklistLie.blockActionProcessHandler(routingKey, blockAction);
      sinon.verify();
    });
    it('Use new autoreview handler for V1 messages if legacy toggle is on and do nothing if should not be blocked(kill me)', async () => {
      const product = ModelFactory.product({
        productId: 1,
        productTypeId: ProductTypeIds.Track,
      });
      const blockAction = ModelFactory.blockAction({
        type: BlockActionBy.AutoReview,
        productId: 1,
        udate: new Date().toLocaleString(),
      });
      mockProductDao.expects('findOne').withArgs(1).resolves(product);

      // set the switch to tomorrow
      const date = new Date();
      const tomorrow = new Date(
        date.setDate(date.getDate() + 1),
      ).toLocaleString();
      mockAppConfig
        .expects('get')
        .withArgs('autoReviewV2DateSwitch')
        .returns(tomorrow);

      const reviewResult = { blocked: false, blocklistTerms: [], parents: [] };
      mockBlockListLie
        .expects('blockAutoReviewHandler')
        .withArgs(product)
        .resolves(reviewResult);

      mockProductDao.expects('update').never();
      mockBlockListLie.expects('addDirectBlockReasons').never();

      mockProductDao.expects('findProductsByArtist').never();
      mockBlocklistActionManager
        .expects('updateBlockAction')
        .withArgs(
          blockAction.blockActionId,
          { state: BlockActionState.Applied },
          { routingKey },
        )
        .once();

      await blocklistLie.blockActionProcessHandler(routingKey, blockAction);
      sinon.verify();
    });
    it('call artist handler for artist autoreview', async () => {
      const blockAction = ModelFactory.blockAction({
        type: BlockActionBy.AutoReview,
        productId: 1,
      });
      const product = ModelFactory.product({
        productId: 1,
        productTypeId: ProductTypeIds.Artist,
      });
      mockProductDao.expects('findOne').withArgs(1).resolves(product);

      mockBlockListLie
        .expects('handleArtist')
        .withArgs(product, blockAction)
        .resolves();

      mockBlocklistActionManager
        .expects('updateBlockAction')
        .withExactArgs(
          blockAction.blockActionId,
          { state: BlockActionState.Applied },
          { routingKey },
        )
        .resolves();

      await blocklistLie.blockActionProcessHandler(routingKey, blockAction);

      sinon.verify();
    });
  });

  describe('blockActionProcessHandler - Product', () => {
    it('Should skip execution if LIE was created not for an artist', async () => {
      const blockAction = ModelFactory.blockAction({
        type: BlockActionBy.Product,
        productId: 1,
      });
      mockProductDao
        .expects('findOne')
        .withArgs(1)
        .resolves(
          ModelFactory.product({
            productId: 1,
            productTypeId: ProductTypeIds.Track,
          }),
        );
      mockProductDao.expects('findProductsByArtist').never();
      mockBlocklistActionManager
        .expects('updateBlockAction')
        .withArgs(
          blockAction.blockActionId,
          { state: BlockActionState.Applied },
          { routingKey },
        )
        .once();

      await blocklistLie.blockActionProcessHandler(routingKey, blockAction);
      sinon.verify();
    });
    it('blocks artist and related products', async () => {
      const { parentProduct, childProducts, artistProduct } = addTestProducts(
        'BooFoo',
        true,
      );
      const { blockAction } = addTestBlockDataData(
        artistProduct,
        [],
        BlockActionBy.Product,
        BlockActionType.Add,
        undefined,
        artistProduct.productId,
      );

      mockProductDao
        .expects('findOne')
        .withArgs(blockAction.productId)
        .resolves(artistProduct);

      mockProductDao
        .expects('findProductsByArtist')
        .withArgs(
          artistProduct.source.vendorProductId,
          artistProduct.source.vendorName,
          [ProductTypeIds.Album, ProductTypeIds.Track],
          blockAction.action,
          artistProduct.productId,
          termsBatch,
        )
        .resolves([parentProduct]); // get back album only

      // album in this case ill have a reason based on the artist
      const albumBlockReason = blocklistReasonManager.constructBlockReason({
        productId: parentProduct.productId,
        blockAction,
        blockedByProduct: artistProduct.productId,
      });

      // and child products will have a reason based on the album
      const childBlockReasons = childProducts.map((p) =>
        blocklistReasonManager.constructBlockReason({
          productId: p.productId,
          blockAction,
          blockedByProduct: parentProduct.productId,
        }),
      );

      addUpdateAndPublishExpectation(
        parentProduct,
        childProducts,
        [albumBlockReason, ...childBlockReasons],
        blockAction,
      );

      await blocklistLie.blockActionProcessHandler(routingKey, blockAction);
      sinon.verify();
    });
    it('should unblock artist and related products', async () => {
      /**
       * we have an artist id: 100, Album id: 1
       * and children Ids: 10 (same artist), 11 (same artist), 12(not the same artist)
       * children 11 isBlocked: false
       * So expect updates for products 1,10,12 (11 excluded since it's already unblocked)
       * And reasons (all non exiting before) for 1, 10 by artist, 10,11,12 by album
       */
      const { parentProduct, childProducts, artistProduct } = addTestProducts(
        'BooFoo',
        true,
      );
      parentProduct.isBlocked = true;
      childProducts.forEach((p) => (p.isBlocked = true));

      const { blockAction } = addTestBlockDataData(
        artistProduct,
        [],
        BlockActionBy.Product,
        BlockActionType.Remove,
        undefined,
        artistProduct.productId,
      );

      mockProductDao
        .expects('findOne')
        .withArgs(blockAction.productId)
        .resolves(artistProduct);

      /**
       * get back album and a child
       * (normally all should be return since they all have the same artist,
       * but in case some is missing we have an extra check)
       */
      const blockChildByArtist = childProducts[0];
      const alreadyUnblockChild = childProducts[1];
      alreadyUnblockChild.isBlocked = false;
      const albumRelatedProducts = [
        parentProduct,
        blockChildByArtist,
        alreadyUnblockChild,
      ];
      const albumRelatedNeedsUpdate = [parentProduct, blockChildByArtist];
      const childProductsNeedUpdate = [blockChildByArtist, childProducts[2]];

      // related products 1 (album), 10, 11 (tracks), 12 excluded (not the same artist)
      mockProductDao
        .expects('findProductsByArtist')
        .withArgs(
          artistProduct.source.vendorProductId,
          artistProduct.source.vendorName,
          [ProductTypeIds.Album, ProductTypeIds.Track],
          blockAction.action,
          artistProduct.productId,
          termsBatch,
        )
        .resolves(albumRelatedProducts);

      // album in this case it have a reason based on the artist (1, 10)
      const albumRelatedReasons = albumRelatedNeedsUpdate.map((p) =>
        blocklistReasonManager.constructBlockReason({
          productId: p.productId,
          blockAction,
          blockedByProduct: artistProduct.productId,
        }),
      );

      // reasons by album (10, 11, 12)
      const childBlockReasons = childProducts.map((p) =>
        blocklistReasonManager.constructBlockReason({
          productId: p.productId,
          blockAction,
          blockedByProduct: parentProduct.productId,
        }),
      );

      const childIds = childProducts.map((p) => p.productId);
      mockProductDao
        .expects('findDescendantProductIds')
        .withArgs(parentProduct.productId)
        .resolves(childIds);

      mockProductDao
        .expects('find')
        .withExactArgs({ ids: childIds })
        .resolves(childProducts);

      mockBlocklistReasonManager
        .expects('findBlockReason')
        .atLeast(1)
        .resolves(undefined);

      const batch = {
        updates: [],
        creates: [...albumRelatedReasons, ...childBlockReasons],
      };
      addRunBatchExpectation(
        parentProduct,
        childProductsNeedUpdate,
        batch,
        blockAction,
      );

      await blocklistLie.blockActionProcessHandler(routingKey, blockAction);
      sinon.verify();
    });
    it('should stop execution if there are no products for the artist', async () => {
      const { artistProduct } = addTestProducts('BooFoo', true);
      const { blockAction } = addTestBlockDataData(
        artistProduct,
        [],
        BlockActionBy.Product,
        BlockActionType.Add,
        undefined,
        artistProduct.productId,
      );

      mockProductDao
        .expects('findOne')
        .withArgs(blockAction.productId)
        .resolves(artistProduct);

      mockProductDao
        .expects('findProductsByArtist')
        .withArgs(
          artistProduct.source.vendorProductId,
          artistProduct.source.vendorName,
          [ProductTypeIds.Album, ProductTypeIds.Track],
          blockAction.action,
          artistProduct.productId,
          termsBatch,
        )
        .resolves([]);

      mockBlocklistActionManager
        .expects('updateBlockAction')
        .withArgs(
          blockAction.blockActionId,
          { state: BlockActionState.Applied },
          { routingKey },
        )
        .once();

      await blocklistLie.blockActionProcessHandler(routingKey, blockAction);
      sinon.verify();
    });
  });

  describe('inline review v2', () => {
    it('should autoreview album and block everything inline', async () => {
      const term = 'badTerm';
      const { parentProduct, childProducts, artistProduct } = addTestProducts(
        term,
        true,
      );
      const { blocklistTerm } = addTestBlockDataData(
        parentProduct,
        childProducts,
        BlockActionBy.Terms,
        BlockActionType.Add,
        term,
      );

      blocklistTerm.productTypeGroupId = parentProduct.productTypeGroupId;
      mockBlocklistActionManager
        .expects('findActiveByProductTypeGroupId')
        .withExactArgs(parentProduct.productTypeGroupId)
        .resolves([blocklistTerm]);

      // should not call for the album
      mockParentProductManager.expects('getParentProduct').never();

      // should check for the artist
      mockProductDao
        .expects('findArtist')
        .withArgs(parentProduct)
        .resolves(artistProduct);

      const result = await blocklistLie.blockAutoReviewHandler(parentProduct);

      expect(result.blocked).to.be.true;
      expect(result.blocklistTerms[0]).to.be.equal(blocklistTerm);
      expect(result.parents[0]).to.be.undefined;

      sinon.verify();
    });
    it('should autoreview a track and not block anything', async () => {
      const { childProducts, parentProduct, artistProduct } = addTestProducts(
        'I am a good song',
        true,
      );

      const { blocklistTerm } = addTestBlockDataData(
        parentProduct,
        childProducts,
        BlockActionBy.Terms,
        BlockActionType.Add,
        'term',
      );

      mockBlocklistActionManager
        .expects('findActiveByProductTypeGroupId')
        .withExactArgs(childProducts[0].productTypeGroupId)
        .resolves([blocklistTerm]);

      mockParentProductManager
        .expects('getParentProduct')
        .withArgs(childProducts[0])
        .resolves(parentProduct);

      mockProductDao
        .expects('findArtist')
        .withArgs(childProducts[0])
        .resolves(artistProduct);

      const result = await blocklistLie.blockAutoReviewHandler(
        childProducts[0],
      );
      expect(result.blocked).to.be.false;
      expect(result.blocklistTerms[0]).to.be.undefined;
      expect(result.parents[0]).to.be.undefined;
    });
    it('should autoreview a track and keep it blocked if it was blocked manually', async () => {
      const { childProducts, parentProduct, artistProduct } = addTestProducts(
        'I am a good song',
        true,
      );
      childProducts[0].isManuallyBlocked = true;
      const { blocklistTerm } = addTestBlockDataData(
        parentProduct,
        childProducts,
        BlockActionBy.Terms,
        BlockActionType.Add,
        'term',
      );

      mockBlocklistActionManager
        .expects('findActiveByProductTypeGroupId')
        .withExactArgs(childProducts[0].productTypeGroupId)
        .resolves([blocklistTerm]);

      mockParentProductManager
        .expects('getParentProduct')
        .withArgs(childProducts[0])
        .resolves(parentProduct);

      mockProductDao
        .expects('findArtist')
        .withArgs(childProducts[0])
        .resolves(artistProduct);

      const result = await blocklistLie.blockAutoReviewHandler(
        childProducts[0],
      );
      expect(result.blocked).to.be.true;
      expect(result.blocklistTerms[0]).to.be.undefined;
      expect(result.parents[0]).to.be.undefined;
    });
    it('should autoreview a track and block by blocked album', async () => {
      const term = 'goodTerm';
      const { parentProduct, childProducts, artistProduct } = addTestProducts(
        term,
        true,
      );

      parentProduct.isBlocked = true;
      // no terms
      mockBlocklistActionManager
        .expects('findActiveByProductTypeGroupId')
        .withExactArgs(parentProduct.productTypeGroupId)
        .resolves([]);

      // should not call for the album
      mockParentProductManager
        .expects('getParentProduct')
        .withArgs(childProducts[0])
        .resolves(parentProduct);

      // should check for the artist
      artistProduct.isBlocked = true;
      mockProductDao
        .expects('findArtist')
        .withArgs(childProducts[0])
        .resolves(artistProduct);

      const result = await blocklistLie.blockAutoReviewHandler(
        childProducts[0],
      );

      expect(result.blocked).to.be.true;
      expect(result.blocklistTerms[0]).to.be.undefined;
      expect(result.parents[0]).to.be.equal(parentProduct);
      expect(result.parents[1]).to.be.equal(artistProduct);

      sinon.verify();
    });
  });

  describe('autoreview v2 - direct block reasons', () => {
    it('Does nothing if product isBlocked status is the same', async () => {
      const product = ModelFactory.product({
        productId: 1,
        isBlocked: false,
      });
      mockBlocklistActionManager.expects('create').never();
      await blocklistLie.addDirectBlockReasons(
        product,
        { blocked: false, blocklistTerms: [], parents: [] },
        false,
        context,
      );
      sinon.verify();
    });
    it('Should block a product by artist and term and block all descendants', async () => {
      const term = 'badTerm';
      const { parentProduct, childProducts, artistProduct } = addTestProducts(
        term,
        true,
      );
      const { blocklistTerm, blockAction, blocklistReasons } =
        addTestBlockDataData(
          parentProduct,
          childProducts,
          BlockActionBy.Terms,
          BlockActionType.Add,
          term,
        );
      parentProduct.isBlocked = true;

      mockBlocklistActionManager
        .expects('create')
        .withArgs(
          sinon.match({
            ...blockAction,
            blockActionId: undefined,
            state: BlockActionState.Pending,
            productId: parentProduct.productId,
            type: BlockActionBy.AutoReview,
          }),
          context,
        )
        .resolves(blockAction);

      mockBlocklistReasonManager
        .expects('findBlockReason')
        .atLeast(2)
        .resolves(undefined);

      // should create 1 for artist since the artist is blocked
      const reasonForArtist = blocklistReasonManager.constructBlockReason({
        productId: parentProduct.productId,
        blockAction,
        blockedByProduct: artistProduct.productId,
      });

      addUpdateAndPublishExpectation(
        parentProduct,
        childProducts,
        [...blocklistReasons, reasonForArtist],
        blockAction,
        false,
      );

      await blocklistLie.addDirectBlockReasons(
        parentProduct,
        {
          blocked: true,
          blocklistTerms: [blocklistTerm],
          parents: [artistProduct],
        },
        true,
        context,
      );
      sinon.verify();
    });
    it('Should block a product by artist and block all descendants', async () => {
      const term = 'badTerm';
      const { parentProduct, childProducts, artistProduct } = addTestProducts(
        term,
        true,
      );
      const { blockAction, blocklistReasons } = addTestBlockDataData(
        parentProduct,
        childProducts,
        BlockActionBy.Product,
        BlockActionType.Add,
      );

      parentProduct.isBlocked = true;
      mockBlocklistActionManager
        .expects('create')
        .withArgs(
          sinon.match({
            blocklistTermIds: null, // no terms check
            blockActionId: undefined,
            state: BlockActionState.Pending,
            productId: parentProduct.productId,
            type: BlockActionBy.AutoReview,
          }),
          context,
        )
        .resolves(blockAction);

      mockBlocklistReasonManager
        .expects('findBlockReason')
        .atLeast(1)
        .resolves(undefined);

      // should create 1 for artist since the artist is blocked
      const reasonForArtist = blocklistReasonManager.constructBlockReason({
        productId: parentProduct.productId,
        blockAction,
        blockedByProduct: artistProduct.productId,
      });

      addUpdateAndPublishExpectation(
        parentProduct,
        childProducts,
        [...blocklistReasons.slice(1), reasonForArtist],
        blockAction,
        false, // the parent already blocked
      );

      await blocklistLie.addDirectBlockReasons(
        parentProduct,
        {
          blocked: true,
          blocklistTerms: [],
          parents: [artistProduct],
        },
        true,
        context,
      );
      sinon.verify();
    });
    it('should publish an LIE if the product is artist', async () => {
      const term = 'badTerm';
      const { artistProduct } = addTestProducts(term, true);
      artistProduct.isBlocked = true;
      const { blocklistTerm, blockAction } = addTestBlockDataData(
        artistProduct,
        [],
        BlockActionBy.Terms,
        BlockActionType.Add,
        term,
      );
      const autoReviewResults = {
        blocked: true,
        blocklistTerms: [blocklistTerm],
        parents: [],
      };

      mockBlocklistActionManager
        .expects('create')
        .withArgs(
          sinon.match({
            ...blockAction,
            blocklistTermIds: [blocklistTerm.blocklistTermId],
            blockActionId: undefined,
            state: BlockActionState.Pending,
            productId: artistProduct.productId,
            type: BlockActionBy.AutoReview,
          }),
          context,
        )
        .resolves(blockAction);

      mockBlocklistReasonManager
        .expects('findBlockReason')
        .atLeast(1)
        .resolves(undefined);

      mockBlockListLie.expects('runBatchAndPublish').atLeast(1).resolves();
      mockBlocklistActionManager
        .expects('publishBlocklistAction')
        .withArgs(sinon.match(blockAction))
        .resolves();

      await blocklistLie.addDirectBlockReasons(
        artistProduct,
        autoReviewResults,
        true,
        context,
      );
      sinon.verify();
    });
    it('should disable block reason for the term that no longer applicable', async () => {
      const term = 'badTerm';
      const { parentProduct, childProducts } = addTestProducts('not bad term');

      // add reasons for the term before
      const { blocklistReasons } = addTestBlockDataData(
        parentProduct,
        childProducts,
        BlockActionBy.Terms,
        BlockActionType.Add,
        term,
      );

      // unblock action
      const unblockBlockAction = ModelFactory.blockAction({
        type: BlockActionBy.AutoReview,
        blocklistTermIds: undefined,
        action: BlockActionType.Remove,
        productId: parentProduct.productId,
        blockActionId: 2,
      });

      // auto review results - unlock (no longer match the term)
      parentProduct.isBlocked = false;
      parentProduct.childProductIds = undefined; // check that undefined is handled
      parentProduct.childProducts = [];

      mockBlocklistActionManager
        .expects('create')
        .withArgs(
          sinon.match({
            blocklistTermIds: null, // no terms match
            type: BlockActionBy.AutoReview,
            productId: parentProduct.productId,
            action: BlockActionType.Remove,
            state: BlockActionState.Pending,
          }),
          context,
        )
        .resolves(unblockBlockAction);

      // get all reasons call
      mockBlocklistReasonManager
        .expects('getBlockReasons')
        .atLeast(1)
        .resolves({ data: [blocklistReasons[0]] }); // only parent for the test

      // batch update to disable the previous reason
      const sinonMatchUpdatedBlockReasons = makeFancySinonMatch([
        { ...blocklistReasons[0], isActive: false },
      ]);
      const batchArgs = [];
      batchArgs.push({
        entities: sinonMatchUpdatedBlockReasons,
        transform: { ...blockReasonTransform },
      });
      mockBatchManager
        .expects('runMultipleUpdates')
        .withArgs(batchArgs)
        .resolves();

      mockBlocklistActionManager
        .expects('updateBlockAction')
        .withExactArgs(
          unblockBlockAction.blockActionId,
          { state: BlockActionState.Applied },
          sinon.match.any,
        )
        .resolves();

      await blocklistLie.addDirectBlockReasons(
        parentProduct,
        {
          blocked: false,
          blocklistTerms: [],
          parents: [],
        },
        true,
        context,
      );
      sinon.verify();
    });
  });

  describe('runBatch', () => {
    it('should handle empty arrays for products and reasons', async () => {
      const blockBatch = {
        creates: [],
        updates: [],
        products: [],
      };

      const blockAction = ModelFactory.blockAction({
        type: BlockActionBy.Product,
        productId: 1,
      });

      await (blocklistLie as any).runBatchAndPublish(blockBatch, blockAction);
      sinon.verify();
    });
  });

  describe('getBlockedParents', () => {
    it('use parent provided as a parameter', async () => {
      const { parentProduct, childProducts } = addTestProducts('BooFoo', false);
      const childProduct = childProducts[0];
      childProduct.source.vendorParentProductId = '12345';
      childProduct.productTypeId = ProductTypeIds.TabletPackage;
      parentProduct.isBlocked = true;

      const response = await (blocklistLie as any).getBlockedParents(
        childProduct,
        parentProduct,
      );
      expect(response[0]).to.be.eql(parentProduct);
      sinon.verify();
    });
    it('filter out types witch does not have a vendor parent', async () => {
      const { parentProduct, childProducts } = addTestProducts('BooFoo', false);
      const childProduct = childProducts[0];
      childProduct.source = undefined;
      childProduct.productTypeId = ProductTypeIds.TabletPackage;

      const response = await (blocklistLie as any).getBlockedParents(
        childProduct,
        parentProduct,
      );
      expect(response).to.be.eql([]);
      sinon.verify();
    });
    it('should ignore artist if it is already blocked', async () => {
      const { parentProduct, childProducts } = addTestProducts('BooFoo', false);
      const childProduct = childProducts[0];
      childProduct.source.vendorParentProductId = '12345';
      childProduct.productTypeId = ProductTypeIds.Track;
      parentProduct.isBlocked = true;

      mockProductDao
        .expects('findArtist')
        .withArgs(childProduct)
        .resolves(parentProduct);

      const response = await (blocklistLie as any).getBlockedParents(
        childProduct,
        parentProduct,
      );
      expect(response[0]).to.be.eql(parentProduct);
      sinon.verify();
    });
    it('should handle absence of parent', async () => {
      const { childProducts } = addTestProducts('BooFoo', false);
      const childProduct = childProducts[0];
      childProduct.source.vendorParentProductId = '12345';
      childProduct.productTypeId = ProductTypeIds.Track;

      mockParentProductManager
        .expects('getParentProduct')
        .withArgs(childProduct)
        .resolves(undefined);
      mockProductDao
        .expects('findArtist')
        .withArgs(childProduct)
        .resolves(undefined);

      const response = await (blocklistLie as any).getBlockedParents(
        childProduct,
        undefined,
      );
      expect(response).to.be.eql([]);
      sinon.verify();
    });
  });
});

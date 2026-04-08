import { expect } from 'chai';
import { random } from 'faker';
import { Exception } from 'securus.tablets.libraries.exceptions';
import * as sinon from 'sinon';
import {
  DigestProduct,
  Product,
  ProductTypeIds,
  ThumbnailApprovedStatus,
} from '../../../../src/controllers/models/Product';
import { RuleManager } from '../../../../src/lib/RuleManager';
import { ProductPublishManager } from '../../../../src/lib/product/ProductPublishManager';
import { MessagingConstants } from '../../../../src/messaging/MessagingConstants';
import { ModelFactory } from '../../../utils/ModelFactory';

describe('ProductPublishManager - Unit', () => {
  let productPublishManager: ProductPublishManager;
  let messagingManagerMock: sinon.SinonMock;
  let openSearchManagerMock: sinon.SinonMock;
  let loggerMock: sinon.SinonMock;
  let ruleManager: RuleManager;
  let sqsServiceMock: sinon.SinonMock;

  beforeEach(() => {
    productPublishManager = new ProductPublishManager();
    messagingManagerMock = sinon.mock(
      (productPublishManager as any).messagingManager,
    );
    openSearchManagerMock = sinon.mock(
      (productPublishManager as any).openSearchManager,
    );
    loggerMock = sinon.mock((productPublishManager as any).logger);
    ruleManager = new RuleManager();

    sqsServiceMock = sinon.mock(
      (productPublishManager as any).sqsSongSampleService,
    );
  });

  afterEach(() => {
    sinon.restore();
  });
  describe('publishProductMessage', () => {
    it('should publish a product with a created routing key', async () => {
      const product = ModelFactory.product({
        source: {
          vendorParentProductId: '321',
          vendorProductId: '123',
          vendorName: 'Foobar',
        },
      });

      openSearchManagerMock
        .expects('digestProductsIntoOpenSearch')
        .withExactArgs([product])
        .resolves();
      messagingManagerMock
        .expects('publish')
        .withArgs(
          MessagingConstants.PUBLICATION_ID,
          `product-2.${product.productTypeGroupId}.${product.productTypeId}.updated`,
          product,
        )
        .resolves();

      await productPublishManager.publishProductMessage(product);
      messagingManagerMock.verify();
      openSearchManagerMock.verify();
    });
    it('should publish a product without digesting it', async () => {
      const product = ModelFactory.product({
        source: {
          vendorParentProductId: '321',
          vendorProductId: '123',
          vendorName: 'Foobar',
        },
      });

      openSearchManagerMock.expects('digestProductsIntoOpenSearch').never();
      messagingManagerMock
        .expects('publish')
        .withArgs(
          MessagingConstants.PUBLICATION_ID,
          `product-2.${product.productTypeGroupId}.${product.productTypeId}.updated`,
          product,
        )
        .resolves();

      await productPublishManager.publishProductMessageWithoutDigest(product);
      messagingManagerMock.verify();
      openSearchManagerMock.verify();
    });
    it('should publish a product with a updated routing key', async () => {
      const product = ModelFactory.product({
        source: {
          vendorParentProductId: '321',
          vendorProductId: '123',
          vendorName: 'Foobar',
        },
      });

      openSearchManagerMock
        .expects('digestProductsIntoOpenSearch')
        .withExactArgs([product])
        .resolves();
      messagingManagerMock
        .expects('publish')
        .withArgs(
          MessagingConstants.PUBLICATION_ID,
          `product-2.${product.productTypeGroupId}.${product.productTypeId}.updated`,
          product,
        )
        .resolves();

      await productPublishManager.publishProductMessage(product);
      messagingManagerMock.verify();
      openSearchManagerMock.verify();
    });
    it('should log an error if unable to digest product', async () => {
      const product = ModelFactory.product({
        source: {
          vendorParentProductId: '321',
          vendorProductId: '123',
          vendorName: 'Foobar',
        },
      });

      openSearchManagerMock
        .expects('digestProductsIntoOpenSearch')
        .withExactArgs([product])
        .rejects({ foo: 'bar' });
      loggerMock
        .expects('error')
        .withExactArgs(`Error digesting product ${JSON.stringify(product)}`, {
          foo: 'bar',
        })
        .once();
      messagingManagerMock
        .expects('publish')
        .withArgs(
          MessagingConstants.PUBLICATION_ID,
          `product-2.${product.productTypeGroupId}.${product.productTypeId}.updated`,
          product,
        )
        .resolves();

      await productPublishManager.publishProductMessage(product);
      messagingManagerMock.verify();
      openSearchManagerMock.verify();
      loggerMock.verify();
    });
  });
  describe('publishLegacyMessage', () => {
    it('should publish a legacy message', async () => {
      const product = ModelFactory.product({
        source: {
          vendorParentProductId: '321',
          vendorProductId: '123',
          vendorName: 'Foobar',
        },
      });
      const legacyMessage = {
        vendor: product.source.vendorName,
        media: {
          vendorProductId: product.source.vendorProductId,
          thumbnailApproved: ThumbnailApprovedStatus.Blocked,
        },
      };
      messagingManagerMock
        .expects('publish')
        .withExactArgs(
          MessagingConstants.PUBLICATION_ID,
          'legacy.product.art.updated',
          legacyMessage,
        );

      await productPublishManager.publishLegacyMessage(legacyMessage);
      messagingManagerMock.verify();
    });
  });
  describe('publishRemovalMessage', () => {
    let product: Product;
    let productSearchResponse: any;
    let digestProduct: DigestProduct;

    function init(
      productId: number = 11,
      subscriptionIds: number[] = [10, 11, 12],
    ) {
      product = ModelFactory.product({ productId });
      productSearchResponse = { data: [product], scrollId: 'scroll-id' };
      digestProduct = {
        ...product,
        digest: ModelFactory.digest({
          subscriptionProductIds: subscriptionIds,
        }),
      };
    }

    beforeEach(() => {
      init();
    });

    it('given non-matching productId, should publish message', async () => {
      init(1234);
      const rule = ModelFactory.productSubscriptionAvailabilityRule({
        productId: product.productId,
      });
      openSearchManagerMock
        .expects('getProductsByRules')
        .withExactArgs(rule.productTypeId, [rule], null)
        .resolves(productSearchResponse);
      openSearchManagerMock
        .expects('getProductsByRules')
        .withExactArgs(rule.productTypeId, [rule], 'scroll-id')
        .resolves({
          ...productSearchResponse,
          data: null,
        });
      openSearchManagerMock
        .expects('digestProductsIntoOpenSearch')
        .withExactArgs(productSearchResponse.data)
        .resolves([digestProduct]);
      messagingManagerMock
        .expects('publish')
        .withExactArgs(
          MessagingConstants.PUBLICATION_ID,
          MessagingConstants.REDEEM_PRODUCT_REMOVED_ROUTING_KEY,
          digestProduct,
        )
        .resolves();
      await ruleManager.digestRule(rule);

      sinon.assert.match(digestProduct, {
        digest: undefined,
      });
      sinon.verify();
    });
    it('given null subscriptionIds, should publish message', async () => {
      init(11, null);
      const rule = ModelFactory.productSubscriptionAvailabilityRule({
        productId: product.productId,
      });
      openSearchManagerMock
        .expects('getProductsByRules')
        .withExactArgs(rule.productTypeId, [rule], null)
        .resolves(productSearchResponse);
      openSearchManagerMock
        .expects('getProductsByRules')
        .withExactArgs(rule.productTypeId, [rule], 'scroll-id')
        .resolves({
          ...productSearchResponse,
          data: null,
        });
      openSearchManagerMock
        .expects('digestProductsIntoOpenSearch')
        .withExactArgs(productSearchResponse.data)
        .resolves([digestProduct]);
      messagingManagerMock
        .expects('publish')
        .withExactArgs(
          MessagingConstants.PUBLICATION_ID,
          MessagingConstants.REDEEM_PRODUCT_REMOVED_ROUTING_KEY,
          digestProduct,
        )
        .resolves();
      await ruleManager.digestRule(rule);

      sinon.assert.match(digestProduct, {
        digest: undefined,
      });
      sinon.verify();
    });
    it('given matching productId, should not publish message', async () => {
      const rule = ModelFactory.productSubscriptionAvailabilityRule({
        productId: product.productId,
      });
      openSearchManagerMock
        .expects('getProductsByRules')
        .withExactArgs(rule.productTypeId, [rule], null)
        .resolves(productSearchResponse);
      openSearchManagerMock
        .expects('getProductsByRules')
        .withExactArgs(rule.productTypeId, [rule], 'scroll-id')
        .resolves({
          ...productSearchResponse,
          data: null,
        });
      openSearchManagerMock
        .expects('digestProductsIntoOpenSearch')
        .withExactArgs(productSearchResponse.data)
        .resolves([digestProduct]);
      messagingManagerMock.expects('publish').never();
      await ruleManager.digestRule(rule);

      sinon.assert.match(digestProduct, {
        digest: undefined,
      });
      sinon.verify();
    });
  });

  describe('publishSongSampleDownloadRequest', () => {
    it('should publish all tracks', async () => {
      const album = ModelFactory.product({
        productId: 10000,
        productTypeId: ProductTypeIds.Album,
      });

      const tracks = [];
      const childProductsNumber = random.number({ min: 1, max: 10 });
      for (let i = 0; i < childProductsNumber; i++) {
        const track = ModelFactory.product({
          productId: i,
          productTypeId: ProductTypeIds.Track,
        });
        tracks.push(track);
      }
      album.childProducts = tracks;

      sqsServiceMock.expects('sendJob').exactly(childProductsNumber).resolves();

      await productPublishManager.publishSongSampleDownloadRequest(album);
      sinon.verify();
    });

    it('should not publish if there are no tracks', async () => {
      const album = ModelFactory.product({
        productId: 10000,
        productTypeId: ProductTypeIds.Album,
      });
      album.childProducts = undefined;

      sqsServiceMock.expects('sendJob').never();

      await productPublishManager.publishSongSampleDownloadRequest(album);
      sinon.verify();
    });

    it('should return 500 error if sqs service fails', async () => {
      const album = ModelFactory.product({
        productId: 10000,
        productTypeId: ProductTypeIds.Album,
      });

      const tracks = [];
      const childProductsNumber = random.number({ min: 1, max: 10 });
      for (let i = 0; i < childProductsNumber; i++) {
        const track = ModelFactory.product({
          productId: i,
          productTypeId: ProductTypeIds.Track,
        });
        tracks.push(track);
      }
      album.childProducts = tracks;

      sqsServiceMock.expects('sendJob').exactly(childProductsNumber).rejects();

      try {
        await productPublishManager.publishSongSampleDownloadRequest(album);
      } catch (error) {
        expect(error.name).to.equal(Exception.InternalError.name);
      }
      sinon.verify;
    });
  });
});

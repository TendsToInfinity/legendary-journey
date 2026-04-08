import { JsonSchemaParser } from '@securustablets/libraries.json-schema';
import { _ } from '@securustablets/libraries.utils';
import { SecurityFactory } from '@securustablets/libraries.utils-test';
import { assert, expect } from 'chai';
import { Response as ApiResponse, Request } from 'express';
import * as faker from 'faker';
import { Exception } from 'securus.tablets.libraries.exceptions';
import * as sinon from 'sinon';
import { Container } from 'typescript-ioc';
import { ProductController } from '../../../src/controllers/ProductController';
import { ManuallyBlockedReason } from '../../../src/controllers/models/BlockAction';
import {
  PriceDetailType,
  Product,
  ProductTypeIds,
  ThumbnailApprovedStatus,
  VendorNames,
} from '../../../src/controllers/models/Product';
import { Paginated } from '../../../src/lib/models/Paginated';
import { fakeGetSchemaForInterface } from '../../utils/FakeGetSchemaForInterface';
import { ModelFactory } from '../../utils/ModelFactory';

describe('ProductController - Unit', () => {
  let controller: ProductController;
  let mockProductMan: sinon.SinonMock;
  let mockProductPubMan: sinon.SinonMock;
  let mockProductTypeMan: sinon.SinonMock;
  let mockTokenMan: sinon.SinonMock;
  let mockCloudMan: sinon.SinonMock;
  let mockLogger: sinon.SinonMock;
  let mockManualBlocklistManager: sinon.SinonMock;

  beforeEach(() => {
    const stubGetSchemaForInterface = sinon.stub(
      JsonSchemaParser,
      'getSchemaForInterface',
    );
    stubGetSchemaForInterface.callsFake(fakeGetSchemaForInterface);
    controller = Container.get(ProductController);
    mockProductMan = sinon.mock((controller as any).productMan);
    mockProductPubMan = sinon.mock((controller as any).productPubMan);
    mockProductTypeMan = sinon.mock((controller as any).productTypeMan);
    mockTokenMan = sinon.mock((controller as any).tokenMan);
    mockCloudMan = sinon.mock((controller as any).cloudMan);
    mockLogger = sinon.mock((controller as any).logger);
    mockManualBlocklistManager = sinon.mock(
      (controller as any).manualBlocklistManager,
    );
  });
  afterEach(() => {
    sinon.restore();
  });
  describe('searchProducts', () => {
    it('should call ProductManager.search', async () => {
      const search = { term: 'foo' };
      const securityContext = {};
      const expectedResults: Paginated<Product> = {
        data: [ModelFactory.product()],
        total: 1,
        pageNumber: 0,
        pageSize: 25,
      };
      mockProductMan
        .expects('enforceSearchSecurityContext')
        .withArgs(search, securityContext)
        .returns(search);
      mockProductMan
        .expects('search')
        .withArgs(search)
        .returns(expectedResults);
      const actualResults = await controller.searchProducts(
        search,
        securityContext,
      );
      mockProductMan.verify();
      assert.deepEqual(actualResults, expectedResults);
    });
    it('should call ProductManager.search with enforced context for inmateJwt', async () => {
      const search = {
        term: 'foo',
        context: {
          enforce: false,
          customerId: 'im lying',
          siteId: 'still lying',
        },
      };
      const securityContext = {
        inmateJwt: SecurityFactory.inmateJwt({
          customerId: 'customerId',
          siteId: 'siteId',
        }),
      };
      const actualSearch = {
        term: 'foo',
        context: { enforce: true, customerId: 'customerId', siteId: 'siteId' },
      };
      const expectedResults: Paginated<Product> = {
        data: [ModelFactory.product()],
        total: 1,
        pageNumber: 0,
        pageSize: 25,
      };
      mockProductMan
        .expects('enforceSearchSecurityContext')
        .withArgs(search, securityContext)
        .returns(actualSearch);
      mockProductMan
        .expects('search')
        .withArgs(actualSearch)
        .returns(expectedResults);
      const actualResults = await controller.searchProducts(
        search,
        securityContext,
      );
      mockProductMan.verify();
      assert.deepEqual(actualResults, expectedResults);
    });
  });
  describe('getProducts', () => {
    it('should return paginated product', async () => {
      const query = { term: 'foo' };
      const expectedResults: Paginated<Product> = {
        data: [ModelFactory.product()],
        total: 1,
        pageNumber: 0,
        pageSize: 25,
      };
      mockProductMan
        .expects('searchByQueryString')
        .withArgs(query)
        .returns(expectedResults);
      const actualResults = await controller.getProducts({
        query,
      } as any as Request);
      mockProductMan.verify();
      assert.deepEqual(actualResults, expectedResults);
    });
  });
  describe('findProduct', () => {
    it('should call ProductManager.findOneByProductIdOrFail', async () => {
      const expectedResult = { productId: 123 };
      const securityContext = {};
      mockProductMan
        .expects('findOneByProductIdOrFail')
        .withExactArgs(123, false, securityContext, {})
        .returns(expectedResult);
      await controller.findProduct('123', securityContext);
      mockProductMan.verify();
    });
    it('should call ProductManager.findProduct with resolve flag set to true', async () => {
      // do not change the case of the resolve.
      const resolve = 'trUe';
      const expectedResult = { productId: 123 };
      const securityContext = {};
      mockProductMan
        .expects('findOneByProductIdOrFail')
        .withExactArgs(123, true, securityContext, {})
        .returns(expectedResult);
      await controller.findProduct('123', securityContext, resolve);
      mockProductMan.verify();
    });

    it('should return signedUrl if includeSignedUrl set to true ', async () => {
      const includeSignedUrl = 'true';
      const vendorProductId = '123';
      const s3Path = `am/${vendorProductId}/${vendorProductId}.mp3`;
      const signURL = `am/${vendorProductId}/${vendorProductId}.mp3?bla`;
      const resolve = 'false';
      const product = ModelFactory.product({
        vendorProductId: '1111',
        productTypeId: ProductTypeIds.Track,
        source: {
          vendorProductId,
          vendorName: VendorNames.AudibleMagic,
          s3Path,
        },
      });

      const securityContext = {};
      mockProductMan
        .expects('findOneByProductIdOrFail')
        .withExactArgs(1111, false, securityContext, {})
        .returns(product);
      mockCloudMan
        .expects('signPathForCloudFront')
        .withArgs(s3Path)
        .resolves(signURL);

      const productWithURL = await controller.findProduct(
        '1111',
        securityContext,
        resolve,
        includeSignedUrl,
      );

      mockProductMan.verify();
      mockCloudMan.verify();
      expect(productWithURL.source.signedUrl).to.deep.equal(signURL);
    });

    it('should trow MethodNotAllowed error if product was not downloaded yet', async () => {
      const includeSignedUrl = 'true';
      const resolve = 'FALSE';
      const product = ModelFactory.product({
        vendorProductId: '1111',
        productTypeId: ProductTypeIds.Album,
        source: {
          vendorProductId: '123',
        },
      });
      const securityContext = {};
      mockProductMan
        .expects('findOneByProductIdOrFail')
        .withExactArgs(1111, false, securityContext, {})
        .returns(product);

      try {
        await controller.findProduct(
          '1111',
          securityContext,
          resolve,
          includeSignedUrl,
        );
        assert.fail();
      } catch (err) {
        mockProductMan.verify();
        expect(err.name).to.equal(Exception.MethodNotAllowed.name);
      }
    });

    it('should trow an 500 error if includeSignedUrl set to true and something went wrong', async () => {
      const includeSignedUrl = 'true';
      const vendorProductId = '123';
      const s3Path = `am/${vendorProductId}/${vendorProductId}.mp3`;
      const resolve = 'fAlSe';
      const product = ModelFactory.product({
        vendorProductId: '1111',
        productTypeId: ProductTypeIds.Album,
        source: {
          vendorProductId: '123',
          vendorName: VendorNames.AudibleMagic,
          s3Path,
        },
      });
      const securityContext = {};
      mockProductMan
        .expects('findOneByProductIdOrFail')
        .withExactArgs(1111, false, securityContext, {})
        .returns(product);
      mockCloudMan.expects('signPathForCloudFront').withArgs(s3Path).throws();

      try {
        await controller.findProduct(
          '1111',
          securityContext,
          resolve,
          includeSignedUrl,
        );
        assert.fail();
      } catch (err) {
        mockProductMan.verify();
        mockCloudMan.verify();
        expect(err.name).to.equal(Exception.InternalError.name);
      }
    });

    it('should call ProductManager.findProduct with enforce flag set to true', async () => {
      const enforce = 'true';
      const expectedResult = { productId: 123 };
      const securityContext = {};
      mockProductMan
        .expects('findOneByProductIdOrFail')
        .withExactArgs(123, false, securityContext, {
          enforce: true,
          customerId: '1',
          siteId: '2',
        })
        .returns(expectedResult);
      await controller.findProduct(
        '123',
        securityContext,
        'false',
        'false',
        enforce,
        '1',
        '2',
      );
      mockProductMan.verify();
    });

    it('should call ProductManager.findProduct with enforce and resolve flag set to true, when the enforce text is of mixed case', async () => {
      const enforce = 'tRUe';
      const resolve = 'TRUE';
      const expectedResult = { productId: 123 };
      const securityContext = {};
      mockProductMan
        .expects('findOneByProductIdOrFail')
        .withExactArgs(123, true, securityContext, {
          enforce: true,
          customerId: '1',
          siteId: '2',
        })
        .returns(expectedResult);
      await controller.findProduct(
        '123',
        securityContext,
        resolve,
        'false',
        enforce,
        '1',
        '2',
      );
      mockProductMan.verify();
    });
  });
  describe('getPurchaseToken', () => {
    let response: ApiResponse;
    beforeEach(() => {
      response = {
        contentType: () => null,
        send: () => null,
      } as any as ApiResponse;
    });
    it('should call build purchase token', async () => {
      const inmateJwt = SecurityFactory.inmateJwt({
        customerId: 'I-123456',
        siteId: '11111',
        custodyAccount: 'inmateId',
        callPartyId: 'callPartyId',
      });
      const product = ModelFactory.pricedProduct(
        {
          productId: 1,
          productTypeId: 'movie',
          productTypeGroupId: 'movie',
          purchaseCode: 'VIDEO',
          purchaseTypes: ['subscription'],
          meta: {
            name: 'My product',
            description: 'my prod description',
            thumbnail: 'http://dev.null',
            basePrice: { rental: 10.88 },
            type: 'sickmovie',
            billingInterval: {
              count: 1,
              intervalUnit: 'months',
            },
          },
          version: 100,
          childProductIds: [1, 3, 5],
          childProducts: [
            ModelFactory.product(),
            ModelFactory.product(),
            ModelFactory.product(),
          ],
        } as any as Product,
        10.88,
        'subscription',
      );
      mockProductMan
        .expects('findOneByProductIdOrFail')
        .withArgs(product.productId, true, { inmateJwt })
        .returns(product);
      mockTokenMan
        .expects('generateJwt')
        .withArgs({
          customerId: 'I-123456',
          siteId: '11111',
          inmateId: 'inmateId',
          custodyAccount: 'inmateId',
          callPartyId: 'callPartyId',
          purchaseType: 'subscription',
          purchaseCode: 'VIDEO',
          product: {
            productId: 1,
            price: 10.88,
            name: 'My product',
            description: 'my prod description',
            fulfillmentType: 'digital',
            thumbnail: 'http://dev.null',
            productType: 'movie',
            productTypeGroupId: 'movie',
            priceDetail: product.purchaseOptions[0].priceDetails,
            version: 100,
            billingInterval: {
              count: 1,
              intervalUnit: 'months',
            },
            includedProductIds: _.map(
              product.childProducts,
              (childProduct) => childProduct.productId,
            ),
            type: product.meta.type,
          },
        })
        .resolves('here is my jwt');

      const mockResponse = sinon.mock(response);
      mockResponse
        .expects('contentType')
        .withArgs('application/jwt')
        .returnsThis();
      mockResponse.expects('send').withArgs('here is my jwt');

      await controller.getPurchaseToken(
        `${product.productId}`,
        'subscription',
        { inmateJwt },
        response,
      );

      mockProductMan.verify();
      mockTokenMan.verify();
    });
    it('should blow up for invalid purchase type', async () => {
      const inmateJwt = SecurityFactory.inmateJwt({
        customerId: 'I-123456',
        siteId: '11111',
        custodyAccount: 'inmateId',
        callPartyId: 'callPartyId',
      });
      const product = ModelFactory.pricedProduct(
        {
          productId: 123,
          meta: { basePrice: { rental: 10.88 } },
        } as any as Product,
        10.88,
      );
      mockProductMan
        .expects('findOneByProductIdOrFail')
        .withArgs(product.productId, true, { inmateJwt })
        .resolves(product);
      mockTokenMan.expects('generateJwt').never();

      try {
        await controller.getPurchaseToken(
          '123',
          'subscription',
          { inmateJwt },
          response,
        );
        assert.fail();
      } catch (err) {
        assert.equal(err.name, Exception.InvalidData.name, err);
        assert.deepEqual(err.errors, [
          `purchaseType [subscription] is not valid for product [123]`,
        ]);
      }

      mockProductMan.verify();
      mockTokenMan.verify();
    });
    it('should blow up if parent product missing all children', async () => {
      const inmateJwt = SecurityFactory.inmateJwt({
        customerId: 'I-123456',
        siteId: '11111',
        custodyAccount: 'inmateId',
        callPartyId: 'callPartyId',
      });
      const product = ModelFactory.pricedProduct(
        {
          productId: 1,
          productTypeId: 'movie',
          productTypeGroupId: 'movie',
          purchaseCode: 'VIDEO',
          purchaseTypes: ['subscription'],
          meta: {
            name: 'My product',
            description: 'my prod description',
            thumbnail: 'http://dev.null',
            basePrice: { rental: 10.88 },
            billingInterval: {
              count: 1,
              intervalUnit: 'months',
            },
          },
          version: 100,
          childProductIds: [1, 3, 5],
          childProducts: [],
        } as any as Product,
        10.88,
        'subscription',
      );
      mockProductMan
        .expects('findOneByProductIdOrFail')
        .withArgs(product.productId, true, { inmateJwt })
        .returns(product);
      mockTokenMan.expects('generateJwt').never();

      try {
        await controller.getPurchaseToken(
          `${product.productId}`,
          'subscription',
          { inmateJwt },
          response,
        );
        assert.fail();
      } catch (err) {
        assert.equal(err.name, Exception.InvalidData.name, err);
        assert.deepEqual(err.errors, [
          `Purchase not available for [${product.productId}] no included products available for parent product`,
        ]);
      }
      sinon.verify();
    });
    it('should populate fulfillmentType and multiple subscription if on product', async () => {
      const inmateJwt = SecurityFactory.inmateJwt({
        customerId: 'I-123456',
        siteId: '11111',
        custodyAccount: 'inmateId',
        callPartyId: 'callPartyId',
      });
      const product = ModelFactory.pricedProduct(
        {
          productId: 1,
          productTypeId: 'car',
          productTypeGroupId: 'vehicle',
          purchaseCode: 'VEHICLE',
          purchaseTypes: ['rental'],
          fulfillmentType: 'physical',
          meta: {
            name: 'My product',
            description: 'my prod description',
            thumbnail: 'http://dev.null',
            basePrice: { rental: 10.88 },
            multipleSubscription: true,
          },
          version: 100,
        } as any as Product,
        10.88,
      );
      mockProductMan
        .expects('findOneByProductIdOrFail')
        .withArgs(product.productId, true, { inmateJwt })
        .returns(product);
      mockTokenMan
        .expects('generateJwt')
        .withArgs({
          customerId: 'I-123456',
          siteId: '11111',
          inmateId: 'inmateId',
          custodyAccount: 'inmateId',
          callPartyId: 'callPartyId',
          purchaseType: 'rental',
          purchaseCode: 'VEHICLE',
          product: {
            productId: 1,
            price: 10.88,
            name: 'My product',
            description: 'my prod description',
            thumbnail: 'http://dev.null',
            productType: 'car',
            productTypeGroupId: 'vehicle',
            priceDetail: product.purchaseOptions[0].priceDetails,
            version: 100,
            fulfillmentType: 'physical',
            multipleSubscription: true,
          },
        })
        .resolves('here is my jwt');

      const mockResponse = sinon.mock(response);
      mockResponse
        .expects('contentType')
        .withArgs('application/jwt')
        .returnsThis();
      mockResponse.expects('send').withArgs('here is my jwt');

      await controller.getPurchaseToken(
        `${product.productId}`,
        'rental',
        { inmateJwt },
        response,
      );

      mockProductMan.verify();
      mockTokenMan.verify();
    });
  });
  describe('getMemberPurchaseToken', () => {
    let response: ApiResponse;
    beforeEach(() => {
      response = {
        contentType: () => null,
        send: () => null,
      } as any as ApiResponse;
    });
    it('should call build subscription token', async () => {
      const inmateJwt = SecurityFactory.inmateJwt({
        customerId: 'I-123456',
        siteId: '11111',
        custodyAccount: 'inmateId',
        callPartyId: 'callPartyId',
      });
      const product = ModelFactory.pricedProduct(
        {
          productId: 1,
          productTypeId: 'movie',
          productTypeGroupId: 'movie',
          purchaseCode: 'VIDEO',
          purchaseTypes: ['rental'],
          meta: {
            name: 'My product',
            description: 'my prod description',
            thumbnail: 'http://dev.null',
            basePrice: { rental: 10.88 },
          },
          subscriptionIds: [3308, 124],
          version: 100,
        } as any as Product,
        10.88,
      );
      product.purchaseOptions.push({
        type: 'subscription',
        totalPrice: 0,
        priceDetails: [
          {
            name: 'Price',
            amount: 0,
            type: PriceDetailType.Price,
          },
        ],
      });

      mockProductMan
        .expects('findOneByProductIdOrFail')
        .withArgs(123, false, { inmateJwt })
        .returns(product);
      mockTokenMan
        .expects('generateJwt')
        .withArgs({
          customerId: 'I-123456',
          siteId: '11111',
          inmateId: 'inmateId',
          custodyAccount: 'inmateId',
          callPartyId: 'callPartyId',
          purchaseType: 'subscription',
          purchaseCode: 'VIDEO',
          product: {
            productId: 1,
            price: 0,
            name: 'My product',
            description: 'my prod description',
            fulfillmentType: 'digital',
            thumbnail: 'http://dev.null',
            productType: 'movie',
            productTypeGroupId: 'movie',
            priceDetail: product.purchaseOptions[1].priceDetails,
            version: 100,
            parentProductId: 3308,
            billingInterval: undefined,
          },
        })
        .resolves('here is my jwt');

      const mockResponse = sinon.mock(response);
      mockResponse
        .expects('contentType')
        .withArgs('application/jwt')
        .returnsThis();
      mockResponse.expects('send').withArgs('here is my jwt');

      await controller.getMemberPurchaseToken(
        '3308',
        '123',
        'subscription',
        { inmateJwt },
        response,
      );

      mockProductMan.verify();
      mockTokenMan.verify();
    });
    it('should failed build subscription token if no product matching for subscription', async () => {
      const inmateJwt = SecurityFactory.inmateJwt({
        customerId: 'I-123456',
        siteId: '11111',
        custodyAccount: 'inmateId',
        callPartyId: 'callPartyId',
      });
      const subscriptionProductId = 3308;
      const memberProductId = 123;
      const product = ModelFactory.pricedProduct(
        {
          productId: memberProductId,
          productTypeId: 'movie',
          productTypeGroupId: 'movie',
          purchaseCode: 'VIDEO',
          purchaseTypes: ['rental'],
          meta: {
            name: 'My product',
            description: 'my prod description',
            thumbnail: 'http://dev.null',
            basePrice: { rental: 10.88 },
          },
          subscriptionIds: [124], // subscriptionIds does not contain 3308 meaning it's not in the subscription
          version: 100,
        } as any as Product,
        10.88,
      );
      mockProductMan
        .expects('findOneByProductIdOrFail')
        .withArgs(123, false, { inmateJwt })
        .returns(product);
      try {
        await controller.getMemberPurchaseToken(
          `${subscriptionProductId}`,
          `${memberProductId}`,
          'subscription',
          { inmateJwt },
          response,
        );
        expect.fail();
      } catch (ex) {
        expect(ex.name).to.equal(Exception.NotFound.name);
        expect(ex.errors).to.deep.equal([
          `The memberProduct: ${memberProductId} does not exist or is not in the subscription: ${subscriptionProductId}`,
        ]);
      }
      mockProductMan.verify();
    });
  });
  describe('createProduct', () => {
    it('should call ProductManager.createProduct', async () => {
      const product = ModelFactory.product();
      const apiKey = 'TEST_API_KEY';
      mockProductMan
        .expects('createProduct')
        .withExactArgs(product, { apiKey });
      await controller.createProduct(product, { apiKey });
      mockProductMan.verify();
    });
  });
  describe('updateProduct', () => {
    it('should call ProductManager.updateProduct', async () => {
      const product = ModelFactory.product();
      const apiKey = 'TEST_API_KEY';
      mockProductMan
        .expects('updateProduct')
        .withExactArgs(product, { apiKey });
      await controller.updateProduct(_.toString(product.productId), product, {
        apiKey,
      });
      mockProductMan.verify();
    });
    it('should get a 400 for mismatched productIds', async () => {
      const product = ModelFactory.product();
      try {
        await controller.updateProduct('123', product, {
          corpJwt: SecurityFactory.corpJwt(),
        });
        assert.fail();
      } catch (err) {
        assert.equal(err.code, 400);
      }
      mockProductMan.verify();
    });
  });
  describe('subscriptionSearchProducts', () => {
    it('should call ProductManager.searchProductsBySubscription', async () => {
      const search = { term: 'foo' };
      const securityContext = {};
      const expectedResults: Paginated<Product> = {
        data: [ModelFactory.product()],
        total: 1,
        pageNumber: 0,
        pageSize: 25,
      };
      mockProductMan
        .expects('enforceSearchSecurityContext')
        .withArgs(search, securityContext)
        .returns(search);
      mockProductMan
        .expects('searchProductsBySubscription')
        .withArgs(search)
        .returns(expectedResults);
      const actualResults = await controller.searchProductsBySubscription(
        search,
        '123',
        securityContext,
      );
      mockProductMan.verify();
      assert.deepEqual(actualResults, expectedResults);
    });
    it('should call ProductManager.searchProductsBySubscription with enforced context for inmateJwt', async () => {
      const search = {
        term: 'foo',
        context: {
          enforce: false,
          customerId: 'im lying',
          siteId: 'still lying',
        },
      };
      const securityContext = {
        inmateJwt: SecurityFactory.inmateJwt({
          customerId: 'customerId',
          siteId: 'siteId',
        }),
      };
      const actualSearch = {
        term: 'foo',
        context: { enforce: true, customerId: 'customerId', siteId: 'siteId' },
      };
      const expectedResults: Paginated<Product> = {
        data: [ModelFactory.product()],
        total: 1,
        pageNumber: 0,
        pageSize: 25,
      };
      mockProductMan
        .expects('enforceSearchSecurityContext')
        .withArgs(search, securityContext)
        .returns(actualSearch);
      mockProductMan
        .expects('searchProductsBySubscription')
        .withArgs(actualSearch)
        .returns(expectedResults);
      const actualResults = await controller.searchProductsBySubscription(
        search,
        '123',
        securityContext,
      );
      mockProductMan.verify();
      assert.deepEqual(actualResults, expectedResults);
    });
  });
  describe('blockProduct', () => {
    it('should call BlocklistActionManager.manualBlocklistProduct with isBlocked: true', async () => {
      const product = ModelFactory.product({
        productId: 123,
      });
      const apiKey = 'TEST_API_KEY';
      mockProductMan
        .expects('findOneByProductIdOrFail')
        .withExactArgs(product.productId, false, { apiKey })
        .resolves(product);
      mockManualBlocklistManager
        .expects('manualBlocklistProduct')
        .withExactArgs(
          product,
          true,
          { apiKey },
          ManuallyBlockedReason.Nonstandard,
        )
        .resolves();
      await controller.blockProduct(
        product.productId.toString(),
        { manuallyBlockedReason: ManuallyBlockedReason.Nonstandard },
        { apiKey },
      );
      sinon.verify();
    });
    it('should handle error while calling BlocklistActionManager.manualBlocklistProduct', async () => {
      const product = ModelFactory.product({
        productId: 123,
      });
      const apiKey = 'TEST_API_KEY';
      mockProductMan
        .expects('findOneByProductIdOrFail')
        .withExactArgs(product.productId, false, { apiKey })
        .resolves(product);
      mockManualBlocklistManager
        .expects('manualBlocklistProduct')
        .withExactArgs(
          product,
          true,
          { apiKey },
          ManuallyBlockedReason.Nonstandard,
        )
        .rejects(new Error('UNKNOWN_EXCEPTION'));

      try {
        await controller.blockProduct(
          product.productId.toString(),
          { manuallyBlockedReason: ManuallyBlockedReason.Nonstandard },
          { apiKey },
        );
        assert.fail('UNKNOWN_EXCEPTION');
      } catch (err) {
        assert.equal(err.message, 'UNKNOWN_EXCEPTION');
      }
      sinon.verify();
    });
  });
  describe('unblockProduct', () => {
    it('should call BlocklistActionManager.manualBlocklistProduct with isBlocked: false', async () => {
      const product = ModelFactory.product({
        productId: 123,
      });
      const apiKey = 'TEST_API_KEY';
      mockProductMan
        .expects('findOneByProductIdOrFail')
        .withExactArgs(product.productId, false, { apiKey })
        .resolves(product);
      mockManualBlocklistManager
        .expects('manualBlocklistProduct')
        .withExactArgs(product, false, { apiKey })
        .resolves();
      await controller.unblockProduct(product.productId.toString(), { apiKey });
      sinon.verify();
    });
    it('should handle error while calling BlocklistActionManager.manualBlocklistProduct', async () => {
      const product = ModelFactory.product({
        productId: 123,
      });
      const apiKey = 'TEST_API_KEY';
      mockProductMan
        .expects('findOneByProductIdOrFail')
        .withExactArgs(product.productId, false, { apiKey })
        .resolves(product);
      mockManualBlocklistManager
        .expects('manualBlocklistProduct')
        .withExactArgs(product, false, { apiKey })
        .rejects(new Error('UNKNOWN_EXCEPTION'));
      try {
        await controller.unblockProduct(product.productId.toString(), {
          apiKey,
        });
        assert.fail('UNKNOWN_EXCEPTION');
      } catch (err) {
        assert.equal(err.message, 'UNKNOWN_EXCEPTION');
      }
      sinon.verify();
    });
  });
  describe('updateThumbnailStatus', () => {
    it('should call ProductManager.updateThumbnailStatus and update thumbnailApproved status', async () => {
      const securityContext = {};
      const updatedApprovalStatus = faker.random.arrayElement(
        _.values(ThumbnailApprovedStatus),
      );
      const product = ModelFactory.product({
        productId: 1,
        productTypeId: 'album',
        meta: { thumbnailApproved: ThumbnailApprovedStatus.Pending },
      });
      mockProductMan
        .expects('findOneByProductIdOrFail')
        .withExactArgs(1, true, securityContext)
        .resolves(product);
      mockProductTypeMan
        .expects('getProductType')
        .withExactArgs('album')
        .resolves({ jsonSchema: ModelFactory.testAlbumSchema() });
      mockProductMan
        .expects('updateProductThumbnailStatus')
        .withExactArgs(product, updatedApprovalStatus, securityContext)
        .resolves();
      await controller.updateThumbnailStatus(
        '1',
        { approvalStatus: updatedApprovalStatus },
        securityContext,
      );
      mockProductMan.verify();
    });
    it('throw error if product doesnt have a thumbnailApproved on schema', async () => {
      try {
        const securityContext = {};
        const productId = '1';
        const expectedResult = ModelFactory.product({
          productId: 1,
          productTypeId: 'movie',
          meta: { thumbnailApproved: undefined },
        });
        mockProductMan
          .expects('findOneByProductIdOrFail')
          .withExactArgs(parseInt(productId, 10), true, securityContext)
          .resolves(expectedResult);
        mockProductTypeMan
          .expects('getProductType')
          .withExactArgs('movie')
          .resolves({ jsonSchema: ModelFactory.testMovieSchema() });
        await controller.updateThumbnailStatus(
          productId,
          { approvalStatus: ThumbnailApprovedStatus.Approved },
          securityContext,
        );
        mockProductMan.verify();
      } catch (ex) {
        expect(ex.name).to.equal(Exception.InvalidData.name);
        expect(ex.errors).to.deep.equal([
          'productId [1] is not allowed for thumbnail approval',
        ]);
      }
    });
    it('throw error if approvalStatus params value is not acceptable', async () => {
      try {
        const securityContext = {};
        const productId = '1';
        const expectedResult = ModelFactory.product({
          productId: 1,
          productTypeId: 'album',
          meta: { thumbnailApproved: ThumbnailApprovedStatus.Pending },
        });
        mockProductMan
          .expects('findOneByProductIdOrFail')
          .withExactArgs(parseInt(productId, 10), true, securityContext)
          .resolves(expectedResult);
        mockProductTypeMan
          .expects('getProductType')
          .withExactArgs('album')
          .resolves({ jsonSchema: ModelFactory.testAlbumSchema() });
        await controller.updateThumbnailStatus(
          productId,
          { approvalStatus: 'invalidStatus' } as any,
          securityContext,
        );
        mockProductMan.verify();
      } catch (ex) {
        expect(ex.name).to.equal(Exception.InvalidData.name);
        expect(ex.errors).to.deep.equal([
          'approvalStatus [invalidStatus] is not allowed',
        ]);
      }
    });
  });

  describe('updateThumbnailStatusBulk', () => {
    it('should call ProductManager.updateThumbnailStatusBulk and update thumbnailApproved status', async () => {
      const securityContext = {};
      const productIds = [1, 2, 3];
      const updatedApprovalStatus = ThumbnailApprovedStatus.Approved;

      mockProductMan
        .expects('updateProductThumbnailStatusBulk')
        .withExactArgs(productIds, updatedApprovalStatus, securityContext)
        .resolves();

      await controller.updateThumbnailStatusBulk(
        { productIds, approvalStatus: updatedApprovalStatus },
        securityContext,
      );
      mockProductMan.verify();
    });

    it('throw error if approvalStatus params value is not acceptable', async () => {
      try {
        const securityContext = {};
        const productIds = [1, 2, 3];
        await controller.updateThumbnailStatusBulk(
          { productIds, approvalStatus: 'invalidStatus' } as any,
          securityContext,
        );
        mockProductMan.verify();
      } catch (ex) {
        expect(ex.name).to.equal(Exception.InvalidData.name);
        expect(ex.errors).to.deep.equal([
          'approvalStatus [invalidStatus] is not allowed',
        ]);
      }
    });
  });

  describe('downloadSongSample', () => {
    it('should call ProductManager.downloadSongSample', async () => {
      const productId = '123';
      const product = ModelFactory.product({
        productId: parseInt(productId, 10),
      });
      const apiKey = 'TEST_API_KEY';

      mockProductMan
        .expects('findOneByProductIdOrFail')
        .withExactArgs(product.productId, true, { apiKey })
        .resolves(product);
      mockProductPubMan
        .expects('publishSongSampleDownloadRequest')
        .withExactArgs(product)
        .resolves();

      await controller.downloadSongSample(productId, {
        apiKey,
      });
      mockProductMan.verify();
      mockProductPubMan.verify();
    });
  });

  describe('getProductByVendor', () => {
    it('should return product', async () => {
      const expectedResults: Product = ModelFactory.product();
      mockProductMan
        .expects('findOneByVendorProductId')
        .withArgs(
          expectedResults.source.vendorProductId,
          expectedResults.source.vendorName,
          expectedResults.productTypeId,
        )
        .resolves(expectedResults);
      const actualResults = await controller.getProductByVendor(
        expectedResults.source.vendorName,
        expectedResults.source.vendorProductId,
        expectedResults.productTypeId,
      );
      mockProductMan.verify();
      assert.deepEqual(actualResults, expectedResults);
    });

    it('should throw NotFound and not return product', async () => {
      const expectedResults: Product = ModelFactory.product();
      mockProductMan
        .expects('findOneByVendorProductId')
        .withArgs(
          expectedResults.source.vendorProductId,
          'no name vendor',
          expectedResults.productTypeId,
        )
        .resolves(undefined);
      try {
        await controller.getProductByVendor(
          'no name vendor',
          expectedResults.source.vendorProductId,
          expectedResults.productTypeId,
        );
      } catch (error) {
        expect(error.name).to.equal(Exception.NotFound.name);
        expect(error.errors).to.deep.equal([
          `No product was found with Vendor Product ID = ${expectedResults.source.vendorProductId}`,
        ]);
      }
      mockProductMan.verify();
    });
  });

  describe('republish', () => {
    it('should call messaging for every item in the query', async () => {
      const items = [
        ModelFactory.product({ version: 0 }),
        ModelFactory.product({ version: 1 }),
      ];
      mockProductMan
        .expects('searchByQueryString')
        .withArgs({ enforce: 'false' })
        .resolves({ data: items });
      mockProductPubMan
        .expects('publishProductMessage')
        .withArgs(items[0])
        .resolves();
      mockProductPubMan
        .expects('publishProductMessage')
        .withArgs(items[1])
        .rejects();
      const result = await controller.republish(
        { query: {} } as any as Request,
        { apiKey: 'API_KEY_DEV' },
      );

      expect(result.success[0]).to.deep.equal(
        _.pick(items[0], 'productId', 'productTypeId', 'productTypeGroupId'),
      );
      expect(result.failure[0]).to.deep.equal(
        _.pick(items[1], 'productId', 'productTypeId', 'productTypeGroupId'),
      );
      sinon.verify();
    });
    it('should throw an error if page size is too large', async () => {
      try {
        await controller.republish(
          { query: { pageSize: '5001' } } as any as Request,
          { apiKey: 'API_KEY_DEV' },
        );
        expect.fail();
      } catch (error) {
        expect(error.errors).to.deep.equal([
          `PageSize 5001 is larger than the limit of 5000`,
        ]);
        expect(error.code).to.equal(400);
      }
    });
  });

  describe('getWebViewsByPackageId', () => {
    it('should return webViews for a tablet package', async () => {
      const customerId = 'I-003320';
      const siteId = '09340';
      const securityContext = {
        inmateJwt: SecurityFactory.inmateJwt({ customerId, siteId }),
      };
      const expectedResult: Product[] = [
        {
          ...ModelFactory.product({ version: 0 }),
          productId: 5,
          meta: {
            name: 'test',
            category: 'test',
            webViewUrl: 'https://cats.com',
            displayPriority: 1,
          },
        },
        {
          ...ModelFactory.product({ version: 1 }),
          productId: 6,
          meta: {
            name: 'test2',
            category: 'test',
            webViewUrl: 'https://dogs.com',
            displayPriority: 2,
          },
        },
      ];
      mockProductMan
        .expects('findWebViewsByPackageId')
        .withExactArgs(12345, securityContext)
        .resolves(expectedResult);

      const result = await controller.getWebViewsByPackageId(
        '12345',
        securityContext,
      );

      expect(result).to.deep.equal(expectedResult);

      mockProductMan.verify();
    });
    it('should throw an exception if no webviews for a package are found', async () => {
      const packageId = '12345';
      const customerId = 'I-003320';
      const siteId = '09340';
      const securityContext = {
        inmateJwt: SecurityFactory.inmateJwt({ customerId, siteId }),
      };

      mockProductMan
        .expects('findWebViewsByPackageId')
        .withExactArgs(12345, securityContext)
        .resolves([]);

      try {
        await controller.getWebViewsByPackageId(packageId, securityContext);
        expect.fail();
      } catch (ex) {
        expect(ex.name).to.equal(Exception.NotFound.name);
        expect(ex.errors).to.deep.equal([
          `No webViews for package exists with package Id = ${packageId}`,
        ]);
      }

      mockProductMan.verify();
    });
  });
});

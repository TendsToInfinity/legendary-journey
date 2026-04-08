import { JsonSchemaParser } from '@securustablets/libraries.json-schema';
import { expect } from 'chai';
import * as sinon from 'sinon';
import { CatalogService } from '../../../../src/CatalogService';
import { VendorNames } from '../../../../src/controllers/models/Product';
import { ProductTypeDao } from '../../../../src/data/PGCatalog/ProductTypeDao';
import { ProductManager } from '../../../../src/lib/ProductManager';
import { MessagingConstants } from '../../../../src/messaging/MessagingConstants';
import { CDNFailureHandler } from '../../../../src/messaging/handlers/CDNFailureHandler';
import { fakeGetSchemaForInterface } from '../../../utils/FakeGetSchemaForInterface';
import { ModelFactory } from '../../../utils/ModelFactory';
import * as client from '../../../utils/client';
import { IntegrationTestSuite } from '../../IntegrationTestSuite';

describe('CDNFailureHandler - Integration', function () {
  IntegrationTestSuite.setUp(this);
  let productMan: ProductManager;
  let productTypeDao: ProductTypeDao;
  let cdnFailureHandler: CDNFailureHandler;

  before(() => {
    CatalogService.bindAll();
  });

  beforeEach(async () => {
    const stubGetSchemaForInterface = sinon.stub(
      JsonSchemaParser,
      'getSchemaForInterface',
    );
    stubGetSchemaForInterface.callsFake(fakeGetSchemaForInterface);
    await client.clearCache();
    productMan = new ProductManager();
    productTypeDao = new ProductTypeDao();
    cdnFailureHandler = new CDNFailureHandler();
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('handleMessage', () => {
    it('should update product to availableForSubscription false', async () => {
      const routingKey = MessagingConstants.CIDN_ORDER_PRODUCT_UNSUBSCRIBABLE;
      const trackType = await productTypeDao.findOneOrFail('track');
      const product = ModelFactory.productFromSchema(trackType.jsonSchema, {
        source: {
          productTypeId: 'track',
          availableForSubscription: true,
          availableForPurchase: true,
        },
      });
      const message = {
        vendorName: product.source.vendorName as VendorNames,
        vendorProductId: product.source.vendorProductId,
        productTypeId: product.source.productTypeId,
        error: 'error',
      };

      product.productId = await productMan.createProduct(product, {
        apiKey: 'test',
      });

      await cdnFailureHandler.handleMessage(routingKey, message);

      const updatedProduct = await productMan.findOneOrFail(product.productId);

      expect(updatedProduct.source.availableForSubscription).to.equal(false);
      expect(updatedProduct.source.availableForPurchase).to.equal(true);
    });
    it('should update product to availableForPurchase false', async () => {
      const routingKey = MessagingConstants.CIDN_ORDER_PRODUCT_UNPURCHASABLE;
      const trackType = await productTypeDao.findOneOrFail('track');
      const product = ModelFactory.productFromSchema(trackType.jsonSchema, {
        source: {
          productTypeId: 'track',
          availableForSubscription: true,
          availableForPurchase: true,
        },
      });
      const message = {
        vendorName: product.source.vendorName as VendorNames,
        vendorProductId: product.source.vendorProductId,
        productTypeId: product.source.productTypeId,
        error: 'error',
      };

      product.productId = await productMan.createProduct(product, {
        apiKey: 'test',
      });

      await cdnFailureHandler.handleMessage(routingKey, message);

      const updatedProduct = await productMan.findOneOrFail(product.productId);

      expect(updatedProduct.source.availableForSubscription).to.equal(true);
      expect(updatedProduct.source.availableForPurchase).to.equal(false);
    });
  });
});

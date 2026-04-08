import { _ } from '@securustablets/libraries.utils';
import { expect } from 'chai';
import * as sinon from 'sinon';
import { ProductStatus } from '../../../../src/controllers/models/Product';
import { LegacyInactiveProductHandler } from '../../../../src/messaging/handlers/LegacyInactiveProductHandler';
import { ModelFactory } from '../../../utils/ModelFactory';

describe('LegacyInactiveProductHandler - Unit', () => {
  let legacyInactiveProductHandler: LegacyInactiveProductHandler;
  let mockProductManager: sinon.SinonMock;
  let mockLogger: sinon.SinonMock;

  beforeEach(() => {
    legacyInactiveProductHandler = new LegacyInactiveProductHandler();
    mockProductManager = sinon.mock(
      (legacyInactiveProductHandler as any).productManager,
    );
    mockLogger = sinon.mock((legacyInactiveProductHandler as any).log);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('handleMessage', () => {
    it('should call createProduct', async () => {
      const routingKey = 'test';
      const product = ModelFactory.product({
        source: {
          vendorName: 'Test Vendor Name',
          vendorProductId: '121',
          vendorParentProductId: '123',
        },
        childProductIds: [1, 2, 3],
      });

      const inActiveProduct = _.clone(product);
      inActiveProduct.status = ProductStatus.Inactive;
      inActiveProduct.source.availableForSubscription = false;
      inActiveProduct.source.availableForPurchase = false;

      mockProductManager
        .expects('findOneByVendorProductId')
        .withExactArgs('121', 'Test Vendor Name', product.productTypeId)
        .resolves();

      mockProductManager
        .expects('createProduct')
        .withExactArgs(inActiveProduct, { routingKey })
        .resolves(1);

      await legacyInactiveProductHandler.handleMessage(routingKey, { product });

      mockProductManager.verify();
    });

    it('should omit childProductIds and call createProduct', async () => {
      const routingKey = 'test';

      const product = ModelFactory.product({
        source: {
          vendorName: 'Test Vendor Name',
          vendorProductId: '121',
        },
        childProductIds: [1, 2, 3],
      });

      const inActiveProduct = _.clone(product);
      inActiveProduct.status = ProductStatus.Inactive;
      inActiveProduct.source.availableForSubscription = false;
      inActiveProduct.source.availableForPurchase = false;
      inActiveProduct.childProductIds = [];

      mockProductManager
        .expects('findOneByVendorProductId')
        .withExactArgs(
          product.source?.vendorProductId,
          product.source?.vendorName,
          product.productTypeId,
        )
        .resolves();

      mockProductManager
        .expects('createProduct')
        .withExactArgs(inActiveProduct, { routingKey })
        .resolves(1);

      await legacyInactiveProductHandler.handleMessage(routingKey, { product });

      mockProductManager.verify();
    });

    it('should return out if existing product', async () => {
      const routingKey = 'test';
      const product = ModelFactory.product({
        source: {
          vendorName: 'Test Vendor Name',
          vendorProductId: '121',
          vendorParentProductId: '123',
        },
        childProductIds: [1, 2, 3],
      });

      mockProductManager
        .expects('findOneByVendorProductId')
        .withExactArgs('121', 'Test Vendor Name', product.productTypeId)
        .resolves(product);

      mockProductManager.expects('createProduct').never();

      await legacyInactiveProductHandler.handleMessage(routingKey, { product });

      mockProductManager.verify();
    });

    it('should log information for debug', async () => {
      const routingKey = 'test';
      const err = 'test';
      const product = ModelFactory.product();
      delete product.source;

      mockProductManager
        .expects('findOneByVendorProductId')
        .withExactArgs(
          product.source?.vendorProductId,
          product.source?.vendorName,
          product.productTypeId,
        )
        .throws({ message: err });

      mockLogger.expects('error').twice();

      try {
        await legacyInactiveProductHandler.handleMessage(routingKey, {
          product,
        });
        expect.fail();
      } catch (ex) {
        expect(ex.message).to.contain(err);
      }
      mockLogger.verify();
    });
  });
});

import { expect } from 'chai';
import * as sinon from 'sinon';
import { ProductUpsertRequestHandler } from '../../../../src/messaging/handlers/ProductUpsertRequestHandler';
import { ModelFactory } from '../../../utils/ModelFactory';

describe('ProductUpsertRequestHandler - Unit', () => {
  let productUpsertRequestHandler: ProductUpsertRequestHandler;
  let mockProductManager: sinon.SinonMock;
  let mockLogger: sinon.SinonMock;

  beforeEach(() => {
    productUpsertRequestHandler = new ProductUpsertRequestHandler();
    mockProductManager = sinon.mock(
      (productUpsertRequestHandler as any).productManager,
    );
    mockLogger = sinon.mock((productUpsertRequestHandler as any).log);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('handleMessage', () => {
    it('should call updateProduct with exact parameters', async () => {
      const routingKey = 'test';
      const product = ModelFactory.product();
      const oldProduct = { ...product, meta: { name: 'Test Product Name' } };

      mockProductManager
        .expects('findOneByVendorProductId')
        .withExactArgs(
          product.source.vendorProductId,
          product.source.vendorName,
          product.productTypeId,
        )
        .resolves(oldProduct);

      mockProductManager
        .expects('updateProduct')
        .withExactArgs(product, { routingKey })
        .resolves();

      await productUpsertRequestHandler.handleMessage(routingKey, { product });

      mockProductManager.verify();
    });

    it('should call createProduct', async () => {
      const routingKey = 'test';
      const product = ModelFactory.product({
        source: {
          vendorName: 'Test Vendor Name',
          vendorProductId: '121',
          vendorParentProductId: '123',
        },
      });

      mockProductManager
        .expects('findOneByVendorProductId')
        .withExactArgs('121', 'Test Vendor Name', product.productTypeId)
        .resolves();

      mockProductManager
        .expects('createProduct')
        .withExactArgs(product, { routingKey })
        .resolves(1);

      await productUpsertRequestHandler.handleMessage(routingKey, { product });

      mockProductManager.verify();
    });

    it('should cover null validation and call createProduct', async () => {
      const routingKey = 'test';

      const product = ModelFactory.product({
        source: null,
      });

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
        .withExactArgs(product, { routingKey })
        .resolves(1);

      await productUpsertRequestHandler.handleMessage(routingKey, { product });

      mockProductManager.verify();
    });

    it('should log information for debug', async () => {
      const routingKey = 'test';
      const err = 'test';
      const product = ModelFactory.product({
        source: null,
      });

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
        await productUpsertRequestHandler.handleMessage(routingKey, {
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

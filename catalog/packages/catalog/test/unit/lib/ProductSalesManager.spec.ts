import { CorpJwt } from '@securustablets/libraries.httpsecurity';
import { JsonSchemaParser } from '@securustablets/libraries.json-schema';
import { SecurityFactory } from '@securustablets/libraries.utils-test';
import { expect } from 'chai';
import * as sinon from 'sinon';
import { ProductTypeIds } from '../../../src/controllers/models/Product';
import { ProductSalesManager } from '../../../src/lib/ProductSalesManager';
import { fakeGetSchemaForInterface } from '../../utils/FakeGetSchemaForInterface';
import { ModelFactory } from '../../utils/ModelFactory';

describe('ProductSalesManager - Unit', () => {
  let manager: ProductSalesManager;
  let mockProductSalesDao: sinon.SinonMock;
  let mockProductDao: sinon.SinonMock;
  let mockOpenSearchManager: sinon.SinonMock;

  beforeEach(() => {
    const stubGetSchemaForInterface = sinon.stub(
      JsonSchemaParser,
      'getSchemaForInterface',
    );
    stubGetSchemaForInterface.callsFake(fakeGetSchemaForInterface);
    manager = new ProductSalesManager();
    mockProductSalesDao = sinon.mock((manager as any).productSalesDao);
    mockOpenSearchManager = sinon.mock((manager as any).openSearchManager);
    mockProductDao = sinon.mock((manager as any).productDao);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('incrementCompletedOrders', () => {
    it('should increment orders for product', async () => {
      const productSales = ModelFactory.productSales();
      delete productSales.artistProductId;

      mockProductSalesDao
        .expects('increment')
        .withExactArgs(productSales.productSalesId, 'completedOrders')
        .resolves();
      mockOpenSearchManager
        .expects('incrementProductTotalSales')
        .withExactArgs(productSales.productId, productSales.productTypeId, 1)
        .resolves(true);

      const result = await manager.incrementCompletedOrders(
        productSales.productSalesId,
        productSales.productId,
        productSales.productTypeId,
        undefined,
      );

      expect(result).to.not.equal(null);

      sinon.verify();
    });

    it('should increment orders for product and artist', async () => {
      const productSales = ModelFactory.productSales();

      mockProductSalesDao
        .expects('incrementCompletedOrders')
        .withExactArgs(productSales.productSalesId)
        .resolves();
      mockOpenSearchManager
        .expects('incrementProductTotalSales')
        .withExactArgs(productSales.productId, productSales.productTypeId, 1)
        .resolves(true);
      mockOpenSearchManager
        .expects('incrementProductTotalSales')
        .withExactArgs(productSales.artistProductId, ProductTypeIds.Artist, 1)
        .resolves(true);

      const result = await manager.incrementCompletedOrders(
        productSales.productSalesId,
        productSales.productId,
        productSales.productTypeId,
        productSales.artistProductId,
      );

      expect(result).to.not.equal(null);

      sinon.verify();
    });
  });

  describe('createProductSales', () => {
    it('should create a productSales leveraging artistProductId and parentProductId from productSalesExistingRecord', async () => {
      const productSales = ModelFactory.productSales();

      const corpJwt = SecurityFactory.corpJwt();
      const newProductSalesId = 1;

      mockProductSalesDao
        .expects('findOne')
        .withExactArgs(productSales.productSalesId)
        .resolves(productSales);
      mockProductSalesDao
        .expects('createAndRetrieve')
        .withExactArgs(productSales, { corpJwt })
        .resolves({ ...productSales, productSalesId: newProductSalesId });
      mockOpenSearchManager
        .expects('incrementProductTotalSales')
        .withExactArgs(
          productSales.productId,
          productSales.productTypeId,
          productSales.completedOrders,
        )
        .resolves(true);
      mockOpenSearchManager
        .expects('incrementProductTotalSales')
        .withExactArgs(
          productSales.artistProductId,
          ProductTypeIds.Artist,
          productSales.completedOrders,
        )
        .resolves(true);

      const testProductSales = { ...productSales };
      delete testProductSales.artistProductId;
      delete testProductSales.parentProductId;

      const result = await manager.createProductSales(testProductSales, {
        corpJwt,
      });

      expect(result).to.not.equal(null);

      sinon.verify();
    });

    it('creates a productSales leveraging parentProductId from product', async () => {
      const product = ModelFactory.product({
        parentProductId: 10,
        artistProductId: undefined,
      });
      const productSales = ModelFactory.productSales();
      delete productSales.artistProductId;
      delete productSales.parentProductId;

      const productSalesRes = ModelFactory.productSales({
        parentProductId: product.parentProductId,
        artistProductId: undefined,
      });
      delete productSales.artistProductId;

      const corpJwt = SecurityFactory.corpJwt();

      mockProductSalesDao
        .expects('findOne')
        .withExactArgs(productSales.productSalesId)
        .resolves(undefined);
      mockProductDao
        .expects('findOneOrFail')
        .withExactArgs(productSales.productId)
        .resolves('product');
      mockProductDao
        .expects('findArtist')
        .withExactArgs('product')
        .resolves(undefined);
      mockProductSalesDao
        .expects('createAndRetrieve')
        .withExactArgs(productSales, { corpJwt })
        .resolves(productSalesRes);
      mockOpenSearchManager
        .expects('incrementProductTotalSales')
        .withExactArgs(
          productSales.productId,
          productSales.productTypeId,
          productSales.completedOrders,
        )
        .resolves(true);

      const result = await manager.createProductSales(productSales, {
        corpJwt,
      });

      expect(result).to.not.equal(null);
      expect(productSalesRes.parentProductId).to.equal(product.parentProductId);

      sinon.verify();
    });

    it('creates a productSales leveraging both artistProductId and parentProductId', async () => {
      const product = ModelFactory.product({ parentProductId: 10 });
      const artistProduct = ModelFactory.product({
        productTypeId: ProductTypeIds.Artist,
      });
      const productSales = ModelFactory.productSales();
      delete productSales.parentProductId;
      delete productSales.artistProductId;

      const productSalesRes = ModelFactory.productSales();
      const corpJwt = SecurityFactory.corpJwt();

      mockProductSalesDao
        .expects('findOne')
        .withExactArgs(productSales.productSalesId)
        .resolves(undefined);
      mockProductDao
        .expects('findOneOrFail')
        .withExactArgs(productSales.productId)
        .resolves(product);
      mockProductDao
        .expects('findArtist')
        .withExactArgs(product)
        .resolves(artistProduct);
      mockProductSalesDao
        .expects('createAndRetrieve')
        .withExactArgs(productSales, { corpJwt })
        .resolves(productSalesRes);
      mockOpenSearchManager
        .expects('incrementProductTotalSales')
        .withExactArgs(
          productSales.productId,
          productSales.productTypeId,
          productSales.completedOrders,
        )
        .resolves(true);
      mockOpenSearchManager
        .expects('incrementProductTotalSales')
        .withExactArgs(
          artistProduct.productId,
          ProductTypeIds.Artist,
          productSales.completedOrders,
        )
        .resolves(true);

      const result = await manager.createProductSales(productSales, {
        corpJwt,
      });

      expect(result).to.not.equal(null);
      expect(productSales.artistProductId).to.equal(artistProduct.productId);
      expect(productSales.parentProductId).to.equal(product.parentProductId);

      sinon.verify();
    });

    it('should create a productSales and increment product and artist total sales in OpenSearch', async () => {
      const product = ModelFactory.product({ parentProductId: 10 });
      const productSales = ModelFactory.productSales();
      delete productSales.artistProductId;
      delete productSales.parentProductId;

      const artistProduct = ModelFactory.product();

      const corpJwt = SecurityFactory.corpJwt();
      const newProductSalesId = 1;

      mockProductSalesDao
        .expects('findOne')
        .withExactArgs(productSales.productSalesId)
        .resolves(undefined);
      mockProductDao
        .expects('findOneOrFail')
        .withExactArgs(productSales.productId)
        .resolves(product);
      mockProductDao
        .expects('findArtist')
        .withExactArgs(product)
        .resolves(artistProduct);
      mockProductSalesDao
        .expects('createAndRetrieve')
        .withExactArgs(productSales, { corpJwt })
        .resolves(newProductSalesId);
      mockOpenSearchManager
        .expects('incrementProductTotalSales')
        .withArgs(productSales.productId, productSales.productTypeId)
        .resolves(true);
      mockOpenSearchManager
        .expects('incrementProductTotalSales')
        .withArgs(artistProduct.productId, ProductTypeIds.Artist)
        .resolves(true);

      const result = await manager.createProductSales(productSales, {
        corpJwt,
      });

      expect(result).to.not.equal(null);

      sinon.verify();
    });
  });

  describe('updateProductSales', () => {
    let corpJwt: CorpJwt;

    beforeEach(() => {
      corpJwt = SecurityFactory.corpJwt();
    });

    it('should update the productSales', async () => {
      const productSales = ModelFactory.productSales({ productSalesId: 8235 });
      const updatedProductSales = { ...productSales };
      updatedProductSales.completedOrders++;

      const updateCount =
        updatedProductSales.completedOrders - productSales.completedOrders;

      mockProductSalesDao
        .expects('findOne')
        .withExactArgs(productSales.productSalesId)
        .resolves(productSales);
      mockProductSalesDao
        .expects('updateAndRetrieve')
        .withExactArgs(productSales.productSalesId, productSales, { corpJwt })
        .resolves(updatedProductSales);
      mockOpenSearchManager
        .expects('incrementProductTotalSales')
        .withArgs(
          productSales.productId,
          productSales.productTypeId,
          updateCount,
        )
        .resolves(true);
      mockOpenSearchManager
        .expects('incrementProductTotalSales')
        .withArgs(
          productSales.artistProductId,
          ProductTypeIds.Artist,
          updateCount,
        )
        .resolves(true);

      await manager.updateProductSales(productSales, { corpJwt });

      sinon.verify();
    });

    it('should update the productSales with no change to completedOrders', async () => {
      const productSales = ModelFactory.productSales({ productSalesId: 8235 });
      const updatedProductSales = { ...productSales };

      mockProductSalesDao
        .expects('findOne')
        .withExactArgs(productSales.productSalesId)
        .resolves(productSales);
      mockProductSalesDao
        .expects('updateAndRetrieve')
        .withExactArgs(productSales.productSalesId, productSales, { corpJwt })
        .resolves(updatedProductSales);
      mockOpenSearchManager.expects('incrementProductTotalSales').never();
      mockOpenSearchManager.expects('incrementProductTotalSales').never();

      await manager.updateProductSales(productSales, { corpJwt });

      sinon.verify();
    });
  });
});

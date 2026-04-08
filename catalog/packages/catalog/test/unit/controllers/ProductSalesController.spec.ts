import { JsonSchemaParser } from '@securustablets/libraries.json-schema';
import { SecurityFactory } from '@securustablets/libraries.utils-test';
import { assert, expect } from 'chai';
import { Request } from 'express';
import * as sinon from 'sinon';
import { ProductSalesController } from '../../../src/controllers/ProductSalesController';
import { ProductManager } from '../../../src/lib/ProductManager';
import { fakeGetSchemaForInterface } from '../../utils/FakeGetSchemaForInterface';
import { ModelFactory } from '../../utils/ModelFactory';

describe('ProductSalesController - Unit', () => {
  let controller: ProductSalesController;
  let mockDao: sinon.SinonMock;
  let productManager: ProductManager;
  let mockProductSalesManager: sinon.SinonMock;

  beforeEach(() => {
    const stubGetSchemaForInterface = sinon.stub(
      JsonSchemaParser,
      'getSchemaForInterface',
    );
    stubGetSchemaForInterface.callsFake(fakeGetSchemaForInterface);
    controller = new ProductSalesController();
    mockProductSalesManager = sinon.mock(
      (controller as any).productSalesManager,
    );
    productManager = new ProductManager();
    mockDao = sinon.mock((controller as any).productSalesDao);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('findProductSales', () => {
    it('should provide defaults and call ProductSalesDao.findProductSales', async () => {
      mockDao.expects('findByQueryString').withArgs({});
      await controller.findProductSales({ query: {} } as Request);
      mockDao.verify();
    });
  });

  describe('createProductSales', () => {
    it('should call productSales.createProductSales', async () => {
      const productSales = ModelFactory.productSales();
      const corpJwt = SecurityFactory.corpJwt();
      const newProductSalesId = 1;

      mockProductSalesManager
        .expects('createProductSales')
        .withArgs(productSales, { corpJwt })
        .resolves(newProductSalesId);
      const result = await controller.createProductSales(productSales, {
        corpJwt,
      });

      expect(result.productSalesId).to.equal(newProductSalesId);

      mockDao.verify();
    });
  });

  describe('updateProductSales', () => {
    const productSales = { ...ModelFactory.productSales(), productSalesId: 1 };
    const corpJwt = SecurityFactory.corpJwt();

    it('should call ProductSales.update', async () => {
      mockProductSalesManager
        .expects('updateProductSales')
        .withArgs(productSales, { corpJwt })
        .resolves();
      await controller.updateProductSales(
        productSales.productSalesId.toString(),
        productSales,
        { corpJwt },
      );

      mockDao.verify();
    });

    it('should get a 400 for mismatched productSalesIds', async () => {
      try {
        await controller.updateProductSales('123', productSales, { corpJwt });
        assert.fail();
      } catch (err) {
        assert.equal(err.code, 400);
      }

      mockDao.verify();
    });
  });
});

import { Postgres } from '@securustablets/libraries.postgres';
import { expect } from 'chai';
import * as sinon from 'sinon';
import { ProductSalesDao } from '../../../src/data/PGCatalog/ProductSalesDao';
import { MockUtils } from '../../utils/MockUtils';
import { ModelFactory } from '../../utils/ModelFactory';

describe('ProductSalesDao - Unit', () => {
  let productSalesDao: ProductSalesDao;
  let mockPg: sinon.SinonMock;

  beforeEach(() => {
    productSalesDao = new ProductSalesDao();
    mockPg = MockUtils.inject(productSalesDao, '_pg', Postgres);
  });

  describe('create', () => {
    it('create a productSales', async () => {
      const productSales = ModelFactory.productSales();

      const defaultCreateAndRetrieveStub = sinon
        .stub(productSalesDao as any, 'defaultCreateAndRetrieve')
        .resolves(productSales);

      await productSalesDao.createAndRetrieve(productSales, { apiKey: 'test' });

      expect(defaultCreateAndRetrieveStub.called).to.equal(true);
    });

    it('should throw Conflict exception when postgres has error code 23505', async () => {
      const defaultCreateAndRetrieveStub = sinon
        .stub(productSalesDao as any, 'defaultCreateAndRetrieve')
        .rejects({
          code: '23505',
        });

      try {
        await productSalesDao.createAndRetrieve(ModelFactory.productSales(), {
          apiKey: 'test',
        });
        expect.fail();
      } catch (e) {
        expect(defaultCreateAndRetrieveStub.called).to.equal(true);
        expect(e.code).to.equal(409);
        expect(e.errors).to.be.undefined;
      }
    });

    it('should give greater detail of the thrown Conflict exception when postgres has error code 23505 and constraint "product_sales_day_idx"', async () => {
      const defaultCreateAndRetrieveStub = sinon
        .stub(productSalesDao as any, 'defaultCreateAndRetrieve')
        .rejects({
          code: '23505',
          constraint: 'product_sales_day_idx',
        });

      try {
        await productSalesDao.createAndRetrieve(ModelFactory.productSales(), {
          apiKey: 'test',
        });

        expect.fail();
      } catch (e) {
        expect(defaultCreateAndRetrieveStub.called).to.equal(true);
        expect(e.code).to.equal(409);
        expect(e.errors).to.deep.equal([
          'The vendor product ID already exist in this vendor',
        ]);
      }
    });

    it('should throw InternalError exception when postgres has error code other than 23505', async () => {
      const defaultCreateAndRetrieveStub = sinon
        .stub(productSalesDao as any, 'defaultCreateAndRetrieve')
        .rejects({
          code: '23',
        });

      try {
        await productSalesDao.createAndRetrieve(ModelFactory.productSales(), {
          apiKey: 'test',
        });

        expect.fail();
      } catch (e) {
        expect(defaultCreateAndRetrieveStub.called).to.equal(true);
        expect(e.code).to.equal(500);
      }
    });
  });

  describe('increment', () => {
    it('should call increment on completedOrders', async () => {
      const incrementStub = sinon
        .stub(productSalesDao as any, 'increment')
        .resolves();

      await productSalesDao.incrementCompletedOrders(12345);

      expect(incrementStub.called).to.be.true;
    });
  });
});

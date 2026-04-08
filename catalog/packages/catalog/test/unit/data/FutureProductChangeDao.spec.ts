import { Postgres } from '@securustablets/libraries.postgres';
import { assert, expect } from 'chai';
import * as faker from 'faker';
import { Exception } from 'securus.tablets.libraries.exceptions';
import * as sinon from 'sinon';
import { FutureProductChangeDao } from '../../../src/data/PGCatalog/FutureProductChangeDao';
import { MockUtils } from '../../utils/MockUtils';
import { ModelFactory } from '../../utils/ModelFactory';

describe('FutureProductChangeDao - Unit', () => {
  let futureProductDao: FutureProductChangeDao;
  let mockPg: sinon.SinonMock;

  beforeEach(() => {
    futureProductDao = new FutureProductChangeDao();
    mockPg = MockUtils.inject(futureProductDao, '_pg', Postgres);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('findFutureProductByVendorAndDate', () => {
    it('invokes find and returns single future product', async () => {
      const futureProduct = ModelFactory.futureProduct({
        action: {
          meta: { basePrice: { purchase: faker.random.number() } },
          source: {
            msrp: faker.random.alphaNumeric(10),
            wholesalePrice: faker.random.word(),
          },
        },
      });
      const effectiveDate = futureProduct.actionDate;
      const date = effectiveDate.split('T')[0];
      const start = date + 'T00:00:00Z';
      const end = date + 'T23:59:59Z';
      const effectiveDateRange = { start, end };
      const findStub = sinon
        .stub(futureProductDao as any, 'find')
        .withArgs({
          by: {
            productTypeId: futureProduct.productTypeId,
            vendorProductId: futureProduct.vendorProductId,
            vendorName: futureProduct.vendorName,
            actionDate: effectiveDateRange,
            ingestionBatchId: futureProduct.ingestionBatchId,
          },
        })
        .resolves(futureProduct);

      const result = await futureProductDao.findFutureProductByVendorAndDate(
        futureProduct.vendorProductId,
        futureProduct.vendorName,
        futureProduct.actionDate,
        futureProduct.productTypeId,
        futureProduct.ingestionBatchId,
      );

      assert(findStub.calledOnce);
      expect(result).to.deep.equal(futureProduct);
    });

    it('invokes find and returns single future product with correct time', async () => {
      const futureProduct = ModelFactory.futureProduct({
        action: {
          meta: { basePrice: { purchase: faker.random.number() } },
          source: {
            msrp: faker.random.alphaNumeric(10),
            wholesalePrice: faker.random.word(),
          },
        },
      });
      const effectiveDate = futureProduct.actionDate;
      const date = effectiveDate.split('T')[0];
      const start = date + 'T00:00:00Z';
      const end = date + 'T23:59:59Z';
      const effectiveDateRange = { start, end };
      const findStub = sinon
        .stub(futureProductDao as any, 'find')
        .withArgs({
          by: {
            productTypeId: futureProduct.productTypeId,
            vendorProductId: futureProduct.vendorProductId,
            vendorName: futureProduct.vendorName,
            actionDate: effectiveDateRange,
            ingestionBatchId: futureProduct.ingestionBatchId,
          },
        })
        .resolves(futureProduct);

      const result = await futureProductDao.findFutureProductByVendorAndDate(
        futureProduct.vendorProductId,
        futureProduct.vendorName,
        date,
        futureProduct.productTypeId,
        futureProduct.ingestionBatchId,
      );

      assert(findStub.calledOnce);
      expect(result).to.deep.equal(futureProduct);
    });

    it('invokes find and does not return any future product', async () => {
      const findStub = sinon.stub(futureProductDao as any, 'find').resolves();
      const result = await futureProductDao.findFutureProductByVendorAndDate(
        faker.random.word(),
        faker.random.word(),
        faker.random.word(),
        faker.random.word(),
      );

      assert(findStub.calledOnce);
      expect(result).to.deep.equal(undefined);
    });
  });

  describe('findFutureProducts', () => {
    it('invokes findFutureProducts returns future products with total=false', async () => {
      const futureProduct = ModelFactory.futureProduct({
        action: {
          meta: { basePrice: { purchase: faker.random.number() } },
          source: {
            msrp: faker.random.alphaNumeric(10),
            wholesalePrice: faker.random.word(),
          },
        },
      });
      const futureProduct2 = ModelFactory.futureProduct({
        action: {
          meta: { basePrice: { purchase: faker.random.number() } },
          source: {
            msrp: faker.random.alphaNumeric(10),
            wholesalePrice: faker.random.word(),
          },
        },
      });
      const expectedResult = {
        data: [futureProduct, futureProduct2],
        pageSize: 25,
        pageNumber: 0,
        total: undefined,
      };

      const findStub = sinon
        .stub(futureProductDao as any, 'find')
        .resolves([futureProduct, futureProduct2]);
      const params = {
        pageNumber: '0',
        pageSize: '25',
        total: 'false',
        productTypeId: futureProduct.productTypeId,
      };

      const result = await futureProductDao.findFutureProducts(params);
      assert(findStub.calledOnce);
      expect(result).to.deep.equal(expectedResult);
    });

    it('invokes find findFutureProducts returns future products with total', async () => {
      const futureProduct = ModelFactory.futureProduct({
        action: {
          meta: { basePrice: { purchase: faker.random.number() } },
          source: {
            msrp: faker.random.alphaNumeric(10),
            wholesalePrice: faker.random.word(),
          },
        },
      });
      const futureProduct2 = ModelFactory.futureProduct({
        action: {
          meta: { basePrice: { purchase: faker.random.number() } },
          source: {
            msrp: faker.random.alphaNumeric(10),
            wholesalePrice: faker.random.word(),
          },
        },
      });
      const expectedResult = {
        data: [futureProduct, futureProduct2],
        pageSize: 25,
        pageNumber: 0,
        total: 2,
      };
      const findStub = sinon
        .stub(futureProductDao as any, 'find')
        .withArgs({
          by: {
            productTypeId: futureProduct.productTypeId,
          },
          total: true,
          pageNumber: 0,
          pageSize: 25,
          orderBy: undefined,
        })
        .resolves([[futureProduct, futureProduct2], 2]);
      const params = {
        pageNumber: '0',
        pageSize: '25',
        total: 'true',
        productTypeId: futureProduct.productTypeId,
      };

      const result = await futureProductDao.findFutureProducts(params);

      assert(findStub.calledOnce);
      expect(result).to.deep.equal(expectedResult);
    });

    it('invokes find and does not return any future product with date', async () => {
      const expectedResult = {
        data: [],
        pageSize: 25,
        pageNumber: 0,
        total: undefined,
      };

      const effectiveDateRange = {
        start: '2022-04-21',
        end: '2022-04-21 23:59:59',
      };
      const findStub = sinon
        .stub(futureProductDao as any, 'find')
        .withArgs({
          by: {
            actionDate: effectiveDateRange,
          },
          total: false,
          pageNumber: 0,
          pageSize: 25,
          orderBy: undefined,
        })
        .resolves([]);

      const params = {
        pageNumber: '0',
        pageSize: '25',
        total: 'false',
        actionDate: '2022-04-21T20:27:08.238Z',
      };

      const result = await futureProductDao.findFutureProducts(params);
      assert(findStub.calledOnce);
      expect(result).to.deep.equal(expectedResult);
    });

    it('invokes findFutureProducts returns future products with productId filled', async () => {
      const futureProduct = ModelFactory.futureProduct({
        productId: 1234,
        action: {
          meta: { basePrice: { purchase: faker.random.number() } },
          source: {
            msrp: faker.random.alphaNumeric(10),
            wholesalePrice: faker.random.word(),
          },
        },
      });

      const expectedResult = {
        data: [futureProduct],
        pageSize: 25,
        pageNumber: 0,
        total: undefined,
      };

      const findStub = sinon
        .stub(futureProductDao as any, 'find')
        .resolves([futureProduct]);
      const params = {
        pageNumber: '0',
        pageSize: '25',
        total: 'false',
        productTypeId: futureProduct.productTypeId,
        productId: '1234',
      };

      const result = await futureProductDao.findFutureProducts(params);
      assert(findStub.calledOnce);
      expect(result).to.deep.equal(expectedResult);
    });

    it('invokes find and does not return any future product with error in date', async () => {
      const effectiveDateRange = {
        start: '2022-04-21',
        end: '2022-04-21 23:59:59',
      };
      const findStub = sinon
        .stub(futureProductDao as any, 'find')
        .withArgs({
          by: {
            actionDate: effectiveDateRange,
          },
          total: false,
          pageNumber: 0,
          pageSize: 25,
          orderBy: undefined,
        })
        .resolves([]);

      const params = {
        pageNumber: '0',
        pageSize: '25',
        total: 'false',
        actionDate: '2022-04-21T20:27:08.238Z ERROR HERE',
      };

      try {
        await futureProductDao.findFutureProducts(params);
      } catch (error) {
        expect(error.name).to.equal(Exception.InvalidData.name);
        expect(error.errors).to.deep.equal(['Invalid date format']);
        assert(findStub.notCalled);
      }
    });
  });

  describe('productsToUpdateCount', () => {
    it('invokes productsToUpdateCount returns count', async () => {
      const findStub = sinon
        .stub(futureProductDao as any, 'query')
        .resolves({ rows: [{ productscount: 2 }] });
      const result = await futureProductDao.productsToUpdateCount();
      assert(findStub.calledOnce);
      expect(result).to.deep.equal(2);
    });
  });

  describe('futureProductPerformChanges', () => {
    it('invokes futureProductPerformChanges', async () => {
      const futureProduct = ModelFactory.futureProduct({
        action: {
          meta: { basePrice: { purchase: faker.random.number() } },
          source: {
            msrp: faker.random.alphaNumeric(10),
            wholesalePrice: faker.random.word(),
          },
        },
      });
      const futureProduct2 = ModelFactory.futureProduct({
        action: {
          meta: { basePrice: { purchase: faker.random.number() } },
          source: {
            msrp: faker.random.alphaNumeric(10),
            wholesalePrice: faker.random.word(),
          },
        },
      });

      const expectedResult = [futureProduct, futureProduct2];

      const findStub = sinon.stub(futureProductDao as any, 'write').resolves({
        rows: [{ document: futureProduct }, { document: futureProduct2 }],
      });
      const result = await futureProductDao.futureProductPerformChanges();
      assert(findStub.calledOnce);
      expect(result).to.deep.equal(expectedResult);
    });
  });

  describe('convertDateToYMD', () => {
    it('invokes convertDateToYMD', async () => {
      const date = '2022-04-21T20:27:08.238Z';
      const result = futureProductDao.convertDateToYMD(date);
      expect(result).to.deep.equal('2022-04-21');
    });

    it('invokes convertDateToYMD throws error', async () => {
      const date = '2022-04-21 ERROR';
      try {
        futureProductDao.convertDateToYMD(date);
      } catch (error) {
        expect(error.name).to.equal(Exception.InvalidData.name);
        expect(error.errors).to.deep.equal(['Invalid date format']);
      }
    });
  });
});

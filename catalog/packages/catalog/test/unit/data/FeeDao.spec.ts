import { Postgres } from '@securustablets/libraries.postgres';
import { expect } from 'chai';
import { Exception } from 'securus.tablets.libraries.exceptions';
import * as sinon from 'sinon';
import { Fee } from '../../../src/controllers/models/Fee';
import { FeeDao } from '../../../src/data/PGCatalog/FeeDao';
import { MockUtils } from '../../utils/MockUtils';
import { ModelFactory } from '../../utils/ModelFactory';

describe('FeeDao - Unit', () => {
  const sandbox = sinon.createSandbox();
  let feeDao: FeeDao;
  let mockPg: sinon.SinonMock;
  let mockClauseConverter: sinon.SinonMock;
  let mockProductTypeDao: sinon.SinonMock;

  function toRow(fee: Fee) {
    return {
      ...(fee.customerId && { customerId: fee.customerId }),
      ...(fee.siteId && { siteId: fee.siteId }),
      ...(fee.amount && { amount: fee.amount }),
      ...(fee.feeId && { feeId: fee.feeId }),
      percent: fee.percent,
      productTypeId: fee.productTypeId,
      name: fee.name,
      enabled: fee.enabled,
      clauses: fee.clauses,
    };
  }

  beforeEach(() => {
    feeDao = new FeeDao();
    mockPg = MockUtils.inject(feeDao, '_pg', Postgres);
    mockClauseConverter = MockUtils.inject(feeDao, 'clauseConverter');
    mockProductTypeDao = sinon.mock((feeDao as any).productTypeDao);
  });

  afterEach(() => {
    sandbox.restore();
  });

  function verify() {
    mockPg.verify();
    mockProductTypeDao.verify();
    mockClauseConverter.verify();
  }

  describe('convertTo', () => {
    it('should convert', async () => {
      const fee = ModelFactory.fee({
        customerId: 'customerId',
        productTypeId: 'movie',
        clauses: { pls: ['work', 'plspls'] },
      });
      const jsonSchema = ModelFactory.testSchema();
      const convertedClauses = [{ pls: 'work' }, { pls: 'plspls' }];
      mockProductTypeDao
        .expects('findOneOrFail')
        .withArgs('movie')
        .resolves({ jsonSchema });
      mockClauseConverter
        .expects('convertTo')
        .withArgs(fee.clauses, jsonSchema)
        .returns(convertedClauses);
      const converted = await feeDao.convertTo(fee);
      expect(converted).to.deep.equal({
        customer_id: fee.customerId,
        product_type_id: fee.productTypeId,
        name: fee.name,
        enabled: fee.enabled,
        percent: fee.percent,
        fee_id: fee.feeId,
        amount: fee.amount,
        clauses: convertedClauses,
      });
      verify();
    });
    it('should blow up if converting clauses without a productTypeId', async () => {
      const fee = {
        customerId: 'customerId',
        clauses: { pls: ['work', 'plspls'] },
      } as any as Fee;
      mockProductTypeDao.expects('findOneOrFail').never();
      mockClauseConverter.expects('convertTo').never();
      try {
        await feeDao.convertTo(fee);
        expect.fail();
      } catch (err) {
        expect(err.name).to.equal(Exception.InternalError.name, err);
        expect(err.message).to.equal(
          'Cannot convert clauses without a productTypeId.',
        );
      }
      verify();
    });
    it('should support converting without productTypeId or clauses', async () => {
      const fee = { customerId: 'I-003320' } as any as Fee;
      mockProductTypeDao.expects('findOneOrFail').never();
      mockClauseConverter.expects('convertTo').never();
      const converted = await feeDao.convertTo(fee);
      expect(converted).to.deep.equal({
        customer_id: fee.customerId,
      });
      verify();
    });
  });

  describe('convertFrom', () => {
    it('should convert', async () => {
      const fee = ModelFactory.fee({
        customerId: 'customerId',
        siteId: '99341',
        productTypeId: 'movie',
        clauses: { pls: ['work', 'plspls'] },
      });
      const row = {
        ...toRow(fee),
        clauses: { pls: ['work', 'plspls'] },
      };
      const jsonSchema = ModelFactory.testSchema();
      const convertedClauses = fee.clauses;
      mockProductTypeDao
        .expects('findOneOrFail')
        .withArgs('movie')
        .resolves({ jsonSchema });
      mockClauseConverter
        .expects('convertFrom')
        .withArgs(row.clauses, jsonSchema)
        .returns(convertedClauses);
      const converted = await feeDao.convertFrom(row);
      expect(converted).to.deep.equal(fee);
      verify();
    });
    it('should not return null siteId or customerId', async () => {
      const fee = ModelFactory.fee({
        productTypeId: 'movie',
        clauses: { pls: ['work', 'plspls'] },
      });
      const row = {
        ...toRow(fee),
        clauses: { pls: ['work', 'plspls'] },
      };
      const jsonSchema = ModelFactory.testSchema();
      const convertedClauses = fee.clauses;
      mockProductTypeDao
        .expects('findOneOrFail')
        .withArgs('movie')
        .resolves({ jsonSchema });
      mockClauseConverter
        .expects('convertFrom')
        .withArgs(row.clauses, jsonSchema)
        .returns(convertedClauses);
      const converted = await feeDao.convertFrom(row);
      expect(converted).to.deep.equal(fee);
      verify();
    });
  });

  describe('aggregateClauses', () => {
    it('should aggregate clauses for fees', async () => {
      const productTypeId = 'movie';
      const expectedResult = [{ productTypeId, meta: { name: 'Frozen' } }];
      mockPg
        .expects('query')
        .withArgs(
          `SELECT product_type_id, clauses FROM fee WHERE fee_id = ANY($1)`,
          [[1, 2, 3]],
        )
        .resolves({ rows: [{ productTypeId, clauses: expectedResult }] });
      expect(await feeDao.aggregateClauses([1, 2, 3])).to.deep.equal(
        expectedResult,
      );
      verify();
    });
    it('should return productTypeId if no clauses', async () => {
      const productTypeId = 'movie';
      const expectedResult = [{ productTypeId }];
      mockPg
        .expects('query')
        .withArgs(
          `SELECT product_type_id, clauses FROM fee WHERE fee_id = ANY($1)`,
          [[1, 2, 3]],
        )
        .resolves({ rows: [{ productTypeId, clauses: {} }] });
      expect(await feeDao.aggregateClauses([1, 2, 3])).to.deep.equal(
        expectedResult,
      );
      verify();
    });
    it('should return empty array if no result is returned', async () => {
      mockPg
        .expects('query')
        .withArgs(
          `SELECT product_type_id, clauses FROM fee WHERE fee_id = ANY($1)`,
          [[1, 2, 3]],
        )
        .resolves({ rows: [] });
      expect(await feeDao.aggregateClauses([1, 2, 3])).to.deep.equal([]);
      verify();
    });
  });
});

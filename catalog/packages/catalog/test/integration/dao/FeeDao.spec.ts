import { _ } from '@securustablets/libraries.utils';
import { expect } from 'chai';
import { CatalogService } from '../../../src/CatalogService';
import { FeeDao } from '../../../src/data/PGCatalog/FeeDao';
import { ModelFactory } from '../../utils/ModelFactory';

describe('FeeDao - Integration', () => {
  let feeDao: FeeDao;

  before(() => {
    CatalogService.bindAll();
  });

  beforeEach(() => {
    feeDao = new FeeDao();
  });

  describe('aggregateClauses', async () => {
    it('aggregates fee clauses', async () => {
      const fees = [
        ModelFactory.fee(),
        ModelFactory.fee({ clauses: { 'meta.name': ['trent'] } }),
        ModelFactory.fee({
          clauses: { 'meta.name': ['fred', 'bob'] },
          productTypeId: 'tvShow',
        }),
      ];

      for (const fee of fees) {
        fee.feeId = await feeDao.create(fee, { apiKey: 'test' });
      }
      const clauses = await feeDao.aggregateClauses(
        _.map(fees, (fee) => fee.feeId),
      );

      expect(clauses).to.have.lengthOf(4);
      expect(clauses.sort()).to.deep.equal(
        [
          { productTypeId: fees[0].productTypeId },
          { productTypeId: fees[1].productTypeId, meta: { name: 'trent' } },
          { productTypeId: fees[2].productTypeId, meta: { name: 'fred' } },
          { productTypeId: fees[2].productTypeId, meta: { name: 'bob' } },
        ].sort(),
      );
    });
  });
});

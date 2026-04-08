import { Postgres } from '@securustablets/libraries.postgres';
import { expect } from 'chai';
import * as sinon from 'sinon';
import { ParentProductDao } from '../../../src/data/ParentProductDao';
import { MockUtils } from '../../utils/MockUtils';
import { ModelFactory } from '../../utils/ModelFactory';

describe('ParentProductDao - Unit', () => {
  let parentProductDao: ParentProductDao;
  let mockPg: sinon.SinonMock;

  beforeEach(() => {
    parentProductDao = new ParentProductDao();
    mockPg = MockUtils.inject(parentProductDao, '_pg', Postgres);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('noSql', () => {
    it('should return true for nosql', () => {
      expect((parentProductDao as any).noSql).to.equal(true);
    });
  });

  describe('model', () => {
    it('should return Product for the model', () => {
      expect((parentProductDao as any).model).to.equal('Product');
    });
  });

  describe('updateAvailableForSubscription', () => {
    it('calls the correct sql query', async () => {
      const product = ModelFactory.product({ productId: 123 });
      const expectedPgResult = ModelFactory.queryResult(
        {
          rows: [
            ModelFactory.auditHistory({
              document: {
                ...product,
                product_id: 123,
              },
            }),
          ],
        },
        1,
      );
      const regex = sinon.match((value) => {
        return (
          value.includes(
            `'{source,availableForSubscription}', 'true', true) WHERE product_id = 123`,
          ) && value.includes('$${"apiKey":"apiKey"}$$')
        );
      });
      mockPg
        .expects('write')
        .withExactArgs(regex, undefined)
        .resolves(expectedPgResult);
      await parentProductDao.updateAvailableForSubscription(123, true, {
        apiKey: 'apiKey',
      });
      mockPg.verify();
    });
  });
});

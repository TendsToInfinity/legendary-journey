import { Postgres } from '@securustablets/libraries.postgres';
import { assert, expect } from 'chai';
import * as sinon from 'sinon';
import { BlocklistTermDao } from '../../../src/data/PGCatalog/BlocklistTermDao';
import { MockUtils } from '../../utils/MockUtils';
import { ModelFactory } from '../../utils/ModelFactory';

describe('BlocklistTermDao - Unit', () => {
  const sandbox = sinon.createSandbox();
  let dao: BlocklistTermDao;
  let pgMock: sinon.SinonMock;

  beforeEach(() => {
    dao = new BlocklistTermDao();
    pgMock = MockUtils.inject(dao, '_pg', Postgres);
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('construct', () => {
    it('constructs', () => {
      assert.isObject(dao, 'It did not construct');
    });
  });

  describe('findByTerms', () => {
    it('should return a blocklist terms by term and productTypeGroupId', async () => {
      const termsArr = ['test', 'test2'];
      const productTypeGroupId = ModelFactory.fakeProductTypes;
      const terms = [
        ModelFactory.blocklistTerm({
          blocklistTermId: 1,
          term: 'test',
          productTypeGroupId,
        }),
        ModelFactory.blocklistTerm({
          blocklistTermId: 2,
          term: 'test2',
          productTypeGroupId,
        }),
      ];
      pgMock
        .expects('query')
        .withExactArgs(
          `SELECT * FROM blocklist_term WHERE lower(product_type_group_id) = lower($1::text) AND (term = ANY($2::text[]))`,
          [productTypeGroupId, [terms[0].term, terms[1].term]],
        )
        .resolves({ rows: terms });

      const actualResult = await dao.findByTerms(termsArr, productTypeGroupId);
      expect(actualResult).to.deep.equal(terms);
      pgMock.verify();
    });
  });

  describe('setTermsStatus', () => {
    it('should update blocklist term status', async () => {
      const termsArr = [1, 2];
      const enabled = true;
      const spyWrite = sandbox
        .stub(dao as any, 'write')
        .withArgs(sinon.match.string, [enabled, termsArr])
        .resolves({ rows: termsArr });

      const actualResult = await dao.setTermsStatus(termsArr, enabled);
      expect(spyWrite.calledOnce).to.be.equal(true);
      expect(actualResult).to.deep.equal(termsArr);
    });
  });

  describe('findByProductTypeGroupId', () => {
    it('should return blocklist terms by productTypeGroupId', async () => {
      const productTypeGroupId = ModelFactory.fakeProductTypes;
      const terms = [
        ModelFactory.blocklistTerm({
          blocklistTermId: 1,
          term: 'test',
          productTypeGroupId,
        }),
        ModelFactory.blocklistTerm({
          blocklistTermId: 2,
          term: 'test2',
          productTypeGroupId,
        }),
      ];
      pgMock
        .expects('query')
        .withExactArgs(
          `SELECT * FROM blocklist_term WHERE lower(product_type_group_id) = lower($1::text) AND enabled = $2`,
          [productTypeGroupId, true],
        )
        .resolves({ rows: terms });

      const actualResult =
        await dao.findActiveByProductTypeGroupId(productTypeGroupId);
      expect(actualResult).to.deep.equal(terms);
      pgMock.verify();
    });
  });
});

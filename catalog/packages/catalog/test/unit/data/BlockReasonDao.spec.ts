import { Postgres } from '@securustablets/libraries.postgres';
import { assert, expect } from 'chai';
import * as sinon from 'sinon';
import { BlockReasonDao } from '../../../src/data/PGCatalog/BlockReasonDao';
import { MockUtils } from '../../utils/MockUtils';
import { ModelFactory } from '../../utils/ModelFactory';

describe('BlockReasonDao - Unit', () => {
  const sandbox = sinon.createSandbox();
  let dao: BlockReasonDao;
  let pgMock: sinon.SinonMock;

  beforeEach(() => {
    dao = new BlockReasonDao();
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

  describe('findOneOrFail', () => {
    it('should return a blocklist reason', async () => {
      const reason = ModelFactory.blockReason({
        blockReasonId: 1,
        blockActionId: 1,
        termId: 1,
        term: 'test',
      });
      const options = { by: { blockReasonId: 1 } } as any;
      const findOneOrFail = sandbox
        .stub(dao as any, 'findOneOrFail')
        .resolves({ rows: [reason] });
      const result = await dao.findOneOrFail(options);
      assert(findOneOrFail.calledOnce);
      assert(findOneOrFail.calledOnceWithExactly(options));
      expect(result).to.deep.equal({ rows: [reason] });
    });

    it('should throw an error if no blocklist reason is found', async () => {
      const options = { by: { blockReasonId: 1 } } as any;
      const findOneOrFail = sandbox
        .stub(dao as any, 'findOneOrFail')
        .rejects(new Error('Not found'));
      try {
        await dao.findOneOrFail(options);
        assert.fail('should have thrown an error');
      } catch (e) {
        expect(e.message).to.equal(`Not found`);
        assert(findOneOrFail.calledOnce);
        assert(findOneOrFail.calledOnceWithExactly(options));
      }
    });
  });

  describe('findByQueryString', () => {
    it('should return a blocklist reason', async () => {
      const reason = ModelFactory.blockReason({
        blockReasonId: 1,
        blockActionId: 1,
        termId: 1,
        term: 'test',
      });
      const options = { by: { queryString: 'test' } } as any;
      const findByQueryString = sandbox
        .stub(dao as any, 'findByQueryString')
        .resolves({ rows: [reason] });
      const result = await dao.findByQueryString(options);
      assert(findByQueryString.calledOnce);
      assert(findByQueryString.calledOnceWithExactly(options));
      expect(result).to.deep.equal({ rows: [reason] });
    });

    it('should throw an error if no blocklist reason is found', async () => {
      const options = { by: { queryString: 'test' } } as any;
      const findByQueryString = sandbox
        .stub(dao as any, 'findByQueryString')
        .rejects(new Error('Not found'));
      try {
        await dao.findByQueryString(options);
        assert.fail('Not found');
      } catch (e) {
        expect(e.message).to.equal(`Not found`);
        assert(findByQueryString.calledOnce);
        assert(findByQueryString.calledOnceWithExactly(options));
      }
    });
  });
});

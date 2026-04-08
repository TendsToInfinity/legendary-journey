import { Postgres } from '@securustablets/libraries.postgres';
import { assert, expect } from 'chai';
import * as sinon from 'sinon';
import { BlockActionState } from '../../../src/controllers/models/BlockAction';
import { BlockActionDao } from '../../../src/data/PGCatalog/BlockActionDao';
import { MockUtils } from '../../utils/MockUtils';
import { ModelFactory } from '../../utils/ModelFactory';

describe('BlockActionDao - Unit', () => {
  const sandbox = sinon.createSandbox();
  let dao: BlockActionDao;
  let pgMock: sinon.SinonMock;

  beforeEach(() => {
    dao = new BlockActionDao();
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
    it('should return a block action', async () => {
      const term = ModelFactory.blockAction({
        blockActionId: 1,
        blocklistTermIds: [1, 2, 3],
        state: BlockActionState.Pending,
      });
      const options = { by: { blockActionId: 1 } } as any;
      const findOneOrFail = sandbox
        .stub(dao as any, 'findOneOrFail')
        .resolves({ rows: [term] });
      const result = await dao.findOneOrFail(options);
      assert(findOneOrFail.calledOnce);
      assert(findOneOrFail.calledOnceWithExactly(options));
      expect(result).to.deep.equal({ rows: [term] });
    });

    it('should throw an error if no block action is found', async () => {
      const options = { by: { blockActionId: 1 } } as any;
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
    it('should return a block action', async () => {
      const term = ModelFactory.blockAction({
        blockActionId: 1,
        blocklistTermIds: [1, 2, 3],
        state: BlockActionState.Pending,
      });
      const options = { by: { queryString: 'test' } } as any;
      const findByQueryString = sandbox
        .stub(dao as any, 'findByQueryString')
        .resolves({ rows: [term] });
      const result = await dao.findByQueryString(options);
      assert(findByQueryString.calledOnce);
      assert(findByQueryString.calledOnceWithExactly(options));
      expect(result).to.deep.equal({ rows: [term] });
    });

    it('should throw an error if no block action is found', async () => {
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

import { JwtType } from '@securustablets/libraries.httpsecurity';
import { SecurityFactory } from '@securustablets/libraries.utils-test';
import { expect } from 'chai';
import * as request from 'supertest';
import { BlockActionState } from '../../../src/controllers/models/BlockAction';
import { BlockActionDao } from '../../../src/data/PGCatalog/BlockActionDao';
import { BlocklistTermDao } from '../../../src/data/PGCatalog/BlocklistTermDao';
import { app } from '../../../src/main';
import { ModelFactory } from '../../utils/ModelFactory';
import { IntegrationTestSuite } from '../IntegrationTestSuite';

describe('BlockActionController - Integration', function () {
  IntegrationTestSuite.setUp(this);
  let testToken: string;
  let blocklistTermDao: BlocklistTermDao;
  let blockActionDao: BlockActionDao;

  before(async () => {
    testToken = await SecurityFactory.jwt(
      SecurityFactory.corpJwt({
        jwtType: JwtType.Corporate,
        username: 'testUser',
        permissions: ['catalogAdmin'],
      }),
    );
  });

  beforeEach(() => {
    blocklistTermDao = new BlocklistTermDao();
    blockActionDao = new BlockActionDao();
  });

  describe('Get Blocklist Actions', () => {
    it('should return a list of blocklist actions', async () => {
      let blocklistTerm = ModelFactory.blocklistTerm({
        term: 'testTerm',
      });
      blocklistTerm = await blocklistTermDao.createAndRetrieve(
        blocklistTerm,
        ModelFactory.auditContext(),
      );
      let blockAction = ModelFactory.blockAction({
        blocklistTermIds: [+blocklistTerm.blocklistTermId],
        state: BlockActionState.Pending,
      });
      blockAction = await blockActionDao.createAndRetrieve(
        blockAction,
        ModelFactory.auditContext(),
      );

      const res = await request(app)
        .get('/blockActions')
        .set('Authorization', `Bearer ${testToken}`);

      expect(res.status).to.equal(200);

      const actions = res.body.data;
      expect(actions.length).to.equal(1);
      expect(actions[0].blockActionId).to.equal(blockAction.blockActionId);
      expect(actions[0].blocklistTermIds).to.deep.equal([
        blocklistTerm.blocklistTermId,
      ]);
    });
  });

  describe('Get Blocklist Action by id', () => {
    it('should return a blocklist action', async () => {
      let blocklistTerm = ModelFactory.blocklistTerm({
        term: 'testTerm',
      });
      blocklistTerm = await blocklistTermDao.createAndRetrieve(
        blocklistTerm,
        ModelFactory.auditContext(),
      );
      let blockAction = ModelFactory.blockAction({
        blocklistTermIds: [+blocklistTerm.blocklistTermId],
        state: BlockActionState.Pending,
      });
      blockAction = await blockActionDao.createAndRetrieve(
        blockAction,
        ModelFactory.auditContext(),
      );

      const res = await request(app)
        .get(`/blockActions/${blockAction.blockActionId}`)
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      const action = res.body;
      expect(action.blockActionId).to.equal(blockAction.blockActionId);
      expect(action.blocklistTermIds).to.deep.equal([
        blocklistTerm.blocklistTermId,
      ]);
    });
  });
});

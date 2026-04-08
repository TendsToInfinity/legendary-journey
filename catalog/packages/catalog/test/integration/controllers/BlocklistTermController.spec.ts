import { JwtType } from '@securustablets/libraries.httpsecurity';
import { _ } from '@securustablets/libraries.utils';
import { SecurityFactory } from '@securustablets/libraries.utils-test';
import * as Bluebird from 'bluebird';
import { expect } from 'chai';
import * as sinon from 'sinon';
import * as request from 'supertest';
import { Container } from 'typescript-ioc';
import {
  BlockActionState,
  BlockActionType,
} from '../../../src/controllers/models/BlockAction';
import { BlockActionDao } from '../../../src/data/PGCatalog/BlockActionDao';
import { BlocklistTermDao } from '../../../src/data/PGCatalog/BlocklistTermDao';
import { app } from '../../../src/main';
import { AppConfig } from '../../../src/utils/AppConfig';
import { ModelFactory } from '../../utils/ModelFactory';
import { IntegrationTestSuite } from '../IntegrationTestSuite';
import '../global.spec';

describe('BlocklistTermController - Integration', function () {
  IntegrationTestSuite.setUp(this);
  let testToken: string;
  let blocklistTermDao: BlocklistTermDao;
  let blockActionDao: BlockActionDao;
  let appConfig: AppConfig;

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
    appConfig = Container.get(AppConfig);
  });

  afterEach(async () => {
    sinon.restore();
    await Bluebird.delay(1000);
  });

  describe('Get Blocklist Terms', () => {
    it('should return a list of blocklist terms', async () => {
      let blocklistTerm1 = await ModelFactory.blocklistTerm({
        term: 'testTerm1',
      });
      blocklistTerm1 = await blocklistTermDao.createAndRetrieve(
        blocklistTerm1,
        ModelFactory.auditContext(),
      );
      let blocklistTerm2 = await ModelFactory.blocklistTerm({
        term: 'testTerm2',
      });
      blocklistTerm2 = await blocklistTermDao.createAndRetrieve(
        blocklistTerm2,
        ModelFactory.auditContext(),
      );

      const response = await request(app)
        .get(`/blocklistTerms`)
        .set('Authorization', `Bearer ${testToken}`)
        .set('Accept', 'application/json')
        .expect(200);

      expect(response.body).not.to.be.undefined;
      const blocklistTerms = response.body.data.sort(
        (a, b) => a.blocklistTermId - b.blocklistTermId,
      );
      expect(blocklistTerms).not.to.be.undefined;
      expect(blocklistTerms.length).to.equal(2);
      expect(blocklistTerms[0].term).to.equal(blocklistTerm1.term);
      expect(blocklistTerms[0].blocklistTermId).to.equal(
        blocklistTerm1.blocklistTermId,
      );
      expect(blocklistTerms[1].term).to.equal(blocklistTerm2.term);
      expect(blocklistTerms[1].blocklistTermId).to.equal(
        blocklistTerm2.blocklistTermId,
      );
    });
  });

  describe('Get Blocklist Term', () => {
    it('should return a blocklist term', async () => {
      let blocklistTerm = await ModelFactory.blocklistTerm({
        term: 'testTerm',
      });
      blocklistTerm = await blocklistTermDao.createAndRetrieve(
        blocklistTerm,
        ModelFactory.auditContext(),
      );

      const response = await request(app)
        .get(`/blocklistTerms/${blocklistTerm.blocklistTermId}`)
        .set('Authorization', `Bearer ${testToken}`)
        .set('Accept', 'application/json')
        .expect(200);

      expect(response.body).not.to.be.undefined;
      expect(response.body.term).to.equal(blocklistTerm.term);
      expect(response.body.blocklistTermId).to.equal(
        blocklistTerm.blocklistTermId,
      );
    });
  });

  describe('Disable Blocklist Terms', () => {
    it('should disable a blocklist term', async () => {
      let blocklistTerm1 = await ModelFactory.blocklistTerm({
        term: 'testTerm1',
      });
      blocklistTerm1 = await blocklistTermDao.createAndRetrieve(
        blocklistTerm1,
        ModelFactory.auditContext(),
      );

      let blocklistTerm2 = await ModelFactory.blocklistTerm({
        term: 'testTerm2',
      });
      blocklistTerm2 = await blocklistTermDao.createAndRetrieve(
        blocklistTerm2,
        ModelFactory.auditContext(),
      );

      let blockAction = ModelFactory.blockAction({
        blocklistTermIds: [
          +blocklistTerm1.blocklistTermId,
          +blocklistTerm2.blocklistTermId,
        ],
        action: BlockActionType.Add,
        state: BlockActionState.Pending,
      });
      blockAction = await blockActionDao.createAndRetrieve(
        blockAction,
        ModelFactory.auditContext(),
      );

      await request(app)
        .post(`/blocklistTerms/disable`)
        .set('Authorization', `Bearer ${testToken}`)
        .set('Accept', 'application/json')
        .send({
          ids: [
            blocklistTerm1.blocklistTermId.toString(),
            blocklistTerm2.blocklistTermId.toString(),
          ],
        })
        .expect(200)
        .then((response) => {
          expect(_.omit(response.body[0], 'cdate', 'udate')).to.deep.equal({
            ..._.omit(blocklistTerm1, 'cdate', 'udate'),
            enabled: false,
          });
          expect(_.omit(response.body[1], 'cdate', 'udate')).to.deep.equal({
            ..._.omit(blocklistTerm2, 'cdate', 'udate'),
            enabled: false,
          });
        });

      const blocklistTerm1After = await blocklistTermDao.findOneOrFail(
        blocklistTerm1.blocklistTermId,
      );
      expect(blocklistTerm1After).not.to.be.undefined;
      expect(blocklistTerm1After.enabled).to.be.false;

      const blocklistTerm2After = await blocklistTermDao.findOneOrFail(
        blocklistTerm2.blocklistTermId,
      );
      expect(blocklistTerm2After).not.to.be.undefined;
      expect(blocklistTerm2After.enabled).to.be.false;

      const resultAfterUpdate = await blockActionDao.findByQueryString({
        orderBy: `blockActionId:asc`,
      });
      const blockActionsAfterUpdate = resultAfterUpdate.data.filter(
        (blckActn) =>
          _.isEqual(blckActn.blocklistTermIds, [
            blocklistTerm1.blocklistTermId,
            blocklistTerm2.blocklistTermId,
          ]),
      );
      expect(_.isArray(blockActionsAfterUpdate)).to.be.true;
      expect(blockActionsAfterUpdate.length).to.equal(2);
      expect(blockActionsAfterUpdate[0].action).to.equal(BlockActionType.Add);
      expect(blockActionsAfterUpdate[0].blocklistTermIds).to.deep.equal([
        blocklistTerm1.blocklistTermId,
        blocklistTerm2.blocklistTermId,
      ]);
      expect(blockActionsAfterUpdate[1].action).to.equal(
        BlockActionType.Remove,
      );
      expect(blockActionsAfterUpdate[1].blocklistTermIds).to.deep.equal([
        blocklistTerm1.blocklistTermId,
        blocklistTerm2.blocklistTermId,
      ]);
      sinon.verify();
    });
  });

  describe('Create Blocklist Terms', () => {
    it('should create a blocklist term', async () => {
      const productTypeGroupId = ModelFactory.fakeProductTypes;
      const response = await request(app)
        .post(`/blocklistTerms`)
        .set('Authorization', `Bearer ${testToken}`)
        .set('Accept', 'application/json')
        .send({
          terms: ['blocklistTerm1', 'blocklistTerm2'],
          productTypeGroupId,
        })
        .expect(200);

      const blocklistTerm1 = await blocklistTermDao.findOneOrFail({
        by: {
          term: 'blocklistTerm1',
          productTypeGroupId,
        },
      });

      const blocklistTerm2 = await blocklistTermDao.findOneOrFail({
        by: {
          term: 'blocklistTerm2',
          productTypeGroupId,
        },
      });

      const blockAction = await blockActionDao.findOneOrFail({
        by: {
          blocklistTermIds: [
            +blocklistTerm1.blocklistTermId,
            +blocklistTerm2.blocklistTermId,
          ],
        },
      });

      expect(blocklistTerm1).not.to.be.undefined;
      expect(blocklistTerm2).not.to.be.undefined;
      expect(blockAction).not.to.be.undefined;
      expect(response.body).not.to.be.undefined;
      expect(response.body.data.length).to.equal(2);
      expect(response.body.data[0].term).to.equal('blocklistTerm1');
      expect(response.body.data[1].term).to.equal('blocklistTerm2');
      expect(response.body.data[0].blocklistTermId).not.to.be.undefined;
      expect(response.body.data[1].blocklistTermId).not.to.be.undefined;
      sinon.verify();
    });
  });

  describe('Update Blocklist Terms', () => {
    it('should update a blocklist term', async () => {
      const productTypeGroupId = ModelFactory.fakeProductTypes;
      let blocklistTerm1 = await blocklistTermDao.createAndRetrieve(
        ModelFactory.blocklistTerm({
          term: 'testTerm1',
          enabled: false,
          productTypeGroupId,
        }),
        ModelFactory.auditContext(),
      );

      let blocklistTerm2 = await blocklistTermDao.createAndRetrieve(
        ModelFactory.blocklistTerm({
          term: 'testTerm2',
          enabled: false,
          productTypeGroupId,
        }),
        ModelFactory.auditContext(),
      );

      const { blockActionId } = await blockActionDao.createAndRetrieve(
        ModelFactory.blockAction({
          blocklistTermIds: [
            +blocklistTerm1.blocklistTermId,
            +blocklistTerm2.blocklistTermId,
          ],
          action: BlockActionType.Remove,
          state: BlockActionState.Pending,
        }),
        ModelFactory.auditContext(),
      );

      const response = await request(app)
        .post(`/blocklistTerms`)
        .set('Authorization', `Bearer ${testToken}`)
        .set('Accept', 'application/json')
        .send({
          terms: ['testTerm1', 'testTerm2Updated'],
          productTypeGroupId,
        })
        .expect(200);

      blocklistTerm1 = await blocklistTermDao.findOneOrFail(
        blocklistTerm1.blocklistTermId,
      );
      blocklistTerm2 = await blocklistTermDao.findOneOrFail(
        blocklistTerm2.blocklistTermId,
      );
      const blocklistTerm3 = await blocklistTermDao.findOneOrFail({
        by: {
          term: 'testTerm2Updated',
          productTypeGroupId,
        },
      });
      const blockAction = await blockActionDao.findOneOrFail(blockActionId);
      const blockAction2 = await blockActionDao.findOneOrFail({
        by: {
          blocklistTermIds: [
            +blocklistTerm1.blocklistTermId,
            +blocklistTerm3.blocklistTermId,
          ],
        },
      });

      expect(blocklistTerm1).not.to.be.undefined;
      expect(blocklistTerm1.enabled).to.be.true;
      expect(blocklistTerm2).not.to.be.undefined;
      expect(blocklistTerm2.enabled).to.be.false;
      expect(blocklistTerm3).not.to.be.undefined;
      expect(blocklistTerm3.enabled).to.be.true;
      expect(blockAction).not.to.be.undefined;
      expect(blockAction.action).to.equal(BlockActionType.Remove);
      expect(blockAction.blocklistTermIds).to.deep.equal([
        blocklistTerm1.blocklistTermId,
        blocklistTerm2.blocklistTermId,
      ]);
      expect(blockAction2).not.to.be.undefined;
      expect(blockAction2.action).to.equal(BlockActionType.Add);
      expect(blockAction2.blocklistTermIds).to.deep.equal([
        blocklistTerm1.blocklistTermId,
        blocklistTerm3.blocklistTermId,
      ]);
      expect(response.body).not.to.be.undefined;
      expect(response.body.data.length).to.equal(2);
      expect(response.body.data[0].term).to.equal('testTerm1');
      expect(response.body.data[1].term).to.equal('testTerm2Updated');
      sinon.verify();
    });
  });
});

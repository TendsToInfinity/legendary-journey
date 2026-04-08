import { CorpJwt, JwtType } from '@securustablets/libraries.httpsecurity';
import { _ } from '@securustablets/libraries.utils';
import { SecurityFactory } from '@securustablets/libraries.utils-test';
import * as Bluebird from 'bluebird';
import { expect } from 'chai';
import * as request from 'supertest';
import { LargeImpactEventState } from '../../../src/controllers/models/LargeImpactEvent';
import { app } from '../../../src/main';
import { ModelFactory } from '../../utils/ModelFactory';
import { IntegrationTestSuite } from '../IntegrationTestSuite';
import '../global.spec';

describe('LieController - Integration', function () {
  IntegrationTestSuite.setUp(this);
  let testToken: string;
  let expectedJwt: CorpJwt;

  const auditFields = ['largeImpactEventId', 'cdate', 'udate', 'version'];
  beforeEach(async () => {
    expectedJwt = {
      jwtType: JwtType.Corporate,
      username: 'testUser',
      permissions: ['catalogAdmin'],
    } as CorpJwt;

    testToken = await SecurityFactory.jwt(SecurityFactory.corpJwt(expectedJwt));
  });

  describe('create', () => {
    it('creates a lie', async () => {
      const model = ModelFactory.largeImpactEvent({
        payload: ModelFactory.blockAction(),
      });
      const { body: lie } = await request(app)
        .post(`/lies`)
        .set('Authorization', `Bearer ${testToken}`)
        .send(model)
        .expect(200);
      expect(_.omit(lie, auditFields)).to.deep.equal(
        _.omit(model, auditFields),
      );
    });
  });
  describe('findLie', () => {
    it('finds a lie', async () => {
      const model = ModelFactory.largeImpactEvent({
        payload: ModelFactory.blockAction(),
      });
      const { body: lie } = await request(app)
        .post(`/lies`)
        .set('Authorization', `Bearer ${testToken}`)
        .send(model)
        .expect(200);

      // let the LIE process
      await Bluebird.delay(500);

      const { body: foundLie } = await request(app)
        .get(`/lies/${lie.largeImpactEventId}`)
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      expect(_.omit(foundLie, auditFields, 'state')).to.deep.equal(
        _.omit(lie, auditFields, 'state'),
      );
      expect(foundLie.state).to.equal(LargeImpactEventState.Complete);
    });
    it('gets a 404', async () => {
      return request(app)
        .get(`/lies/1`)
        .set('Authorization', `Bearer ${testToken}`)
        .expect(404);
    });
  });
  describe('updateLie', () => {
    it('updates an lie', async () => {
      const model = ModelFactory.largeImpactEvent({
        payload: ModelFactory.blockAction(),
      });
      const { body: lie } = await request(app)
        .post(`/lies`)
        .set('Authorization', `Bearer ${testToken}`)
        .send(model)
        .expect(200);

      // let the LIE process
      await Bluebird.delay(500);

      const { body: foundLie } = await request(app)
        .put(`/lies/${lie.largeImpactEventId}`)
        .set('Authorization', `Bearer ${testToken}`)
        .send(
          _.omit({ ...lie, state: LargeImpactEventState.Pending }, 'version'),
        )
        .expect(200);

      expect(_.omit(foundLie, auditFields, 'state')).to.deep.equal(
        _.omit(lie, auditFields, 'state'),
      );
      expect(foundLie.state).to.equal(LargeImpactEventState.Pending);
    });
    it('gets a 404', async () => {
      await request(app)
        .put(`/lies/1`)
        .set('Authorization', `Bearer ${testToken}`)
        .send(ModelFactory.largeImpactEvent({ largeImpactEventId: 1 }))
        .expect(404);
    });
  });
});

import { CorpJwt, JwtType } from '@securustablets/libraries.httpsecurity';
import { _ } from '@securustablets/libraries.utils';
import { SecurityFactory } from '@securustablets/libraries.utils-test';
import { expect } from 'chai';
import * as request from 'supertest';
import { app } from '../../../src/main';
import { ModelFactory } from '../../utils/ModelFactory';

describe('FeeController - Integration', () => {
  let testToken: string;
  beforeEach(async () => {
    const expectedJwt = {
      jwtType: JwtType.Corporate,
      username: 'testUser',
      permissions: ['catalogAdmin'],
    } as CorpJwt;

    testToken = await SecurityFactory.jwt(SecurityFactory.corpJwt(expectedJwt));
  });

  describe('create', () => {
    it('creates a fee', async () => {
      await request(app)
        .post(`/fees`)
        .set('Authorization', `Bearer ${testToken}`)
        .send(ModelFactory.fee())
        .expect(200);
    });
    it('create a fee with clauses', async () => {
      await request(app)
        .post(`/fees`)
        .set('Authorization', `Bearer ${testToken}`)
        .send(
          ModelFactory.fee({
            clauses: {
              'meta.name': ['abubucker', 'abdullah'],
              'meta.year': ['1993', '2022'],
            },
            enabled: true,
          }),
        )
        .expect(200);
    });
  });
  describe('findFee', () => {
    it('finds a fee', async () => {
      const fee = ModelFactory.fee({ customerId: 'I-003320', siteId: '11111' });

      const {
        body: { feeId },
      } = await request(app)
        .post(`/fees`)
        .set('Authorization', `Bearer ${testToken}`)
        .send(fee)
        .expect(200);

      const { body: foundFee } = await request(app)
        .get(`/fees/${feeId}`)
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      expect(
        _.omit(foundFee, 'feeId', 'cdate', 'udate', 'version'),
      ).to.deep.equal(_.omit(fee, 'feeId'));
      expect(_.keys(foundFee)).to.have.members([
        'feeId',
        'customerId',
        'siteId',
        'productTypeId',
        'name',
        'amount',
        'percent',
        'version',
        'cdate',
        'udate',
        'clauses',
        'enabled',
      ]);
    });
    it('gets a 404', async () => {
      return request(app)
        .get(`/fees/1`)
        .set('Authorization', `Bearer ${testToken}`)
        .expect(404);
    });
  });
  describe('findFees', function () {
    this.timeout(10000);
    beforeEach(async () => {
      const fees = [
        ModelFactory.fee({ customerId: 'I-003320', siteId: '09340' }),
        ModelFactory.fee({ customerId: 'I-003320', siteId: '09338' }),
      ];

      for (const fee of fees) {
        await request(app)
          .post(`/fees`)
          .set('Authorization', `Bearer ${testToken}`)
          .send(fee)
          .expect(200);
      }
    });
    it('finds fees with no permissions', async () => {
      const expectedJwt = {
        jwtType: JwtType.Corporate,
        username: 'testy',
      } as CorpJwt;
      const corpJwt = await SecurityFactory.jwt(
        SecurityFactory.corpJwt(expectedJwt),
      );

      const { body: foundFees } = await request(app)
        .get(`/fees`)
        .set('Authorization', `Bearer ${corpJwt}`)
        .expect(200);

      expect(foundFees.data).to.have.lengthOf(2);
    });
    it('can find all fees', async () => {
      const { body: foundFees } = await request(app)
        .get(`/fees`)
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      expect(foundFees.data).to.have.lengthOf(2);
    });
    it('can find all fees with total', async () => {
      const { body: foundFees } = await request(app)
        .get(`/fees`)
        .set('Authorization', `Bearer ${testToken}`)
        .query({ total: true })
        .expect(200);

      expect(foundFees.total).to.equal(2);
      expect(foundFees.data).to.have.lengthOf(2);
    });
    it('can find fees by matching fields', async () => {
      const { body: foundFees } = await request(app)
        .get(`/fees`)
        .set('Authorization', `Bearer ${testToken}`)
        .query({ customerId: 'I-003320', siteId: '09340' })
        .expect(200);

      expect(foundFees.data).to.have.lengthOf(1);
    });
  });
  describe('updateFee', () => {
    it('updates a fee', async () => {
      const fee = ModelFactory.fee({ customerId: 'I-000000' });

      const {
        body: { feeId },
      } = await request(app)
        .post(`/fees`)
        .set('Authorization', `Bearer ${testToken}`)
        .send(fee)
        .expect(200);

      const changedFee = { ...fee, feeId, customerId: 'I-111111' };

      await request(app)
        .put(`/fees/${feeId}`)
        .set('Authorization', `Bearer ${testToken}`)
        .send(changedFee)
        .expect(204);

      const { body: foundFee } = await request(app)
        .get(`/fees/${feeId}`)
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      expect(foundFee.customerId).to.equal('I-111111');
    });
    it('gets a 404', async () => {
      await request(app)
        .put(`/fees/1`)
        .set('Authorization', `Bearer ${testToken}`)
        .send(ModelFactory.fee({ feeId: 1 }))
        .expect(404);
    });
  });
  describe('deleteFee', () => {
    it('deletes a fee', async () => {
      const {
        body: { feeId },
      } = await request(app)
        .post(`/fees`)
        .set('Authorization', `Bearer ${testToken}`)
        .send(ModelFactory.fee())
        .expect(200);

      await request(app)
        .delete(`/fees/${feeId}`)
        .set('Authorization', `Bearer ${testToken}`)
        .expect(204);

      await request(app)
        .get(`/fees/${feeId}`)
        .set('Authorization', `Bearer ${testToken}`)
        .expect(404);
    });
  });
});

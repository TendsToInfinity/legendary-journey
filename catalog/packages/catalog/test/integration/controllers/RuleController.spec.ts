import { CorpJwt, JwtType } from '@securustablets/libraries.httpsecurity';
import { _ } from '@securustablets/libraries.utils';
import { SecurityFactory } from '@securustablets/libraries.utils-test';
import { expect } from 'chai';
import * as request from 'supertest';
import { Container } from 'typescript-ioc';
import { RuleType } from '../../../src/controllers/models/Rule';
import { ProductDao } from '../../../src/data/PGCatalog/ProductDao';
import { app } from '../../../src/main';
import { ModelFactory } from '../../utils/ModelFactory';

const productDao = Container.get(ProductDao);

describe('RuleController - Integration', () => {
  let testToken: string;
  let noPermToken: string;
  beforeEach(async () => {
    const expectedJwt = {
      jwtType: JwtType.Corporate,
      username: 'testUser',
      permissions: ['catalogAdmin'],
    } as CorpJwt;

    testToken = await SecurityFactory.jwt(SecurityFactory.corpJwt(expectedJwt));

    const noPermJwt = {
      jwtType: JwtType.Corporate,
      username: 'testUser',
    } as CorpJwt;

    noPermToken = await SecurityFactory.jwt(SecurityFactory.corpJwt(noPermJwt));
  });

  describe('create', () => {
    it('creates a rule', async () => {
      await request(app)
        .post(`/rules`)
        .set('Authorization', `Bearer ${testToken}`)
        .send(ModelFactory.productAvailabilityRule())
        .expect(200);
    });
    it('creates a subscription availability rule', async () => {
      const product = ModelFactory.product();
      const productId = await productDao.create(product, {});
      await request(app)
        .post(`/rules`)
        .set('Authorization', `Bearer ${testToken}`)
        .send(
          ModelFactory.productSubscriptionAvailabilityRule({
            productTypeId: 'movieSubscription',
            productId,
          }),
        )
        .expect(200);
    });
    it(`stops rule creation for a duplicate '${RuleType.ProductTypeAvailability}' rule`, async () => {
      const rule = ModelFactory.productTypeAvailabilityRule();
      await request(app)
        .post(`/rules`)
        .set('Authorization', `Bearer ${testToken}`)
        .send(rule)
        .expect(200);
      const conflict = ModelFactory.rule(
        _.pick(rule, 'productTypeId', 'customerId', 'siteId', 'type', 'action'),
      );
      await request(app)
        .post(`/rules`)
        .set('Authorization', `Bearer ${testToken}`)
        .send(conflict)
        .expect(409);
    });
    it(`should not stop rule creation for a '${RuleType.ProductTypeAvailability}' rule when the context is different`, async () => {
      const rule = ModelFactory.productTypeAvailabilityRule({
        customerId: '1',
        siteId: '2',
      });
      await request(app)
        .post(`/rules`)
        .set('Authorization', `Bearer ${testToken}`)
        .send(rule)
        .expect(200);
      // Create the same rule, but without siteId. Should not be a duplicate.
      const conflict = ModelFactory.rule(
        _.pick(rule, 'productTypeId', 'customerId', 'type', 'action'),
      );
      await request(app)
        .post(`/rules`)
        .set('Authorization', `Bearer ${testToken}`)
        .send(conflict)
        .expect(200);
    });
    it('should stop rule creation if siteId is defined without customerId', async () => {
      await request(app)
        .post(`/rules`)
        .set('Authorization', `Bearer ${testToken}`)
        .send(
          ModelFactory.productAvailabilityRule({
            siteId: "Something isn't right",
          }),
        )
        .expect(400);
    });
  });
  describe('findRule', () => {
    it('finds a rule', async () => {
      const rule = ModelFactory.productAvailabilityRule({
        customerId: 'I-003320',
        siteId: '09340',
        clauses: {
          'meta.basePrice.rental': [2.99],
          'meta.name': ['Foo'],
          'meta.genres': ['Action', 'Drama'],
          'meta.rating': ['PG-13'],
          'meta.year': [2006],
        },
      });

      const {
        body: { ruleId },
      } = await request(app)
        .post(`/rules`)
        .set('Authorization', `Bearer ${testToken}`)
        .send(rule)
        .expect(200);

      const { body: foundRule } = await request(app)
        .get(`/rules/${ruleId}`)
        .set('Authorization', `Bearer ${noPermToken}`)
        .expect(200);

      expect(
        _.omit(foundRule, 'ruleId', 'cdate', 'udate', 'version'),
      ).to.deep.equal(rule);
      expect(_.keys(foundRule)).to.have.members([
        'ruleId',
        'customerId',
        'siteId',
        'productTypeId',
        'type',
        'name',
        'clauses',
        'action',
        'enabled',
        'cdate',
        'udate',
        'version',
      ]);
    });
    it('gets a 404', async () => {
      return request(app)
        .get(`/rules/1`)
        .set('Authorization', `Bearer ${noPermToken}`)
        .expect(404);
    });
  });
  describe('findRules', () => {
    beforeEach(async () => {
      const rules = [
        ModelFactory.productAvailabilityRule({
          customerId: 'I-003320',
          siteId: '09340',
        }),
        ModelFactory.productPriceRule({
          customerId: 'I-003320',
          siteId: '09338',
        }),
      ];

      for (const rule of rules) {
        await request(app)
          .post(`/rules`)
          .set('Authorization', `Bearer ${testToken}`)
          .send(rule)
          .expect(200);
      }
    });
    it('can find all rules', async () => {
      const { body: foundRules } = await request(app)
        .get(`/rules`)
        .set('Authorization', `Bearer ${noPermToken}`)
        .expect(200);

      expect(foundRules.data).to.have.lengthOf(2);
    });
    it('can find all rules with total', async () => {
      const { body: foundRules } = await request(app)
        .get(`/rules`)
        .set('Authorization', `Bearer ${noPermToken}`)
        .query({ total: true })
        .expect(200);

      expect(foundRules.total).to.equal(2);
      expect(foundRules.data).to.have.lengthOf(2);
    });
    it('can find rules by matching fields', async () => {
      const { body: foundRules } = await request(app)
        .get(`/rules`)
        .set('Authorization', `Bearer ${noPermToken}`)
        .query({ customerId: 'I-003320', siteId: '09340' })
        .expect(200);

      expect(foundRules.data).to.have.lengthOf(1);
    });
  });
  describe('updateRule', () => {
    it('updates a rule', async () => {
      const rule = ModelFactory.productAvailabilityRule({
        action: { available: true },
      });

      const {
        body: { ruleId },
      } = await request(app)
        .post(`/rules`)
        .set('Authorization', `Bearer ${testToken}`)
        .send(rule)
        .expect(200);

      const changedRule = { ...rule, ruleId, action: { available: false } };

      await request(app)
        .put(`/rules/${ruleId}`)
        .set('Authorization', `Bearer ${testToken}`)
        .send(changedRule)
        .expect(204);

      const { body: foundRule } = await request(app)
        .get(`/rules/${ruleId}`)
        .set('Authorization', `Bearer ${noPermToken}`)
        .expect(200);

      expect(foundRule.action).to.deep.equal({ available: false });
    });
    it('gets a 404', async () => {
      await request(app)
        .put(`/rules/1`)
        .set('Authorization', `Bearer ${testToken}`)
        .send(ModelFactory.productAvailabilityRule({ ruleId: 1 }))
        .expect(404);
    });
  });
  describe('deleteRule', () => {
    it('deletes a rule', async () => {
      const {
        body: { ruleId },
      } = await request(app)
        .post(`/rules`)
        .set('Authorization', `Bearer ${testToken}`)
        .send(ModelFactory.productAvailabilityRule())
        .expect(200);

      await request(app)
        .delete(`/rules/${ruleId}`)
        .set('Authorization', `Bearer ${testToken}`)
        .expect(204);

      await request(app)
        .get(`/rules/${ruleId}`)
        .set('Authorization', `Bearer ${noPermToken}`)
        .expect(404);
    });
  });
});

import { JwtType } from '@securustablets/libraries.httpsecurity';
import { _ } from '@securustablets/libraries.utils';
import { SecurityFactory } from '@securustablets/libraries.utils-test';
import * as Bluebird from 'bluebird';
import { expect } from 'chai';
import { Schema } from 'jsonschema';
import * as request from 'supertest';
import { Container } from 'typescript-ioc';
import * as util from 'util';
import {
  Product,
  ProductStatus,
} from '../../../src/controllers/models/Product';
import { Rule } from '../../../src/controllers/models/Rule';
import { ProductTypeDao } from '../../../src/data/PGCatalog/ProductTypeDao';
import { app } from '../../../src/main';
import { ModelFactory } from '../../utils/ModelFactory';
import { IntegrationTestSuite } from '../IntegrationTestSuite';
import '../global.spec';

describe('ProductRuleController - Integration', function () {
  IntegrationTestSuite.setUp(this);

  let corpJwt: string;
  let noPermJwt: string;
  const productTypeDao: ProductTypeDao = Container.get(ProductTypeDao);
  let movieSchema: Schema;

  before(async () => {
    corpJwt = await SecurityFactory.jwt(
      SecurityFactory.corpJwt({
        jwtType: JwtType.Corporate,
        username: 'testUser',
        permissions: ['catalogAdmin'],
      }),
    );

    noPermJwt = await SecurityFactory.jwt(
      SecurityFactory.corpJwt({
        jwtType: JwtType.Corporate,
        username: 'testUser',
      }),
    );

    movieSchema = (await productTypeDao.findOneOrFail('movie')).jsonSchema;
  });

  async function createProducts(products: Product[]): Promise<number[]> {
    return Bluebird.map(products, async (product) => {
      const {
        body: { productId },
      } = await request(app)
        .post(`/products`)
        .set('Authorization', `Bearer ${corpJwt}`)
        .send(product)
        .expect(200);
      return productId;
    });
  }

  async function createRules(rules: Rule[]): Promise<number[]> {
    return Bluebird.map(rules, async (rule) => {
      const {
        body: { ruleId },
      } = await request(app)
        .post('/rules')
        .set('Authorization', `Bearer ${corpJwt}`)
        .send(rule)
        .expect(200);
      return ruleId;
    });
  }

  describe('find', () => {
    let products: Product[];
    let productIds: number[];
    let rules: Rule[];
    let ruleIds: number[];

    beforeEach(async () => {
      products = [
        ModelFactory.productFromSchema(movieSchema, {
          status: ProductStatus.PendingReview,
          meta: { name: 'The Shining' },
        }),
        ModelFactory.productFromSchema(movieSchema, {
          status: ProductStatus.PendingReview,
          meta: { name: 'Frozen' },
        }),
      ];

      rules = [
        ModelFactory.movieAvailabilityRule({
          customerId: 'I-123456',
          action: { available: true },
          clauses: { 'meta.name': ['The Shining'] },
        }),
        ModelFactory.movieAvailabilityRule({
          customerId: 'I-123456',
          siteId: '11111',
          action: { available: true },
          clauses: { 'meta.name': ['The Shining'] },
        }),
        ModelFactory.movieAvailabilityRule({
          customerId: 'I-123456',
          siteId: '22222',
          action: { available: true },
          clauses: { 'meta.name': ['Frozen'] },
        }),
        // Global Rule
        ModelFactory.movieAvailabilityRule({
          action: { available: true },
          clauses: { 'meta.name': ['Frozen'] },
        }),
        ModelFactory.moviePriceRule({
          customerId: 'I-123456',
          action: { meta: { effectivePrice: { rental: 14 } } },
          clauses: { 'meta.name': ['Frozen'] },
        }),
        ModelFactory.moviePriceRule({
          customerId: 'I-123456',
          siteId: '22222',
          action: { meta: { effectivePrice: { rental: 10 } } },
          clauses: { 'meta.name': ['Frozen'] },
        }),
        ModelFactory.moviePriceRule({
          customerId: 'I-123456',
          siteId: '33333',
          action: { meta: { effectivePrice: { rental: 3 } } },
        }),
        ModelFactory.moviePriceRule({
          customerId: 'I-123456',
          action: { meta: { effectivePrice: { rental: 10000 } } },
          clauses: { 'meta.name': ['Frozen'] },
          enabled: false,
        }),
      ];
      [productIds, ruleIds] = await Promise.all([
        createProducts(products),
        createRules(rules),
      ]);
    });

    const scenarios: Array<{
      product: number;
      context: object;
      expectedRules: number[];
    }> = [
      { product: 0, context: {}, expectedRules: [] },
      { product: 0, context: { customerId: 'I-123456' }, expectedRules: [0] },
      {
        product: 0,
        context: { customerId: 'I-123456', siteId: '11111' },
        expectedRules: [0, 1],
      },
      {
        product: 0,
        context: { customerId: 'I-123456', siteId: '22222' },
        expectedRules: [0],
      },
      {
        product: 0,
        context: { customerId: 'I-123456', siteId: '44444' },
        expectedRules: [0],
      },
      { product: 1, context: {}, expectedRules: [3] },
      {
        product: 1,
        context: { customerId: 'I-123456' },
        expectedRules: [3, 4],
      },
      {
        product: 1,
        context: { customerId: 'I-123456', siteId: '11111' },
        expectedRules: [3, 4],
      },
      {
        product: 1,
        context: { customerId: 'I-123456', siteId: '22222' },
        expectedRules: [2, 3, 4, 5],
      },
      {
        product: 1,
        context: { customerId: 'I-123456', siteId: '33333' },
        expectedRules: [3, 4, 6],
      },
    ];

    for (const scenario of scenarios) {
      it(`should return ${scenario.expectedRules.length} rule(s) for ${util.inspect({ product: scenario.product, ...scenario.context }, { breakLength: Infinity })}`, async () => {
        const { body } = await request(app)
          .get(`/products/${productIds[scenario.product]}/rules`)
          .set('Authorization', `Bearer ${noPermJwt}`)
          .query(scenario.context)
          .expect(200);

        expect(_.map(body.data, 'ruleId')).to.have.members(
          scenario.expectedRules.map((expectedRule) => ruleIds[expectedRule]),
        );
      });
    }

    it(`should not return null for customerId`, async () => {
      const { body } = await request(app)
        .get(`/products/${productIds[1]}/rules`)
        .set('X-API-KEY', 'API_KEY_DEV')
        .expect(200);
      expect(body.data[0]).to.not.have.property('customerId');
      expect(body.data[0]).to.have.property('ruleId');
    });

    it(`should return rules with the correct total`, async () => {
      const { body } = await request(app)
        .get(
          `/products/${productIds[1]}/rules?customerId=I-123456&siteId=22222&total=true`,
        )
        .set('X-API-KEY', 'API_KEY_DEV')
        .expect(200);
      expect(body).to.have.property('total');
      expect(body.total).to.equal(4);
      expect(body.data.length).to.equal(4);
    });

    it(`should return rules without total`, async () => {
      const { body } = await request(app)
        .get(
          `/products/${productIds[1]}/rules?customerId=I-123456&siteId=22222`,
        )
        .set('X-API-KEY', 'API_KEY_DEV')
        .expect(200);
      expect(body).to.not.have.property('total');
      expect(body.total).to.equal(undefined);
      expect(body.data.length).to.equal(4);
    });
  });
});

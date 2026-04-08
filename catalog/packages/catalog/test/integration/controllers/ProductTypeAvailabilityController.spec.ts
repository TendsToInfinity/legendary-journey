import { JwtType } from '@securustablets/libraries.httpsecurity';
import { _ } from '@securustablets/libraries.utils';
import { SecurityFactory } from '@securustablets/libraries.utils-test';
import * as Bluebird from 'bluebird';
import { expect } from 'chai';
import { Schema } from 'jsonschema';
import * as request from 'supertest';
import { Container } from 'typescript-ioc';
import * as util from 'util';
import { ProductTypeAvailability } from '../../../src/controllers/models/ProductTypeAvailability';
import { Rule } from '../../../src/controllers/models/Rule';
import { ProductTypeDao } from '../../../src/data/PGCatalog/ProductTypeDao';
import { app } from '../../../src/main';
import { ModelFactory } from '../../utils/ModelFactory';
import { IntegrationTestSuite } from '../IntegrationTestSuite';

describe('ProductTypeAvailabilityController - Integration', function () {
  IntegrationTestSuite.setUp(this);

  let corpJwt: string;
  let noPermJwt: string;
  const productTypeDao: ProductTypeDao = Container.get(ProductTypeDao);
  let movieSchema: Schema;
  let tvShowSchema: Schema;

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
    tvShowSchema = (await productTypeDao.findOneOrFail('tvShow')).jsonSchema;
  });

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

  describe('findOne', () => {
    let rules: Rule[];
    let ruleIds: number[];

    beforeEach(async () => {
      rules = [
        ModelFactory.productTypeAvailabilityRule({
          productTypeId: 'movie',
          customerId: 'I-123456',
          action: { available: true },
        }),
        ModelFactory.productTypeAvailabilityRule({
          productTypeId: 'movie',
          customerId: 'I-123456',
          siteId: '11111',
          action: { available: true },
        }),
        ModelFactory.productTypeAvailabilityRule({
          productTypeId: 'movie',
          customerId: 'I-123456',
          siteId: '22222',
          action: { available: false },
        }),
        ModelFactory.productTypeAvailabilityRule({
          productTypeId: 'tvShow',
          customerId: 'I-867530',
          action: { available: false },
        }),
        ModelFactory.productTypeAvailabilityRule({
          productTypeId: 'tvShow',
          customerId: 'I-123456',
          siteId: '11111',
          action: { available: true },
        }),
      ];
      ruleIds = await createRules(rules);
    });

    const scenarios: Array<{
      productTypeId: string;
      context?: object;
      expectedAvailability: ProductTypeAvailability;
    }> = [
      {
        productTypeId: 'movie',
        expectedAvailability: {
          available: false,
          inherited: false,
        },
      },
      {
        productTypeId: 'movie',
        context: { customerId: 'I-123456' },
        expectedAvailability: {
          available: true,
          ruleId: 0,
          inherited: false,
          parent: {
            available: false,
          },
        },
      },
      {
        productTypeId: 'movie',
        context: { customerId: 'I-123456', siteId: '11111' },
        expectedAvailability: {
          available: true,
          inherited: false,
          ruleId: 1,
          parent: { available: true },
        },
      },
      {
        productTypeId: 'movie',
        context: { customerId: 'I-123456', siteId: '22222' },
        expectedAvailability: {
          available: false,
          inherited: false,
          ruleId: 2,
          parent: { available: true },
        },
      },
      {
        productTypeId: 'movie',
        context: { customerId: 'I-123456', siteId: '33333' },
        expectedAvailability: {
          available: true,
          inherited: true,
          parent: { available: true },
        },
      },
      {
        productTypeId: 'tvShow',
        expectedAvailability: {
          available: false,
          inherited: false,
        },
      },
      {
        productTypeId: 'tvShow',
        context: { customerId: 'I-123456' },
        expectedAvailability: {
          available: false,
          inherited: true,
          parent: { available: false },
        },
      },
      {
        productTypeId: 'tvShow',
        context: { customerId: 'I-867530' },
        expectedAvailability: {
          available: false,
          inherited: false,
          ruleId: 3,
          parent: { available: false },
        },
      },
      {
        productTypeId: 'tvShow',
        context: { customerId: 'I-123456', siteId: '11111' },
        expectedAvailability: {
          available: true,
          inherited: false,
          ruleId: 4,
          parent: { available: false },
        },
      },
      {
        productTypeId: 'tvShow',
        context: { customerId: 'I-123456', siteId: '22222' },
        expectedAvailability: {
          available: false,
          inherited: true,
          parent: { available: false },
        },
      },
    ];

    for (const scenario of scenarios) {
      it(`should return availability for ${util.inspect(_.pick(scenario, 'productTypeId', 'context'), { breakLength: Infinity })}`, async () => {
        const { body } = await request(app)
          .get(`/productTypes/${scenario.productTypeId}/availability`)
          .set('Authorization', `Bearer ${noPermJwt}`)
          .query(scenario.context)
          .expect(200);

        // Translate hardcoded ruleId into what it actually ends up being in postgres.
        const expectedAvailability = {
          ...scenario.expectedAvailability,
          ...(_.isNumber(scenario.expectedAvailability.ruleId) && {
            ruleId: ruleIds[scenario.expectedAvailability.ruleId],
          }),
        };

        expect(body).to.deep.equal(expectedAvailability);
      });
    }
  });
});

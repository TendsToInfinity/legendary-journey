import { JwtType } from '@securustablets/libraries.httpsecurity';
import { _ } from '@securustablets/libraries.utils';
import { SecurityFactory } from '@securustablets/libraries.utils-test';
import * as Bluebird from 'bluebird';
import { expect } from 'chai';
import { Schema } from 'jsonschema';
import * as moment from 'moment';
import * as request from 'supertest';
import { Container } from 'typescript-ioc';
import * as util from 'util';
import { AvailabilityCheckName } from '../../../src/controllers/models/AvailabilityCheck';
import {
  Product,
  ProductStatus,
} from '../../../src/controllers/models/Product';
import { Rule, RuleType } from '../../../src/controllers/models/Rule';
import { ProductDao } from '../../../src/data/PGCatalog/ProductDao';
import { ProductTypeDao } from '../../../src/data/PGCatalog/ProductTypeDao';
import { app } from '../../../src/main';
import { ModelFactory } from '../../utils/ModelFactory';
import { IntegrationTestSuite } from '../IntegrationTestSuite';

describe('ProductAvailibilityController - Integration', function () {
  IntegrationTestSuite.setUp(this);

  let corpJwt: string;
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

    movieSchema = (await productTypeDao.findOneOrFail('movie')).jsonSchema;
    tvShowSchema = (await productTypeDao.findOneOrFail('tvShow')).jsonSchema;
  });

  async function createProducts(products: Product[]): Promise<number[]> {
    // Use productDao to workaround need to set all the required fields for a product to be active... :/
    const productDao: ProductDao = Container.get(ProductDao);
    return Bluebird.map(products, async (product) =>
      productDao.create(product, { apiKey: 'test' }),
    );
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

  describe('findOne', () => {
    let products: Product[];
    let productIds: number[];
    let rules: Rule[];

    function toDateStr(mom: moment.Moment): string {
      return mom.format('YYYY-MM-DD');
    }

    beforeEach(async () => {
      products = [
        ModelFactory.productFromSchema(movieSchema, {
          status: ProductStatus.Active,
          meta: {
            name: 'The Shining',
            cast: [
              {
                name: 'Shelley Duvall',
                roles: ['Wendy Torrance', 'Scared Lady'],
              },
              { name: 'Jack Nicholson', roles: ['Jack Torrance'] },
            ],
          },
        }),
        ModelFactory.productFromSchema(movieSchema, {
          status: ProductStatus.Active,
          meta: {
            name: 'The Shining, with an active startDate',
            startDate: toDateStr(moment().utc().subtract(1, 'day')),
          },
        }),
        ModelFactory.productFromSchema(movieSchema, {
          status: ProductStatus.Active,
          meta: {
            name: 'The Shining, with an inactive startDate',
            startDate: toDateStr(moment().utc().add(1, 'day')),
          },
        }),
        ModelFactory.productFromSchema(movieSchema, {
          status: ProductStatus.Active,
          meta: {
            name: 'The Shining, with an active endDate',
            endDate: toDateStr(moment().utc().add(1, 'day')),
          },
        }),
        ModelFactory.productFromSchema(movieSchema, {
          status: ProductStatus.Active,
          meta: {
            name: 'The Shining, with an inactive endDate',
            endDate: toDateStr(moment().utc().subtract(1, 'day')),
          },
        }),
        ModelFactory.productFromSchema(movieSchema, {
          status: ProductStatus.Active,
          meta: {
            name: 'The Shining, with an active startDate and endDate',
            startDate: toDateStr(moment().utc().subtract(1, 'day')),
            endDate: toDateStr(moment().utc().add(1, 'day')),
          },
        }),
        ModelFactory.productFromSchema(movieSchema, {
          status: ProductStatus.Active,
          meta: {
            name: 'The Shining, with an inactive startDate/endDate (not yet available)',
            startDate: toDateStr(moment().utc().add(1, 'day')),
            endDate: toDateStr(moment().utc().add(10, 'days')),
          },
        }),
        ModelFactory.productFromSchema(movieSchema, {
          status: ProductStatus.Active,
          meta: {
            name: 'The Shining, with an inactive startDate/endDate (availability expired)',
            startDate: toDateStr(moment().utc().add(1, 'day')),
            endDate: toDateStr(moment().utc().add(10, 'days')),
          },
        }),
        ModelFactory.productFromSchema(tvShowSchema, {
          status: ProductStatus.PendingReview,
          meta: {
            name: 'Mindhunter',
            startDate: toDateStr(moment().utc().add(1, 'day')),
            endDate: toDateStr(moment().utc().add(1, 'year')),
          },
        }),
        ModelFactory.productFromSchema(movieSchema, {
          status: ProductStatus.Active,
          meta: {
            name: 'Joker',
            startDate: toDateStr(moment().utc().add(1, 'day')),
            endDate: toDateStr(moment().utc().subtract(1, 'day')),
          },
        }),
      ];
      rules = [
        ModelFactory.rule({
          type: RuleType.ProductAvailability,
          productTypeId: 'movie',
          customerId: 'I-123456',
          action: { available: false },
          clauses: { 'meta.name': ['The Shining'] },
        }),
        ModelFactory.rule({
          type: RuleType.ProductAvailability,
          productTypeId: 'movie',
          customerId: 'I-123456',
          siteId: '11111',
          action: { available: true },
          clauses: {
            'meta.cast.name': ['Shelley Duvall'],
            'meta.cast.roles': ['Scared Lady'],
          },
        }),
        ModelFactory.rule({
          type: RuleType.ProductAvailability,
          productTypeId: 'movie',
          customerId: 'I-123456',
          siteId: '11111',
          action: { available: true },
          clauses: { 'meta.name': ['Joker'] },
        }),
        ModelFactory.rule({
          type: RuleType.ProductAvailability,
          productTypeId: 'movie',
          customerId: 'I-123456',
          siteId: '55555',
          action: { available: false },
          clauses: {},
          enabled: false,
        }),
        // Throw in some disabled rules for good measure
        ModelFactory.rule({
          type: RuleType.ProductAvailability,
          productTypeId: 'movie',
          customerId: 'I-123456',
          siteId: '11111',
          action: { available: false },
          clauses: { 'meta.name': ['The Shining'] },
          enabled: false,
        }),
        ModelFactory.rule({
          type: RuleType.ProductAvailability,
          productTypeId: 'movie',
          customerId: 'I-123456',
          action: { available: false },
          clauses: { 'meta.name': ['The Shining'] },
          enabled: false,
        }),
      ];
      [productIds] = await Promise.all([
        createProducts(products),
        createRules(rules),
        IntegrationTestSuite.enableProductTypes(
          ['movie'],
          [{ customerId: 'I-123456' }],
        ),
      ]);
    });

    const scenarios: Array<{
      product: number;
      context: object;
      expectedAvailability: object;
    }> = [
      {
        product: 0,
        context: { customerId: 'I-123456', siteId: '11111' },
        expectedAvailability: {
          available: true,
          checks: [
            { name: AvailabilityCheckName.ActiveStatus, result: true },
            { name: AvailabilityCheckName.ActiveDateRange, result: true },
            {
              name: AvailabilityCheckName.ProductTypeAvailabilityRule,
              result: true,
            },
            {
              name: AvailabilityCheckName.ProductAvailabilityRule,
              result: true,
            },
          ],
        },
      },
      {
        product: 0,
        context: { customerId: 'I-123456' },
        expectedAvailability: {
          available: false,
          checks: [
            { name: AvailabilityCheckName.ActiveStatus, result: true },
            { name: AvailabilityCheckName.ActiveDateRange, result: true },
            {
              name: AvailabilityCheckName.ProductTypeAvailabilityRule,
              result: true,
            },
            {
              name: AvailabilityCheckName.ProductAvailabilityRule,
              result: false,
            },
          ],
        },
      },
      {
        product: 0,
        context: {},
        expectedAvailability: {
          available: false,
          checks: [
            { name: AvailabilityCheckName.ActiveStatus, result: true },
            { name: AvailabilityCheckName.ActiveDateRange, result: true },
            {
              name: AvailabilityCheckName.ProductTypeAvailabilityRule,
              result: false,
            },
            {
              name: AvailabilityCheckName.ProductAvailabilityRule,
              result: true,
            },
          ],
        },
      },
      {
        product: 0,
        context: { customerId: 'I-001122', siteId: '12345' },
        expectedAvailability: {
          available: false,
          checks: [
            { name: AvailabilityCheckName.ActiveStatus, result: true },
            { name: AvailabilityCheckName.ActiveDateRange, result: true },
            {
              name: AvailabilityCheckName.ProductTypeAvailabilityRule,
              result: false,
            },
            {
              name: AvailabilityCheckName.ProductAvailabilityRule,
              result: true,
            },
          ],
        },
      },
      {
        product: 1,
        context: { customerId: 'I-123456', siteId: '55555' },
        expectedAvailability: {
          available: true,
          checks: [
            { name: AvailabilityCheckName.ActiveStatus, result: true },
            { name: AvailabilityCheckName.ActiveDateRange, result: true },
            {
              name: AvailabilityCheckName.ProductTypeAvailabilityRule,
              result: true,
            },
            {
              name: AvailabilityCheckName.ProductAvailabilityRule,
              result: true,
            },
          ],
        },
      },
      {
        product: 2,
        context: { customerId: 'I-123456', siteId: '55555' },
        expectedAvailability: {
          available: false,
          checks: [
            { name: AvailabilityCheckName.ActiveStatus, result: true },
            { name: AvailabilityCheckName.ActiveDateRange, result: false },
            {
              name: AvailabilityCheckName.ProductTypeAvailabilityRule,
              result: true,
            },
            {
              name: AvailabilityCheckName.ProductAvailabilityRule,
              result: true,
            },
          ],
        },
      },
      {
        product: 3,
        context: { customerId: 'I-123456', siteId: '55555' },
        expectedAvailability: {
          available: true,
          checks: [
            { name: AvailabilityCheckName.ActiveStatus, result: true },
            { name: AvailabilityCheckName.ActiveDateRange, result: true },
            {
              name: AvailabilityCheckName.ProductTypeAvailabilityRule,
              result: true,
            },
            {
              name: AvailabilityCheckName.ProductAvailabilityRule,
              result: true,
            },
          ],
        },
      },
      {
        product: 4,
        context: { customerId: 'I-123456', siteId: '55555' },
        expectedAvailability: {
          available: false,
          checks: [
            { name: AvailabilityCheckName.ActiveStatus, result: true },
            { name: AvailabilityCheckName.ActiveDateRange, result: false },
            {
              name: AvailabilityCheckName.ProductTypeAvailabilityRule,
              result: true,
            },
            {
              name: AvailabilityCheckName.ProductAvailabilityRule,
              result: true,
            },
          ],
        },
      },
      {
        product: 5,
        context: { customerId: 'I-123456', siteId: '55555' },
        expectedAvailability: {
          available: true,
          checks: [
            { name: AvailabilityCheckName.ActiveStatus, result: true },
            { name: AvailabilityCheckName.ActiveDateRange, result: true },
            {
              name: AvailabilityCheckName.ProductTypeAvailabilityRule,
              result: true,
            },
            {
              name: AvailabilityCheckName.ProductAvailabilityRule,
              result: true,
            },
          ],
        },
      },
      {
        product: 6,
        context: { customerId: 'I-123456', siteId: '55555' },
        expectedAvailability: {
          available: false,
          checks: [
            { name: AvailabilityCheckName.ActiveStatus, result: true },
            { name: AvailabilityCheckName.ActiveDateRange, result: false },
            {
              name: AvailabilityCheckName.ProductTypeAvailabilityRule,
              result: true,
            },
            {
              name: AvailabilityCheckName.ProductAvailabilityRule,
              result: true,
            },
          ],
        },
      },
      {
        product: 7,
        context: { customerId: 'I-123456', siteId: '55555' },
        expectedAvailability: {
          available: false,
          checks: [
            { name: AvailabilityCheckName.ActiveStatus, result: true },
            { name: AvailabilityCheckName.ActiveDateRange, result: false },
            {
              name: AvailabilityCheckName.ProductTypeAvailabilityRule,
              result: true,
            },
            {
              name: AvailabilityCheckName.ProductAvailabilityRule,
              result: true,
            },
          ],
        },
      },
      {
        product: 8,
        context: { customerId: 'I-123456', siteId: '11111' },
        expectedAvailability: {
          available: false,
          checks: [
            { name: AvailabilityCheckName.ActiveStatus, result: false },
            { name: AvailabilityCheckName.ActiveDateRange, result: false },
            {
              name: AvailabilityCheckName.ProductTypeAvailabilityRule,
              result: false,
            },
            {
              name: AvailabilityCheckName.ProductAvailabilityRule,
              result: true,
            },
          ],
        },
      },
      {
        product: 9,
        context: { customerId: 'I-123456', siteId: '11111' },
        expectedAvailability: {
          available: false,
          checks: [
            { name: AvailabilityCheckName.ActiveStatus, result: true },
            { name: AvailabilityCheckName.ActiveDateRange, result: false },
            {
              name: AvailabilityCheckName.ProductTypeAvailabilityRule,
              result: true,
            },
            {
              name: AvailabilityCheckName.ProductAvailabilityRule,
              result: true,
            },
          ],
        },
      },
    ];

    for (const scenario of scenarios) {
      it(`should return availability for ${util.inspect({ product: scenario.product, ...scenario.context }, { breakLength: Infinity })}`, async () => {
        const { body } = await request(app)
          .get(`/products/${productIds[scenario.product]}/availability`)
          .set('Authorization', `Bearer ${corpJwt}`)
          .query(scenario.context)
          .expect(200);

        // Verification of check.details handled in unit tests.
        expect({
          ...body,
          checks: body.checks.map((check) => _.omit(check, 'detail')),
        }).to.deep.equal({
          productId: productIds[scenario.product],
          ...scenario.expectedAvailability,
        });
      });
    }
  });
});

import { JwtType } from '@securustablets/libraries.httpsecurity';
import { SpLite } from '@securustablets/libraries.json-schema/dist/src/models/SpLite';
import { SecurityFactory } from '@securustablets/libraries.utils-test';
import * as Bluebird from 'bluebird';
import { expect } from 'chai';
import * as sinon from 'sinon';
import * as request from 'supertest';
import { ProductStatus } from '../../../src/controllers/models/Product';
import { Rule } from '../../../src/controllers/models/Rule';
import { Search } from '../../../src/controllers/models/Search';
import { ProductDao } from '../../../src/data/PGCatalog/ProductDao';
import { ProductTypeDao } from '../../../src/data/PGCatalog/ProductTypeDao';
import { RuleDao } from '../../../src/data/PGCatalog/RuleDao';
import { OpenSearchManager } from '../../../src/lib/OpenSearchManager';
import { app } from '../../../src/main';
import { ModelFactory } from '../../utils/ModelFactory';
import { IntegrationTestSuite } from '../IntegrationTestSuite';
import '../global.spec';

describe('SearchController - Integration', function () {
  IntegrationTestSuite.setUp(this, { openSearch: true });
  let corpJwtToken: string;
  let inmateJwtToken: string;
  let productTypeDao: ProductTypeDao;
  let productDao: ProductDao;
  let ruleDao: RuleDao;
  let openSearchManager: OpenSearchManager;

  const customerId = 'I-1234';
  const siteId = '90210';
  const productTypeId = 'movie';

  let movieSchema: SpLite;

  beforeEach(async () => {
    corpJwtToken = await SecurityFactory.jwt(
      SecurityFactory.corpJwt({
        jwtType: JwtType.Corporate,
        username: 'testUser',
        permissions: ['catalogAdmin'],
      }),
    );
    inmateJwtToken = await SecurityFactory.jwt(
      SecurityFactory.inmateJwt({ customerId, siteId }),
    );

    productTypeDao = new ProductTypeDao();
    productDao = new ProductDao();
    ruleDao = new RuleDao();
    openSearchManager = new OpenSearchManager();

    movieSchema = (await productTypeDao.findOneOrFail('movie')).jsonSchema;
  });

  afterEach(async () => {
    sinon.restore();
    // wait for any messages to be published and acked
    await Bluebird.delay(1000);
  });

  describe('search - no rules enforce=false', () => {
    beforeEach(async () => {
      const products = [
        ModelFactory.productFromSchema(movieSchema, {
          status: ProductStatus.Active,
          meta: {
            name: 'Gone with the wind',
            description: 'i actually have never seen this',
            rating: 'PG',
            basePrice: { rental: 5.99 },
            cast: [{ name: 'cast name', roles: ['director', 'actor'] }],
          },
        }),
        ModelFactory.productFromSchema(movieSchema, {
          status: ProductStatus.Active,
          meta: {
            name: 'It',
            rating: 'R',
            basePrice: { rental: 5.99 },
            cast: [
              { name: 'cast name for name - It', roles: ['director'] },
              { name: 'cast name', roles: ['actor'] },
            ],
          },
        }),
        ModelFactory.productFromSchema(movieSchema, {
          status: ProductStatus.Active,
          meta: {
            name: 'Scary Movie',
            rating: 'PG-13',
            basePrice: { rental: 0.99 },
          },
        }),
        ModelFactory.productFromSchema(movieSchema, {
          status: ProductStatus.Active,
          meta: {
            name: 'Just Movie',
            rating: 'TV-14',
            basePrice: { rental: 0.99 },
          },
        }),
        ModelFactory.productFromSchema(movieSchema, {
          status: ProductStatus.Active,
          meta: {
            name: 'Scary Movie 2',
            rating: 'PG-13',
            basePrice: { rental: 1.99 },
          },
        }),
        ModelFactory.productFromSchema(movieSchema, {
          status: ProductStatus.Active,
          meta: { name: 'Frozen', rating: 'G', basePrice: { rental: 6.33 } },
        }),
        ModelFactory.productFromSchema(movieSchema, {
          status: ProductStatus.Active,
          meta: {
            name: 'The Shining',
            rating: 'R',
            basePrice: { rental: 7.77 },
          },
        }),
        ModelFactory.productFromSchema(movieSchema, {
          status: ProductStatus.Active,
          isBlocked: true,
          meta: { name: 'Blocked Movie' },
        }),
      ];
      await IntegrationTestSuite.loadProductsAndRules(
        products,
        [],
        [{ customerId }, { customerId, siteId }],
      );
    });
    it('should perform a search by term (name)', async () => {
      const search: Search = {
        context: { enforce: false },
      };
      const { body } = await request(app)
        .post(`/search/movie`)
        .set('Authorization', `Bearer ${corpJwtToken}`)
        .send(search)
        .expect(200);
      expect(body.data.length).to.equal(8);
    });
    it('should perform a search by match (partial product)', async () => {
      const search: Search = {
        context: { enforce: false },
        match: { meta: { cast: [{ name: 'cast name' }] } },
      };
      const { body } = await request(app)
        .post(`/search/movie`)
        .set('Authorization', `Bearer ${corpJwtToken}`)
        .send(search)
        .expect(200);
      expect(body.data.length).to.equal(2);
    });
    it('should perform a search by query', async () => {
      const search: Search = {
        context: { enforce: false },
        query: {
          productTypeId,
          clauses: {
            'meta.rating': ['R', 'G'],
          },
        },
      };
      const { body } = await request(app)
        .post(`/search/movie`)
        .set('Authorization', `Bearer ${corpJwtToken}`)
        .send(search)
        .expect(200);
      expect(body.data.length).to.equal(3);
    });
  });
  describe('search - no rules, enforce=true', () => {
    beforeEach(async () => {
      const startDate = '1970-01-01';
      const endDate = '9999-01-01';
      const products = [
        ModelFactory.productFromSchema(movieSchema, {
          status: ProductStatus.Active,
          meta: { name: 'the only available one', startDate, endDate },
          isBlocked: false,
        }),
        ModelFactory.productFromSchema(movieSchema, {
          status: ProductStatus.Reingest,
          meta: { name: 'bad status', startDate, endDate },
          isBlocked: false,
        }),
        ModelFactory.productFromSchema(movieSchema, {
          status: ProductStatus.Active,
          meta: { name: 'not available yet', startDate: '9999-01-01', endDate },
          isBlocked: false,
        }),
        ModelFactory.productFromSchema(movieSchema, {
          status: ProductStatus.Active,
          meta: {
            name: 'no longer available',
            startDate,
            endDate: '1970-01-01',
          },
          isBlocked: false,
        }),
        ModelFactory.productFromSchema(movieSchema, {
          status: ProductStatus.Active,
          meta: { name: 'is blocked', startDate, endDate },
          isBlocked: true,
        }),
      ];
      const rules = [
        ModelFactory.movieAvailabilityRule({
          clauses: { 'meta.name': ['bad status'] },
          customerId,
          siteId,
          action: { available: true },
        }),
      ];
      await IntegrationTestSuite.loadProductsAndRules(products, rules, [
        { customerId },
        { customerId, siteId },
      ]);
    });
    it('should enforce basic filtering - status, isBlocked, startDate, endDate', async () => {
      const search: Search = {
        context: { enforce: true },
      };
      // Clear caches for rules
      await request(app)
        .get(`/test/cache/clear`)
        .set('x-api-key', 'API_KEY_DEV')
        .expect(204);
      const { body } = await request(app)
        .post(`/search/movie`)
        .set('Authorization', `Bearer ${inmateJwtToken}`)
        .send(search)
        .expect(200);
      expect(body.data.length).to.equal(1);
    });
    it('should enforce basic filtering - status, isBlocked, startDate, endDate if whitelisted and globally available', async () => {
      const search: Search = {
        match: { productTypeId: 'movie' },
        context: { enforce: true },
      };
      // Clear caches for rules
      await request(app)
        .get(`/test/cache/clear`)
        .set('x-api-key', 'API_KEY_DEV')
        .expect(204);
      const { body } = await request(app)
        .post(`/search/movie`)
        .set('Authorization', `Bearer ${inmateJwtToken}`)
        .send(search)
        .expect(200);
      expect(body.data.length).to.equal(1);
    });
  });
  describe('search - product_availability', () => {
    const products = [
      ModelFactory.productFromSchema(movieSchema, {
        status: ProductStatus.Active,
        productTypeId,
        meta: { name: 'Dune' },
        isBlocked: false,
      }),
    ];
    it('should enforce whitelist wins across context', async () => {
      const rules = [
        ModelFactory.movieAvailabilityRule({
          clauses: { 'meta.name': ['Dune'] },
          customerId,
          siteId,
          action: { available: false },
        }),
        ModelFactory.movieAvailabilityRule({
          clauses: { 'meta.name': ['Dune'] },
          customerId,
          action: { available: true },
        }),
      ];
      await IntegrationTestSuite.loadProductsAndRules(products, rules, [
        { customerId },
      ]);
      // Clear caches for rules
      await request(app)
        .get(`/test/cache/clear`)
        .set('x-api-key', 'API_KEY_DEV')
        .expect(204);
      const { body } = await request(app)
        .post(`/search/movie`)
        .set('Authorization', `Bearer ${inmateJwtToken}`)
        .send({})
        .expect(200);
      expect(body.data.length).to.equal(1);
    });
    it('should enforce blacklist wins if no whitelist across context', async () => {
      const rules = [
        ModelFactory.movieAvailabilityRule({
          clauses: { 'meta.name': ['Dune'] },
          customerId,
          action: { available: false },
        }),
      ];
      await IntegrationTestSuite.loadProductsAndRules(products, rules);
      // Clear caches for rules
      await request(app)
        .get(`/test/cache/clear`)
        .set('x-api-key', 'API_KEY_DEV')
        .expect(204);
      const { body } = await request(app)
        .post(`/search/movie`)
        .set('Authorization', `Bearer ${inmateJwtToken}`)
        .send({})
        .expect(200);
      expect(body.data.length).to.equal(0);
    });
    it('should return unavailable products if enforce=false', async () => {
      const rules = [
        ModelFactory.movieAvailabilityRule({
          clauses: { 'meta.name': ['Dune'] },
          customerId,
          action: { available: false },
        }),
      ];
      await IntegrationTestSuite.loadProductsAndRules(products, rules);
      // Clear caches for rules
      await request(app)
        .get(`/test/cache/clear`)
        .set('x-api-key', 'API_KEY_DEV')
        .expect(204);
      const { body } = await request(app)
        .post(`/search/movie`)
        .set('Authorization', `Bearer ${corpJwtToken}`)
        .send({ context: { enforce: false } })
        .expect(200);
      expect(body.data.length).to.equal(1);
    });
  });
  describe('search - subscription_product', () => {
    let subscriptionProductId = 777;
    beforeEach(async () => {
      const products = [
        ModelFactory.productFromSchema(movieSchema, {
          status: ProductStatus.Active,
          productTypeId,
          meta: { name: 'Dune' },
          isBlocked: false,
        }),
        ModelFactory.productFromSchema(movieSchema, {
          status: ProductStatus.Active,
          productTypeId,
          meta: { name: 'the other one' },
          isBlocked: false,
        }),
        ModelFactory.productFromSchema(movieSchema, {
          status: ProductStatus.Active,
          productTypeId: 'movieSubscription',
          source: { vendorProductId: subscriptionProductId.toString() },
          meta: { name: 'Netflix' },
          isBlocked: false,
        }),
      ];
      const rules: Rule[] = [
        // rule to add all movies to the subscription
        ModelFactory.productSubscriptionAvailabilityRule({
          productId: subscriptionProductId,
          productTypeId,
          clauses: {},
          action: { available: true },
          enabled: true,
        }),
        // restrict Dune from the customer/site
        ModelFactory.productAvailabilityRule({
          productTypeId,
          customerId,
          siteId,
          clauses: { 'meta.name': ['Dune'] },
          action: { available: false },
          enabled: true,
        }),
      ];
      await IntegrationTestSuite.loadProductsAndRules(products, rules, [
        { customerId },
      ]);
      subscriptionProductId = (
        await productDao.find({
          contains: { document: { productTypeId: 'movieSubscription' } },
        })
      )[0].productId;
    });
    it('should return all the movies in the subscription', async () => {
      const search: Search = {
        context: {
          productId: `${subscriptionProductId}`,
          customerId,
        },
      };
      // Clear caches for rules
      await request(app)
        .get(`/test/cache/clear`)
        .set('x-api-key', 'API_KEY_DEV')
        .expect(204);
      const { body } = await request(app)
        .post(`/search/movie`)
        .set('Authorization', `Bearer ${corpJwtToken}`)
        .send(search)
        .expect(200);
      expect(body.data.length).to.equal(2);
    });
    it('should combine a term search with a subscription_product_ids filter', async () => {
      const search: Search = {
        term: 'dune',
        context: {
          productId: `${subscriptionProductId}`,
          customerId,
        },
      };
      // Clear caches for rules
      await request(app)
        .get(`/test/cache/clear`)
        .set('x-api-key', 'API_KEY_DEV')
        .expect(204);
      const { body } = await request(app)
        .post(`/search/movie`)
        .set('Authorization', `Bearer ${corpJwtToken}`)
        .send(search)
        .expect(200);
      expect(body.data.length).to.equal(1);
      expect(body.data[0].meta.name).to.equal('Dune');
    });
    it('should enforce product_availability rules on top of subscriptionProduct', async () => {
      const search: Search = {
        context: {
          productId: `${subscriptionProductId}`,
        },
      };
      // Clear caches for rules
      await request(app)
        .get(`/test/cache/clear`)
        .set('x-api-key', 'API_KEY_DEV')
        .expect(204);
      const { body } = await request(app)
        .post(`/search/movie`)
        .set('Authorization', `Bearer ${inmateJwtToken}`)
        .send(search)
        .expect(200);
      expect(body.data.length).to.equal(1);
      expect(body.data[0].meta.name).to.equal('the other one');
    });
  });
});

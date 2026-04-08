import { _ } from '@securustablets/libraries.utils';
import * as Bluebird from 'bluebird';
import { expect } from 'chai';
import { CatalogService } from '../../../src/CatalogService';
import { RuleType } from '../../../src/controllers/models/Rule';
import { ProductDao } from '../../../src/data/PGCatalog/ProductDao';
import { ProductTypeDao } from '../../../src/data/PGCatalog/ProductTypeDao';
import { RuleDao } from '../../../src/data/PGCatalog/RuleDao';
import { ModelFactory } from '../../utils/ModelFactory';

describe('RuleDao - Integration', () => {
  let ruleDao: RuleDao;
  let productDao: ProductDao;
  let productTypeDao: ProductTypeDao;

  before(() => {
    CatalogService.bindAll();
  });

  beforeEach(() => {
    ruleDao = new RuleDao();
    productDao = new ProductDao();
    productTypeDao = new ProductTypeDao();
  });

  describe('findAll', async () => {
    it('finds all rules', async () => {
      const srcRules = [
        ModelFactory.rule({ customerId: 'I-003320', siteId: '09340' }),
        ModelFactory.rule({ customerId: 'I-003320', siteId: '09340' }),
      ];

      for (const rule of srcRules) {
        await ruleDao.create(rule, { apiKey: 'test' });
      }
      const rules = await ruleDao.find({});
      expect(rules).to.have.lengthOf(2);
    });
  });
  describe('findSetByContext', async () => {
    it('finds rules by a context', async () => {
      const context = { customerId: 'I-003320', siteId: '09340' };
      const srcRules = [
        ModelFactory.rule(context),
        ModelFactory.rule(context),
        ModelFactory.rule({
          customerId: context.customerId,
          productTypeId: 'tvShow',
        }),
      ];

      for (const rule of srcRules) {
        await ruleDao.create(rule, { apiKey: 'test' });
      }
      const rules = await ruleDao.findSetByContext(
        context,
        RuleType.ProductAvailability,
      );

      expect(rules).to.have.lengthOf(3);
    });
  });
  describe('findSetByContext', async () => {
    it('finds global rules', async () => {
      const context = { customerId: 'I-003320', siteId: '09340' };
      const srcRules = [
        ModelFactory.rule(context),
        ModelFactory.rule(context),
        ModelFactory.rule({ productTypeId: 'tvShow' }),
      ];

      for (const rule of srcRules) {
        await ruleDao.create(rule, { apiKey: 'test' });
      }
      const rules = await ruleDao.findSetByContext(
        context,
        RuleType.ProductAvailability,
      );

      expect(rules).to.have.lengthOf(3);
    });
    it('finds global rules no context', async () => {
      const context = { customerId: 'I-003320', siteId: '09340' };
      const srcRules = [
        ModelFactory.rule(context),
        ModelFactory.rule({ productTypeId: 'tvShow' }),
      ];

      for (const rule of srcRules) {
        await ruleDao.create(rule, { apiKey: 'test' });
      }
      const rules = await ruleDao.findSetByContext(
        undefined,
        RuleType.ProductAvailability,
      );

      expect(rules).to.have.lengthOf(1);
    });
  });
  describe('aggregateClauses', async () => {
    it('aggregates rule clauses', async () => {
      const rules = [
        ModelFactory.rule(),
        ModelFactory.rule({ clauses: { 'meta.name': ['trent'] } }),
        ModelFactory.rule({
          clauses: { 'meta.name': ['fred', 'bob'] },
          productTypeId: 'tvShow',
        }),
      ];

      for (const rule of rules) {
        rule.ruleId = await ruleDao.create(rule, { apiKey: 'test' });
      }
      const clauses = await ruleDao.aggregateClauses(
        _.map(rules, (rule) => rule.ruleId),
      );

      expect(clauses).to.have.lengthOf(4);
      expect(clauses.sort()).to.deep.equal(
        [
          { productTypeId: rules[0].productTypeId },
          { productTypeId: rules[1].productTypeId, meta: { name: 'trent' } },
          { productTypeId: rules[2].productTypeId, meta: { name: 'fred' } },
          { productTypeId: rules[2].productTypeId, meta: { name: 'bob' } },
        ].sort(),
      );
    });
  });

  describe('findSubscriptionRulesByProductType', async () => {
    it('find subscription rule with the given product type', async () => {
      const gameSubscriptionType =
        await productTypeDao.findOneOrFail('gameSubscription');
      const fakedGameSubscription1 = ModelFactory.productFromSchema(
        gameSubscriptionType.jsonSchema,
      );
      const fakedGameSubscription2 = ModelFactory.productFromSchema(
        gameSubscriptionType.jsonSchema,
      );

      const gameSubscriptionIds = await Bluebird.map(
        [fakedGameSubscription1, fakedGameSubscription2],
        async (prodData) => {
          return await productDao.create(prodData, { apiKey: 'test' });
        },
        { concurrency: 2 },
      );

      const movieSubscriptionType =
        await productTypeDao.findOneOrFail('movieSubscription');
      const fakedMovieSubscription = ModelFactory.productFromSchema(
        movieSubscriptionType.jsonSchema,
      );

      const movieSubscriptionId = await productDao.create(
        fakedMovieSubscription,
        { apiKey: 'test' },
      );

      const rules = [
        ModelFactory.rule({
          productId: gameSubscriptionIds[0],
          clauses: { 'meta.name': ['josh'] },
          productTypeId: 'game',
        }),
        ModelFactory.rule({
          productId: gameSubscriptionIds[1],
          clauses: { 'meta.name': ['trent'] },
          productTypeId: 'game',
        }),
        ModelFactory.rule({
          productId: movieSubscriptionId,
          clauses: { 'meta.name': ['fred', 'bob'] },
          productTypeId: 'movie',
        }),
        ModelFactory.rule(),
      ];

      const expectedResult = [];

      for (const rule of rules) {
        rule.ruleId = await ruleDao.create(rule, { apiKey: 'test' });
        if (rule.productTypeId === 'game') {
          expectedResult.push(rule);
        }
      }

      const actualResult = await ruleDao.find({
        by: {
          productTypeId: 'game',
        },
        customClauses: [{ clause: `product_id IS NOT NULL`, params: [] }],
        pageSize: Number.MAX_SAFE_INTEGER,
      });

      expect(expectedResult).to.have.lengthOf(2);
      expect(actualResult).to.have.lengthOf(2);
      expect(actualResult.map((el) => el.productId)).to.eql(
        expectedResult.map((el) => el.productId),
      );
    });

    it('should return empty result', async () => {
      const gameSubscriptionType =
        await productTypeDao.findOneOrFail('gameSubscription');
      const fakedGameSubscription1 = ModelFactory.productFromSchema(
        gameSubscriptionType.jsonSchema,
      );
      const fakedGameSubscription2 = ModelFactory.productFromSchema(
        gameSubscriptionType.jsonSchema,
      );

      const gameSubscriptionIds = await Bluebird.map(
        [fakedGameSubscription1, fakedGameSubscription2],
        async (prodData) => {
          return await productDao.create(prodData, { apiKey: 'test' });
        },
        { concurrency: 2 },
      );

      const movieSubscriptionType =
        await productTypeDao.findOneOrFail('movieSubscription');
      const fakedMovieSubscription = ModelFactory.productFromSchema(
        movieSubscriptionType.jsonSchema,
      );

      const movieSubscriptionId = await productDao.create(
        fakedMovieSubscription,
        { apiKey: 'test' },
      );

      const rules = [
        ModelFactory.rule({
          productId: gameSubscriptionIds[0],
          clauses: { 'meta.name': ['josh'] },
          productTypeId: 'game',
        }),
        ModelFactory.rule({
          productId: gameSubscriptionIds[1],
          clauses: { 'meta.name': ['trent'] },
          productTypeId: 'game',
        }),
        ModelFactory.rule({
          productId: movieSubscriptionId,
          clauses: { 'meta.name': ['fred', 'bob'] },
          productTypeId: 'movie',
        }),
        ModelFactory.rule(),
      ];

      const expectedResult = [];

      for (const rule of rules) {
        rule.ruleId = await ruleDao.create(rule, { apiKey: 'test' });
        if (rule.productTypeId === 'tvShow') {
          expectedResult.push(rule);
        }
      }

      const actualResult = await ruleDao.find({
        by: {
          productTypeId: 'tvShow',
        },
        customClauses: [{ clause: `product_id IS NOT NULL`, params: [] }],
        pageSize: Number.MAX_SAFE_INTEGER,
      });

      expect(expectedResult).to.have.lengthOf(0);
      expect(actualResult).to.have.lengthOf(0);
      expect(actualResult.map((el) => el.productId)).to.eql(
        expectedResult.map((el) => el.productId),
      );
    });
  });
});

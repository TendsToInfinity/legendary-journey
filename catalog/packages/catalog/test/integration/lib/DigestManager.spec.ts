import { DeepPartial, _ } from '@securustablets/libraries.utils';
import * as Bluebird from 'bluebird';
import { expect } from 'chai';
import { Product, ProductStatus } from '../../../db/reference/Product';
import { RuleType } from '../../../src/controllers/models/Rule';
import { ProductDao } from '../../../src/data/PGCatalog/ProductDao';
import { DigestHelper } from '../../../src/lib/DigestHelper';
import { DigestManager } from '../../../src/lib/DigestManager';
import { RuleManager } from '../../../src/lib/RuleManager';
import { ModelFactory } from '../../utils/ModelFactory';
import { IntegrationTestSuite } from '../IntegrationTestSuite';
import '../global.spec';

describe('DigestManager - Integration', function () {
  IntegrationTestSuite.setUp(this);
  let digestManager: DigestManager;
  let productDao: ProductDao;
  let ruleManager: RuleManager;

  beforeEach(() => {
    digestManager = new DigestManager();
    productDao = new ProductDao();
    ruleManager = new RuleManager();
  });

  describe('getDigestRulesByProductTypeId', () => {
    it('should return only rules that match the productTypeId and are for productAvailability or prodSubAvail', async () => {
      const productId = await productDao.create(ModelFactory.product(), {
        apiKey: 'apiKey',
      });
      const rules = [
        ModelFactory.productAvailabilityRule({
          productTypeId: 'track',
          type: RuleType.ProductAvailability,
        }),
        ModelFactory.productSubscriptionAvailabilityRule({
          productTypeId: 'track',
          type: RuleType.ProductSubscriptionAvailability,
          productId,
        }),
        ModelFactory.productTypeAvailabilityRule({
          productTypeId: 'track',
          type: RuleType.ProductTypeAvailability,
        }),
        ModelFactory.productPriceRule({
          productTypeId: 'track',
          type: RuleType.ProductPrice,
        }),
        ModelFactory.productAvailabilityRule({
          productTypeId: 'album',
          type: RuleType.ProductAvailability,
        }),
        ModelFactory.productSubscriptionAvailabilityRule({
          productTypeId: 'album',
          type: RuleType.ProductSubscriptionAvailability,
          productId,
        }),
        ModelFactory.productTypeAvailabilityRule({
          productTypeId: 'album',
          type: RuleType.ProductTypeAvailability,
        }),
        ModelFactory.productPriceRule({
          productTypeId: 'album',
          type: RuleType.ProductPrice,
        }),
      ];
      await Promise.all(
        _.map(rules, (r) => ruleManager.createRule(r, { apiKey: 'apiKey' })),
      );
      const digestibleRules =
        await digestManager.getDigestRulesByProductTypeId('track');
      expect(digestibleRules.length).to.equal(2);
    });
  });
  describe('digestProductsForContext', () => {
    it('should digest multiple products', async () => {
      const productTypeId = 'track';
      const products = [
        ModelFactory.product({ meta: { name: 'elvis' }, productTypeId }),
        ModelFactory.product({ meta: { name: 'presley' }, productTypeId }),
      ];
      const ruleIds = [
        await ruleManager.createRule(
          ModelFactory.productAvailabilityRule({
            clauses: { 'meta.name': ['elvis'] },
            action: { available: false },
            productTypeId,
          }),
          { apiKey: 'apiKey' },
        ),
        await ruleManager.createRule(
          ModelFactory.productAvailabilityRule({
            clauses: { 'meta.name': ['presley'] },
            action: { available: true },
            productTypeId,
          }),
          { apiKey: 'apiKey' },
        ),
      ];
      const digests = await digestManager.digestProductsForContext(
        products,
        {},
      );
      const expectedDigests = [
        ModelFactory.digest({
          productId: products[0].productId,
          ruleIds: [ruleIds[0]],
          availableGlobally: false,
          blacklist: [DigestHelper.GLOBAL_CONTEXT],
        }),
        ModelFactory.digest({
          productId: products[1].productId,
          ruleIds: [ruleIds[1]],
          availableGlobally: true,
          whitelist: [DigestHelper.GLOBAL_CONTEXT],
        }),
      ];
      expect(digests).to.deep.equal(expectedDigests);
    });
  });
  describe('digestProducts', () => {
    it('should digest multiple products', async () => {
      const productTypeId = 'track';
      const products = [
        ModelFactory.product({ meta: { name: 'elvis' }, productTypeId }),
        ModelFactory.product({ meta: { name: 'presley' }, productTypeId }),
      ];
      const ruleIds = [
        await ruleManager.createRule(
          ModelFactory.productAvailabilityRule({
            clauses: { 'meta.name': ['elvis'] },
            action: { available: false },
            productTypeId,
          }),
          { apiKey: 'apiKey' },
        ),
        await ruleManager.createRule(
          ModelFactory.productAvailabilityRule({
            clauses: { 'meta.name': ['presley'] },
            action: { available: true },
            productTypeId,
          }),
          { apiKey: 'apiKey' },
        ),
      ];
      const digests = await digestManager.digestProducts(products);
      const expectedDigests = [
        ModelFactory.digest({
          productId: products[0].productId,
          ruleIds: [ruleIds[0]],
          availableGlobally: false,
          blacklist: [DigestHelper.GLOBAL_CONTEXT],
        }),
        ModelFactory.digest({
          productId: products[1].productId,
          ruleIds: [ruleIds[1]],
          availableGlobally: true,
          whitelist: [DigestHelper.GLOBAL_CONTEXT],
        }),
      ];
      expect(digests).to.deep.equal(expectedDigests);
    });
  });
  describe('getProductDigest', () => {
    it('should digest the product for all context levels', async () => {
      const productTypeId = 'movie';
      const white = { available: true };
      const black = { available: false };
      const clauses = { 'meta.rating': ['R'] };
      const product = ModelFactory.product({
        meta: { rating: 'R' },
        productTypeId,
        status: ProductStatus.Active,
        productTypeGroupId: 'movie',
      } as DeepPartial<Product>);
      const subscriptionIds = await Promise.all([
        productDao.create(ModelFactory.product({ productTypeId }), {
          apiKey: 'apiKey',
        }),
        productDao.create(ModelFactory.product({ productTypeId }), {
          apiKey: 'apiKey',
        }),
        productDao.create(ModelFactory.product({ productTypeId }), {
          apiKey: 'apiKey',
        }),
        productDao.create(ModelFactory.product({ productTypeId }), {
          apiKey: 'apiKey',
        }),
      ]);
      const rules = [
        // 2 rules at same site context for customer 1
        ModelFactory.productAvailabilityRule({
          ruleId: 1,
          customerId: 'I-123',
          siteId: '123',
          productTypeId,
          action: black,
          clauses,
        }),
        ModelFactory.productAvailabilityRule({
          ruleId: 2,
          customerId: 'I-123',
          siteId: '123',
          productTypeId,
          action: white,
          clauses,
        }),
        // rule for different site for customer 1
        ModelFactory.productAvailabilityRule({
          ruleId: 3,
          customerId: 'I-123',
          siteId: '321',
          productTypeId,
          action: black,
          clauses,
        }),
        // rule for customer 1
        ModelFactory.productAvailabilityRule({
          ruleId: 4,
          customerId: 'I-123',
          productTypeId,
          action: white,
          clauses,
        }),
        // rule for customer 2
        ModelFactory.productAvailabilityRule({
          ruleId: 5,
          customerId: 'I-999',
          productTypeId,
          action: black,
          clauses,
        }),
        // global rules
        ModelFactory.productAvailabilityRule({
          ruleId: 6,
          productTypeId,
          action: white,
          clauses,
        }),
        ModelFactory.productAvailabilityRule({
          ruleId: 7,
          productTypeId,
          action: white,
          clauses,
        }),
        ModelFactory.productAvailabilityRule({
          ruleId: 8,
          productTypeId,
          action: black,
          clauses,
        }),

        // subscription rules
        ModelFactory.productSubscriptionAvailabilityRule({
          ruleId: 10,
          productTypeId,
          productId: subscriptionIds[0],
          clauses,
        }),
        ModelFactory.productSubscriptionAvailabilityRule({
          ruleId: 40,
          productTypeId,
          productId: subscriptionIds[1],
          clauses,
        }),
        ModelFactory.productSubscriptionAvailabilityRule({
          ruleId: 50,
          productTypeId,
          productId: subscriptionIds[2],
          clauses,
        }),
        ModelFactory.productSubscriptionAvailabilityRule({
          ruleId: 60,
          productTypeId,
          productId: subscriptionIds[3],
          clauses: { 'meta.rating': ['G'] },
        }),
      ];
      const ruleIds = await Bluebird.map(
        rules,
        async (rule) =>
          await ruleManager.createRule(rule, { apiKey: 'apiKey' }),
      );
      const expectedDigest = {
        productId: product.productId,
        sales: { totalSales: null },
        ruleIds: ruleIds.slice(0, 11),
        availableGlobally: true,
        whitelist: ['123', 'I-123', DigestHelper.GLOBAL_CONTEXT],
        blacklist: ['321', 'I-999'],
        subscriptionProductIds: _.slice(subscriptionIds, 0, 3), // all subscriptions match
        priceOverrides: [],
        webViewOverrides: [],
      };
      const dbRules =
        await digestManager.getDigestRulesByProductTypeId(productTypeId);
      const digest = digestManager.getProductDigest(dbRules, product);
      expect(_.omit(digest, 'ruleIds', 'subscriptionProductIds')).to.deep.equal(
        _.omit(expectedDigest, 'ruleIds', 'subscriptionProductIds'),
      );
      expect(digest.ruleIds.sort()).to.deep.equal(
        expectedDigest.ruleIds.sort(),
      );
      expect(digest.subscriptionProductIds.sort()).to.deep.equal(
        expectedDigest.subscriptionProductIds.sort(),
      );
    });
    it('should match an all products rule', async () => {
      const product = ModelFactory.product({ productTypeId: 'movie' });
      await ruleManager.createRule(
        ModelFactory.rule({
          productTypeId: 'movie',
          clauses: {},
          action: { available: false },
        }),
        { apiKey: 'apiKey' },
      );
      const dbRules =
        await digestManager.getDigestRulesByProductTypeId('movie');
      const expectedDigest = {
        productId: product.productId,
        sales: { totalSales: null },
        ruleIds: dbRules.map((i) => i.ruleId),
        availableGlobally: false,
        whitelist: [],
        blacklist: ['GLOBAL'],
        subscriptionProductIds: [],
        priceOverrides: [],
        webViewOverrides: [],
      };
      const digest = digestManager.getProductDigest(dbRules, product);
      expect(digest).to.deep.equal(expectedDigest);
    });
  });
});

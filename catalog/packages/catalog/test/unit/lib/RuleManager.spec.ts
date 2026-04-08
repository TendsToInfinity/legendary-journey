import { SecurityFactory } from '@securustablets/libraries.utils-test';
import * as faker from 'faker';
import * as sinon from 'sinon';
import { Rule } from '../../../src/controllers/models/Rule';
import { RuleManager } from '../../../src/lib/RuleManager';
import { ModelFactory } from '../../utils/ModelFactory';

describe('RuleManager - Unit', () => {
  let manager: RuleManager;
  let mockDao: sinon.SinonMock;
  let mockDigestDecorator: sinon.SinonMock;
  let mockValidator: sinon.SinonMock;
  let mockOpenSearchManager: sinon.SinonMock;
  let mockProductPublishManager: sinon.SinonMock;

  const corpJwt = SecurityFactory.corpJwt();

  beforeEach(() => {
    manager = new RuleManager();
    mockDao = sinon.mock((manager as any).ruleDao);
    mockDigestDecorator = sinon.mock((manager as any).digestDecorator);
    mockValidator = sinon.mock((manager as any).ruleValidator);
    mockOpenSearchManager = sinon.mock((manager as any).openSearchManager);
    mockProductPublishManager = sinon.mock(
      (manager as any).productPublishManager,
    );
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('createRule', () => {
    it('should create the rule', async () => {
      const digest = ModelFactory.digest({
        subscriptionProductIds: [10, 11, 12],
      });
      const rule = ModelFactory.productSubscriptionAvailabilityRule();
      const newRuleId = 1;
      const products = [ModelFactory.activeMovie()];
      const digestedProducts = [ModelFactory.digestProduct()];

      mockValidator.expects('validate').withExactArgs(rule).returns(rule);
      mockDao
        .expects('create')
        .withExactArgs(rule, { corpJwt })
        .resolves(newRuleId);
      mockOpenSearchManager
        .expects('getProductsByRules')
        .withExactArgs(rule.productTypeId, [rule], null)
        .resolves({ data: products, scrollId: 'scroll-id' });
      mockOpenSearchManager
        .expects('getProductsByRules')
        .withExactArgs(rule.productTypeId, [rule], 'scroll-id')
        .resolves({ data: [] });
      mockOpenSearchManager
        .expects('digestProductsIntoOpenSearch')
        .withExactArgs(products)
        .resolves(digestedProducts);
      mockDigestDecorator
        .expects('decorator')
        .withExactArgs(digestedProducts, { enforce: true })
        .resolves([digest]);
      mockProductPublishManager.expects('publishRemovalMessage').resolves();

      const result = await manager.createRule(rule, { corpJwt });

      sinon.assert.match(result, newRuleId);

      sinon.verify();
    });
  });

  describe('updateRule', () => {
    it('should update the rule', async () => {
      const digest = ModelFactory.digest({
        subscriptionProductIds: [10, 11, 12],
      });
      const rule = ModelFactory.productSubscriptionAvailabilityRule({
        productId: 8235,
      });
      const products = [ModelFactory.activeMovie()];
      const digestedProducts = [ModelFactory.digestProduct()];

      mockValidator.expects('validate').withExactArgs(rule).returns(rule);
      mockDao.expects('update').withExactArgs(rule.ruleId, rule, { corpJwt });
      mockOpenSearchManager
        .expects('getProductsByRules')
        .withExactArgs(rule.productTypeId, [rule], null)
        .resolves({ data: products, scrollId: 'scroll-id' });
      mockOpenSearchManager
        .expects('getProductsByRules')
        .withExactArgs(rule.productTypeId, [rule], 'scroll-id')
        .resolves({ data: [] });
      mockOpenSearchManager
        .expects('digestProductsIntoOpenSearch')
        .withExactArgs(products)
        .resolves(digestedProducts);
      mockDigestDecorator
        .expects('decorator')
        .withExactArgs(digestedProducts, { enforce: true })
        .resolves([digest]);
      mockProductPublishManager.expects('publishRemovalMessage').resolves();

      await manager.updateRule(rule, { corpJwt });

      sinon.verify();
    });
  });

  describe('deleteRule', () => {
    it('should call RuleDao.delete for a product subscription rule', async () => {
      const digest = ModelFactory.digest({
        subscriptionProductIds: [10, 11, 12],
      });
      const rule = ModelFactory.productSubscriptionAvailabilityRule({
        productId: 8235,
      });
      const products = [ModelFactory.activeMovie()];
      const digestedProducts = [ModelFactory.digestProduct()];

      mockDao.expects('delete').withExactArgs(rule.ruleId, { corpJwt });
      mockDao
        .expects('findOneOrFail')
        .withExactArgs(rule.ruleId)
        .resolves(rule as Rule);
      mockOpenSearchManager
        .expects('getProductsByRules')
        .withExactArgs(rule.productTypeId, [rule], null)
        .resolves({ data: products, scrollId: 'scroll-id' });
      mockOpenSearchManager
        .expects('getProductsByRules')
        .withExactArgs(rule.productTypeId, [rule], 'scroll-id')
        .resolves({ data: [] });
      mockOpenSearchManager
        .expects('digestProductsIntoOpenSearch')
        .withExactArgs(products)
        .resolves(digestedProducts);
      mockDigestDecorator
        .expects('decorator')
        .withExactArgs(digestedProducts, { enforce: true })
        .resolves([digest]);
      mockProductPublishManager.expects('publishRemovalMessage').resolves();

      await manager.deleteRule(rule.ruleId, { corpJwt });

      sinon.verify();
    });

    it('should call RuleDao.delete for a non product subscription rule', async () => {
      const rule = ModelFactory.productAvailabilityRule({ productId: 8235 });
      const products = [ModelFactory.activeMovie()];

      mockDao.expects('delete').withExactArgs(rule.ruleId, { corpJwt });
      mockDao
        .expects('findOneOrFail')
        .withExactArgs(rule.ruleId)
        .resolves(rule as Rule);
      mockOpenSearchManager
        .expects('getProductsByRules')
        .withExactArgs(rule.productTypeId, [rule], null)
        .resolves({ data: products, scrollId: 'scroll-id' });
      mockOpenSearchManager
        .expects('getProductsByRules')
        .withExactArgs(rule.productTypeId, [rule], 'scroll-id')
        .resolves({ data: [] });
      mockOpenSearchManager
        .expects('digestProductsIntoOpenSearch')
        .withExactArgs(products)
        .resolves();

      await manager.deleteRule(rule.ruleId, { corpJwt });

      sinon.verify();
    });
  });

  describe('digestRule', () => {
    it('should digest rule', async () => {
      const rule = ModelFactory.productAvailabilityRule();
      const productSearchResponse = {
        data: [ModelFactory.product(), ModelFactory.product()],
        scrollId: 'scroll-id',
      };
      mockOpenSearchManager
        .expects('getProductsByRules')
        .withExactArgs(rule.productTypeId, [rule], null)
        .resolves(productSearchResponse);
      mockOpenSearchManager
        .expects('getProductsByRules')
        .withExactArgs(rule.productTypeId, [rule], 'scroll-id')
        .resolves({ data: [] });
      mockOpenSearchManager
        .expects('digestProductsIntoOpenSearch')
        .withExactArgs(productSearchResponse.data);
      await manager.digestRule(rule);

      sinon.verify();
    });
    it('should not digest if no products returned from getProductsByRules', async () => {
      const rule = ModelFactory.productAvailabilityRule();
      mockOpenSearchManager
        .expects('getProductsByRules')
        .withExactArgs(rule.productTypeId, [rule], null)
        .resolves({ data: [] });
      mockOpenSearchManager.expects('digestProductsIntoOpenSearch').never();
      await manager.digestRule(rule);

      sinon.verify();
    });
    it('should not digest non-digestable rules', async () => {
      const rule = ModelFactory.productTypeAvailabilityRule({
        productTypeId: 'game',
      });
      mockOpenSearchManager.expects('getProductsByRules').never();
      mockOpenSearchManager.expects('digestProductsIntoOpenSearch').never();
      await manager.digestRule(rule);

      sinon.verify();
    });
    it('should not digest restricted music rule', async () => {
      const rule = ModelFactory.productSubscriptionAvailabilityRule({
        productTypeId: 'album',
      });
      mockOpenSearchManager.expects('getProductsByRules').never();
      mockOpenSearchManager.expects('digestProductsIntoOpenSearch').never();
      await manager.digestRule(rule);

      sinon.verify();
    });
  });
  describe('getRemovedProducts', () => {
    it('given empty subscriptionIds, should return all', () => {
      const products = [
        ModelFactory.digestProduct({
          subscriptionIds: [],
        }),
        ModelFactory.digestProduct({
          subscriptionIds: [],
        }),
        ModelFactory.digestProduct({
          subscriptionIds: [],
        }),
      ];

      const observed = manager.getRemovedProducts(
        products,
        faker.random.number(),
      );
      const match = sinon.match(products);
      match.test(observed);
    });
    it('given matching subscriptionIds, should return none', () => {
      const ruleProductId = faker.random.number();
      const products = [
        ModelFactory.digestProduct({
          subscriptionIds: [ruleProductId],
        }),
        ModelFactory.digestProduct({
          subscriptionIds: [ruleProductId],
        }),
        ModelFactory.digestProduct({
          subscriptionIds: [ruleProductId],
        }),
      ];

      const observed = manager.getRemovedProducts(products, ruleProductId);
      const match = sinon.match([]);
      match.test(observed);
    });
    it('given non-matching subscriptionIds, should return all', () => {
      const ruleProductId = 4;
      const products = [
        ModelFactory.digestProduct({
          subscriptionIds: [1],
        }),
        ModelFactory.digestProduct({
          subscriptionIds: [2],
        }),
        ModelFactory.digestProduct({
          subscriptionIds: [3],
        }),
      ];

      const observed = manager.getRemovedProducts(products, ruleProductId);
      const match = sinon.match(products);
      match.test(observed);
    });
    it('should return non-matching products', () => {
      const ruleProductId = 4;
      const nonMatchingProducts = [
        ModelFactory.digestProduct({
          subscriptionIds: [1],
        }),
        ModelFactory.digestProduct({
          subscriptionIds: [2],
        }),
      ];
      const matchingProduct = ModelFactory.digestProduct({
        subscriptionIds: [4],
      });
      const products = [...nonMatchingProducts, matchingProduct];

      const observed = manager.getRemovedProducts(products, ruleProductId);
      const match = sinon.match([nonMatchingProducts]);
      match.test(observed);
    });
  });
});

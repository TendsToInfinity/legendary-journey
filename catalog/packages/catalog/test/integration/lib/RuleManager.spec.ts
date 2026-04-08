import { _ } from '@securustablets/libraries.utils';
import { SecurityFactory } from '@securustablets/libraries.utils-test';
import { assert, expect } from 'chai';
import * as faker from 'faker';
import { afterEach } from 'mocha';
import * as sinon from 'sinon';
import { Container } from 'typescript-ioc';
import { ProductDao } from '../../../src/data/PGCatalog/ProductDao';
import { OpenSearchManager } from '../../../src/lib/OpenSearchManager';
import { RuleManager } from '../../../src/lib/RuleManager';
import { ModelFactory } from '../../utils/ModelFactory';
import * as client from '../../utils/client';
import { IntegrationTestSuite } from '../IntegrationTestSuite';

const ruleManager = Container.get(RuleManager);
const productDao = Container.get(ProductDao);

describe('RuleManager - Integration', function () {
  IntegrationTestSuite.setUp(this, { openSearch: true });
  let distSpy: sinon.SinonSpy;

  beforeEach(async () => {
    const openSearchManager = Container.get(OpenSearchManager);
    distSpy = sinon.spy(openSearchManager, 'digestProductsIntoOpenSearch');
  });
  afterEach(async () => {
    sinon.restore();
    await client.clearCache();
  });

  describe('createRule', () => {
    it('creates a product availability rule', async () => {
      const rule = ModelFactory.rule({
        productTypeId: 'tvShow',
        action: { available: true },
      });
      const securityContext = { corpJwt: SecurityFactory.corpJwt() };

      const ruleId = await ruleManager.createRule(rule, securityContext);

      assert.isNumber(ruleId);
    });
    it('creates a product subscription availability rule', async () => {
      const product = ModelFactory.product();
      const productId = await productDao.create(product, {});
      const rule = ModelFactory.productSubscriptionAvailabilityRule({
        productTypeId: 'movieSubscription',
        action: { available: true },
        productId,
      });
      const securityContext = { corpJwt: SecurityFactory.corpJwt() };

      const ruleId = await ruleManager.createRule(rule, securityContext);

      assert.isNumber(ruleId);
    });
  });
  describe('digestRule', () => {
    it('creates a product availability rule and only digests impacted products', async () => {
      const customerId = faker.random.alphaNumeric(8);
      let products = [
        ModelFactory.activeMovie({ source: { vendorProductId: '1' } }),
        ModelFactory.activeMovie({
          source: { vendorProductId: '2', vendorName: 'steve' },
        }),
        ModelFactory.activeMovie({ source: { vendorProductId: '3' } }),
      ];
      products = await IntegrationTestSuite.loadProductsAndRules(
        products,
        [],
        [{ customerId }],
      );
      const availabilityRule = ModelFactory.productAvailabilityRule({
        productTypeId: 'movie',
        name: `Product Availability Rule`,
        action: { available: true },
        clauses: {
          'source.vendorProductId': ['2'],
          'source.vendorName': ['steve'],
        },
      });

      const securityContext = { corpJwt: SecurityFactory.corpJwt() };
      availabilityRule.ruleId = await ruleManager.createRule(
        availabilityRule,
        securityContext,
      );
      // Ensure we only digest the 2 impacted products

      availabilityRule.clauses = { 'source.vendorProductId': ['1', '3'] };
      await ruleManager.updateRule(availabilityRule, securityContext);

      // Our initial setup of products does a digest so start from 1 to get the digest we're looking for
      const firstDigestProducts = distSpy.getCall(1).args[0];
      const secondDigestProducts = distSpy.getCall(2).args[0];

      expect(
        _.find(firstDigestProducts, (p) => p.source.vendorProductId === '1'),
      ).to.be.undefined;
      expect(
        _.find(firstDigestProducts, (p) => p.source.vendorProductId === '2'),
      ).to.not.be.undefined;
      expect(
        _.find(firstDigestProducts, (p) => p.source.vendorProductId === '3'),
      ).to.be.undefined;
      expect(firstDigestProducts.length).to.equal(1);

      expect(
        _.find(secondDigestProducts, (p) => p.source.vendorProductId === '1'),
      ).to.not.be.undefined;
      expect(
        _.find(secondDigestProducts, (p) => p.source.vendorProductId === '2'),
      ).to.not.be.undefined;
      expect(
        _.find(secondDigestProducts, (p) => p.source.vendorProductId === '3'),
      ).to.not.be.undefined;
      expect(secondDigestProducts.length).to.equal(3);

      sinon.verify();
    });
  });
});

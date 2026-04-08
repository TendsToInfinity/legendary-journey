import { SecurityFactory } from '@securustablets/libraries.utils-test';
import * as Bluebird from 'bluebird';
import { expect } from 'chai';
import * as faker from 'faker';
import * as sinon from 'sinon';
import * as request from 'supertest';
import { Container } from 'typescript-ioc';
import { Product } from '../../../src/controllers/models/Product';
import { ProductDao } from '../../../src/data/PGCatalog/ProductDao';
import { RuleDao } from '../../../src/data/PGCatalog/RuleDao';
import { ProductManager } from '../../../src/lib/ProductManager';
import { RuleManager } from '../../../src/lib/RuleManager';
import { ProductPublishManager } from '../../../src/lib/product/ProductPublishManager';
import { app } from '../../../src/main';
import { ModelFactory } from '../../utils/ModelFactory';
import * as client from '../../utils/client';
import { IntegrationTestSuite } from '../IntegrationTestSuite';
import '../global.spec';

describe('ProductPublishManager - Integration', function () {
  IntegrationTestSuite.setUp(this, { openSearch: true });
  let corpJwt: string;
  let inmateJwt: string;
  let productDao: ProductDao;
  let productManager: ProductManager;
  let productPublishManagerSpy: sinon.SinonSpy;
  let ruleDao: RuleDao;
  let ruleManager: RuleManager;

  before(() => {
    productDao = new ProductDao();
    productManager = Container.get(ProductManager);
    ruleDao = new RuleDao();
    ruleManager = new RuleManager();
    const productPublishManager = Container.get(ProductPublishManager);
    productPublishManagerSpy = sinon.spy(
      productPublishManager,
      'publishRemovalMessage',
    );
    Container.bind(ProductPublishManager).provider({
      get: () => productPublishManager,
    });
  });

  describe('publishRemovalMessage', () => {
    let customerId: string;
    let siteId: string;
    let subscription: Product;

    beforeEach(async () => {
      customerId = `I-${faker.random.number(6)}`;
      siteId = faker.random.alphaNumeric(5).trim();

      corpJwt = await SecurityFactory.jwt(SecurityFactory.corpJwt());
      const token = SecurityFactory.inmateJwt({ customerId, siteId });
      inmateJwt = await SecurityFactory.jwt(token);

      subscription = ModelFactory.productSubscription({
        productTypeId: 'movieSubscription',
      });
      subscription.productId = await productManager.createProduct(
        subscription,
        { apiKey: 'test' },
      );
    });

    afterEach(async () => {
      productPublishManagerSpy.restore();
      await client.clearCache();
      sinon.restore();
    });

    it('should remove product with rule matching productId', async () => {
      const products = [
        ModelFactory.activeMovie(),
        ModelFactory.activeMovie(),
        ModelFactory.activeMovie(),
        ModelFactory.activeMovie(),
      ];

      await Bluebird.map(
        products,
        async (product) => {
          product.productId = await productManager.createProduct(product, {
            apiKey: 'test',
          });
        },
        { concurrency: 1 },
      );

      const availableRule = ModelFactory.productSubscriptionAvailabilityRule({
        productId: subscription.productId,
        productTypeId: 'movie',
        name: `White list subscription ${subscription.productId}`,
        action: { available: true },
        clauses: {
          productId: [
            products[0].productId,
            products[1].productId,
            products[2].productId,
          ],
        },
      });
      expect(productPublishManagerSpy.calledWithExactly([]));

      await ruleManager.createRule(availableRule, { apiKey: 'apiKey' });

      const productTypeRule = ModelFactory.productTypeAvailabilityRule({
        productId: subscription.productId,
        productTypeId: 'movie',
        name: `Product type availability rule`,
        action: { available: true },
        customerId,
        siteId,
      });

      await ruleManager.createRule(productTypeRule, { apiKey: 'apiKey' });

      const { body: productAvailable } = await request(app)
        .post(`/products/${subscription.productId}/search`)
        .send({
          match: {
            productTypeId: 'movie',
          },
        })
        .set('Authorization', `Bearer ${inmateJwt}`)
        .expect(200);

      expect(productAvailable.data.length).to.equal(3);

      const removalRule = ModelFactory.productSubscriptionAvailabilityRule({
        productId: subscription.productId,
        productTypeId: 'movie',
        name: `Black list subscription ${subscription.productId}`,
        action: { available: false },
        clauses: {
          productId: [products[0].productId, products[1].productId],
        },
      });
      expect(
        productPublishManagerSpy.calledWithExactly([products[0], products[1]]),
      );

      removalRule.ruleId = await ruleManager.createRule(removalRule, {
        apiKey: 'apiKey',
      });

      await client.clearCache();

      const { body: firstBlacklistResult } = await request(app)
        .post(`/products/${subscription.productId}/search`)
        .send({
          match: {
            productTypeId: 'movie',
          },
        })
        .set('Authorization', `Bearer ${inmateJwt}`)
        .expect(200);

      expect(firstBlacklistResult.data.length).to.equal(1);

      await ruleManager.updateRule(
        {
          ...removalRule,
          clauses: {
            productId: [
              products[0].productId,
              products[1].productId,
              products[2].productId,
            ],
          },
        },
        { apiKey: 'apiKey' },
      );
      expect(productPublishManagerSpy.calledWithExactly([products[2]]));

      await client.clearCache();

      const { body: secondBlacklistResult } = await request(app)
        .post(`/products/${subscription.productId}/search`)
        .send({
          match: {
            productTypeId: 'movie',
          },
        })
        .set('Authorization', `Bearer ${inmateJwt}`)
        .expect(200);

      expect(secondBlacklistResult.data.length).to.equal(0);
      sinon.verify();
    });

    it('should remove product with rule matching productId, empty clauses scenario', async () => {
      const products = [
        ModelFactory.activeMovie(),
        ModelFactory.activeMovie(),
        ModelFactory.activeMovie(),
        ModelFactory.activeMovie(),
      ];

      await Bluebird.map(
        products,
        async (product) => {
          product.productId = await productManager.createProduct(product, {
            apiKey: 'test',
          });
        },
        { concurrency: 1 },
      );

      const availableRule = ModelFactory.productSubscriptionAvailabilityRule({
        productId: subscription.productId,
        productTypeId: 'movie',
        name: `White list subscription ${subscription.productId}`,
        action: { available: true },
      });
      expect(productPublishManagerSpy.calledWithExactly([]));

      await ruleManager.createRule(availableRule, { apiKey: 'apiKey' });

      const productTypeRule = ModelFactory.productTypeAvailabilityRule({
        productId: subscription.productId,
        productTypeId: 'movie',
        name: `Product type availability rule`,
        action: { available: true },
        customerId,
        siteId,
      });

      await ruleManager.createRule(productTypeRule, { apiKey: 'apiKey' });

      const { body: productAvailable } = await request(app)
        .post(`/products/${subscription.productId}/search`)
        .send({
          match: {
            productTypeId: 'movie',
          },
        })
        .set('Authorization', `Bearer ${inmateJwt}`)
        .expect(200);

      expect(productAvailable.data.length).to.equal(4);

      const removalRule = ModelFactory.productSubscriptionAvailabilityRule({
        productId: subscription.productId,
        productTypeId: 'movie',
        name: `Black list subscription ${subscription.productId}`,
        action: { available: false },
      });
      expect(productPublishManagerSpy.calledWithExactly(products));

      removalRule.ruleId = await ruleManager.createRule(removalRule, {
        apiKey: 'apiKey',
      });

      await client.clearCache();

      const { body: subscriptionAfterBlacklist } = await request(app)
        .post(`/products/${subscription.productId}/search`)
        .send({
          match: {
            productTypeId: 'movie',
          },
        })
        .set('Authorization', `Bearer ${inmateJwt}`)
        .expect(200);

      expect(subscriptionAfterBlacklist.data.length).to.equal(0);
      sinon.verify();
    });

    it('should not remove product without rule matching productId', async () => {
      const product = ModelFactory.activeMovie();
      product.productId = await productManager.createProduct(product, {
        apiKey: 'test',
      });

      const product2 = ModelFactory.activeMovie();
      product2.productId = await productManager.createProduct(product2, {
        apiKey: 'test',
      });

      const availableRule = ModelFactory.productSubscriptionAvailabilityRule({
        productId: subscription.productId,
        productTypeId: 'movie',
        name: `White list subscription ${subscription.productId}`,
        action: { available: true },
        clauses: {
          productId: [product.productId, product2.productId],
        },
      });

      await ruleManager.createRule(availableRule, { apiKey: 'apiKey' });

      const productTypeRule = ModelFactory.productTypeAvailabilityRule({
        productId: subscription.productId,
        productTypeId: 'movie',
        name: `Product type availability rule`,
        action: { available: true },
        customerId,
        siteId,
      });

      await ruleManager.createRule(productTypeRule, { apiKey: 'apiKey' });

      const { body: productAvailable } = await request(app)
        .post(`/products/${subscription.productId}/search`)
        .send({
          match: {
            productTypeId: 'movie',
          },
        })
        .set('Authorization', `Bearer ${inmateJwt}`)
        .expect(200);

      expect(productAvailable.data.length).to.equal(2);

      const removalRule = ModelFactory.productSubscriptionAvailabilityRule({
        productId: subscription.productId,
        productTypeId: 'movie',
        name: `Black list subscription ${subscription.productId}`,
        action: { available: false },
        clauses: {
          productId: [product.productId],
        },
      });

      await ruleManager.createRule(removalRule, { apiKey: 'apiKey' });

      await client.clearCache();

      const { body: oneProductAvailable } = await request(app)
        .post(`/products/${subscription.productId}/search`)
        .send({
          match: {
            productTypeId: 'movie',
          },
        })
        .set('Authorization', `Bearer ${inmateJwt}`)
        .expect(200);

      expect(oneProductAvailable.data.length).to.equal(1);
      expect(oneProductAvailable.data[0].productId).to.equal(
        product2.productId,
      );
      sinon.verify();
    });
  });
});

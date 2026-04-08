import { expect } from 'chai';
import * as request from 'supertest';
import { app } from '../../../src/main';
import { ModelFactory } from '../../utils/ModelFactory';
import { IntegrationTestSuite } from '../IntegrationTestSuite';
import '../global.spec';

describe('DigestController', function () {
  IntegrationTestSuite.setUp(this, { openSearch: true });

  const productTypeId = 'movie';

  describe('digestProducts', () => {
    it('should digest products by query string', async () => {
      const products = [
        ModelFactory.product({ productTypeId }),
        ModelFactory.product({ productTypeId }),
        ModelFactory.product({
          productTypeId,
          source: { vendorProductId: '777' },
        }),
      ];
      const rules = [
        ModelFactory.productAvailabilityRule({
          productTypeId,
          customerId: 'I-5',
        }),
        ModelFactory.productAvailabilityRule({
          productTypeId,
          customerId: 'I-5',
          siteId: '90210',
        }),
        ModelFactory.productAvailabilityRule({ productTypeId }),
        ModelFactory.productSubscriptionAvailabilityRule({
          productTypeId,
          productId: 777,
        }),
      ];
      await IntegrationTestSuite.loadProductsAndRules(products, rules, [
        { customerId: 'I-5' },
      ]);
      const { body } = await request(app)
        .post(`/digest/products/${productTypeId}`)
        .set('x-api-key', 'API_KEY_DEV')
        .send()
        .expect(200);
      expect(body.data.length).to.equal(3);
      for (const digestProduct of body.data) {
        expect(digestProduct).to.haveOwnProperty('digest');
      }
    });
  });
});

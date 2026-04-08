import { expect } from 'chai';
import { RuleType } from '../../../src/controllers/models/Rule';
import { RuleDao } from '../../../src/data/PGCatalog/RuleDao';
import { ProductTypeManager } from '../../../src/lib/ProductTypeManager';
import { ModelFactory } from '../../utils/ModelFactory';
import { IntegrationTestSuite } from '../IntegrationTestSuite';

describe('ProductTypeManager - Integration', function () {
  IntegrationTestSuite.setUp(this);
  let productTypeManager: ProductTypeManager;
  let ruleDao: RuleDao;

  beforeEach(() => {
    productTypeManager = new ProductTypeManager();
    ruleDao = new RuleDao();
  });

  describe('isProductTypeAvailableForContext', () => {
    const siteId = '90210';
    const customerId = 'I-024601';
    const type = RuleType.ProductTypeAvailability;
    const whitelist = { available: true };
    const blacklist = { available: false };
    const productTypeId = 'track';
    it('should return false if there are no rules', async () => {
      expect(
        await productTypeManager.isProductTypeAvailableForContext(
          productTypeId,
          { customerId, siteId },
        ),
      ).to.equal(false);
    });
    it('should not consider rules for the wrong productType', async () => {
      await ruleDao.create(
        ModelFactory.rule({
          customerId,
          type,
          action: whitelist,
          productTypeId: 'album',
        }),
        { apiKey: 'test' },
      );
      expect(
        await productTypeManager.isProductTypeAvailableForContext(
          productTypeId,
          { customerId, siteId },
        ),
      ).to.equal(false);
    });
    it('should return true if there is a customer WL', async () => {
      await ruleDao.create(
        ModelFactory.rule({
          customerId,
          type,
          action: whitelist,
          productTypeId,
        }),
        { apiKey: 'test' },
      );
      expect(
        await productTypeManager.isProductTypeAvailableForContext(
          productTypeId,
          { customerId, siteId },
        ),
      ).to.equal(true);
    });
    it('should return false if there is a customer BL', async () => {
      await ruleDao.create(
        ModelFactory.rule({
          customerId,
          type,
          action: blacklist,
          productTypeId,
        }),
        { apiKey: 'test' },
      );
      expect(
        await productTypeManager.isProductTypeAvailableForContext(
          productTypeId,
          { customerId, siteId },
        ),
      ).to.equal(false);
    });
    it('should return true if there is a site WL and no customer rule', async () => {
      await ruleDao.create(
        ModelFactory.rule({
          customerId,
          siteId,
          type,
          action: whitelist,
          productTypeId,
        }),
        { apiKey: 'test' },
      );
      expect(
        await productTypeManager.isProductTypeAvailableForContext(
          productTypeId,
          { customerId, siteId },
        ),
      ).to.equal(true);
    });
    it('should return false if there is a site BL and no customer rule', async () => {
      await ruleDao.create(
        ModelFactory.rule({
          customerId,
          siteId,
          type,
          action: blacklist,
          productTypeId,
        }),
        { apiKey: 'test' },
      );
      expect(
        await productTypeManager.isProductTypeAvailableForContext(
          productTypeId,
          { customerId, siteId },
        ),
      ).to.equal(false);
    });
    it('should return true if there is a customer BL and a site WL', async () => {
      const srcRules = [
        ModelFactory.rule({
          customerId,
          type,
          action: blacklist,
          productTypeId,
        }),
        ModelFactory.rule({
          customerId,
          siteId,
          type,
          action: whitelist,
          productTypeId,
        }),
      ];

      for (const rule of srcRules) {
        await ruleDao.create(rule, { apiKey: 'test' });
      }
      expect(
        await productTypeManager.isProductTypeAvailableForContext(
          productTypeId,
          { customerId, siteId },
        ),
      ).to.equal(true);
    });
    it('should return false if there is a customer WL and a site BL', async () => {
      const srcRules = [
        ModelFactory.rule({
          customerId,
          type,
          action: whitelist,
          productTypeId,
        }),
        ModelFactory.rule({
          customerId,
          siteId,
          type,
          action: blacklist,
          productTypeId,
        }),
      ];

      for (const rule of srcRules) {
        await ruleDao.create(rule, { apiKey: 'test' });
      }
      expect(
        await productTypeManager.isProductTypeAvailableForContext(
          productTypeId,
          { customerId, siteId },
        ),
      ).to.equal(false);
    });
  });
});

import { expect } from 'chai';
import { Exception } from 'securus.tablets.libraries.exceptions';
import * as sinon from 'sinon';
import { RuleType } from '../../../src/controllers/models/Rule';
import { DigestHelper } from '../../../src/lib/DigestHelper';
import { DigestManager } from '../../../src/lib/DigestManager';
import { Digest } from '../../../src/models/Digest';
import { ModelFactory } from '../../utils/ModelFactory';

describe('DigestManager - Unit', () => {
  let digestManager: DigestManager;
  let mockRuleDao: sinon.SinonMock;
  let mockDigestHelper: sinon.SinonMock;

  beforeEach(() => {
    digestManager = new DigestManager();
    mockRuleDao = sinon.mock((digestManager as any).ruleDao);
    mockDigestHelper = sinon.mock(DigestHelper);
  });

  afterEach(() => {
    sinon.reset();
  });

  describe('getDigestRulesByProductTypeId', () => {
    it('should call ruleManager and return rules of RuleType.ProductAvailability', async () => {
      const productTypeId = 'car';
      const rule = ModelFactory.rule({ productTypeId: productTypeId });
      mockRuleDao
        .expects('find')
        .withExactArgs({
          by: { productTypeId },
          customClauses: [
            {
              clause: `type = ANY($1::text[])`,
              params: [
                [
                  RuleType.ProductAvailability,
                  RuleType.ProductSubscriptionAvailability,
                ],
              ],
            },
          ],
        })
        .resolves([rule]);
      mockRuleDao.expects('convertTo').resolves(rule);
      const result =
        await digestManager.getDigestRulesByProductTypeId(productTypeId);
      expect(result).to.deep.equal([rule]);
      sinon.verify();
    });
  });
  describe('getRulesByProductType', () => {
    it('should call ruleDao to get the rules', async () => {
      const context = { customerId: 'I-321654', siteId: '90210' };
      const rule1 = ModelFactory.rule();
      const rule2 = ModelFactory.rule();
      const rule3 = ModelFactory.rule();
      mockRuleDao
        .expects('findByContextWithJsonClauses')
        .withExactArgs(context, ['movie'], [RuleType.ProductPrice])
        .resolves([rule1, rule2, rule3]);
      mockRuleDao.expects('findSetByContext').never();
      mockRuleDao.expects('convertTo').never();
      const rules = await digestManager.getRulesByProductType(
        context,
        ['movie'],
        [RuleType.ProductPrice],
      );
      expect(rules).to.deep.equal([rule1, rule2, rule3]);
      mockRuleDao.verify();
    });
  });
  describe('getDigestRulesByContext', () => {
    it('should call ruleDao to get the rules', async () => {
      const context = { customerId: 'I-321654', siteId: '90210' };
      const rule1 = ModelFactory.rule();
      const rule2 = ModelFactory.rule();
      const rule3 = ModelFactory.rule();
      mockRuleDao
        .expects('findByContextWithJsonClauses')
        .withExactArgs(context, undefined, [
          RuleType.ProductAvailability,
          RuleType.ProductSubscriptionAvailability,
          RuleType.ProductPrice,
        ])
        .resolves([rule1, rule2, rule3]);
      mockRuleDao.expects('findSetByContext').never();
      mockRuleDao.expects('convertTo').never();
      const rules = await digestManager.getDigestRulesByContext(context);
      expect(rules).to.deep.equal([rule1, rule2, rule3]);
      mockRuleDao.verify();
    });
  });

  describe('digestProductsForContext', () => {
    const productTypeId = 'car';
    it('should throw an error if the products do not all have the same productTypeId', async () => {
      const products = [
        ModelFactory.product({ productTypeId }),
        ModelFactory.product({ productTypeId: 'horse' }),
      ];
      try {
        await digestManager.digestProductsForContext(products, {});
        expect.fail();
      } catch (error) {
        expect(error.message).to.equal(
          'All products must have the same productTypeId. Found: ["car","horse"]',
        );
        expect(error.name).to.equal(Exception.InvalidData.name);
      }
    });
    it('should return a digest for every product', async () => {
      const products = [
        ModelFactory.product({ productTypeId }),
        ModelFactory.product({ productTypeId }),
      ];
      const rules = [ModelFactory.rule(), ModelFactory.rule()];
      const ruleLookupStub = sinon
        .stub(digestManager, 'getDigestRulesByContext')
        .withArgs(productTypeId)
        .resolves(rules);
      const productDigestStub = sinon
        .stub(digestManager, 'getProductDigest')
        .returns(ModelFactory.digest());
      await digestManager.digestProductsForContext(products, {});
      expect(ruleLookupStub.calledOnce);
      expect(productDigestStub.calledTwice);
    });
  });
  describe('digestProducts', () => {
    const productTypeId = 'car';
    it('should throw an error if the products do not all have the same productTypeId', async () => {
      const products = [
        ModelFactory.product({ productTypeId }),
        ModelFactory.product({ productTypeId: 'horse' }),
      ];
      try {
        await digestManager.digestProducts(products);
        expect.fail();
      } catch (error) {
        expect(error.message).to.equal(
          'All products must have the same productTypeId. Found: ["car","horse"]',
        );
        expect(error.name).to.equal(Exception.InvalidData.name);
      }
    });
    it('should return a digest for every product', async () => {
      const products = [
        ModelFactory.product({ productTypeId }),
        ModelFactory.product({ productTypeId }),
      ];
      const rules = [ModelFactory.rule(), ModelFactory.rule()];
      const ruleLookupStub = sinon
        .stub(digestManager, 'getDigestRulesByProductTypeId')
        .withArgs(productTypeId)
        .resolves(rules);
      const productDigestStub = sinon
        .stub(digestManager, 'getProductDigest')
        .returns(ModelFactory.digest());
      await digestManager.digestProducts(products);
      expect(ruleLookupStub.calledOnce);
      expect(productDigestStub.calledTwice);
    });
  });
  describe('getEffectivePrice', () => {
    const purchaseType = 'purchaseType';
    it('should return undefined if there are no rules', () => {
      const digest = ModelFactory.digest();
      const context = { enforce: false, customerId: 'I-6', siteId: '90210' };
      expect(digestManager.getEffectivePrice(context, digest)).to.equal(
        undefined,
      );
    });
    it('should only match rules per context (global always, customerId=, siteId=)', () => {
      const digest = ModelFactory.digest({
        priceOverrides: [
          {
            isGlobal: true,
            customerId: null,
            siteId: null,
            productId: null,
            purchaseType,
            effectivePrice: 5,
          },
          {
            isGlobal: false,
            customerId: 'I-6',
            siteId: null,
            productId: null,
            purchaseType,
            effectivePrice: 5,
          },
          {
            isGlobal: false,
            customerId: 'I-6',
            siteId: '90210',
            productId: null,
            purchaseType,
            effectivePrice: 5,
          },
          {
            isGlobal: false,
            customerId: 'I-9',
            siteId: null,
            productId: null,
            purchaseType,
            effectivePrice: 500,
          },
        ],
      });
      const context = { enforce: false, customerId: 'I-6', siteId: '90210' };
      expect(digestManager.getEffectivePrice(context, digest)).to.deep.equal({
        [purchaseType]: 5,
      });
    });
    it('should only choose the highest value out of all matched overrides', () => {
      const digest = ModelFactory.digest({
        priceOverrides: [
          {
            isGlobal: true,
            customerId: null,
            siteId: null,
            productId: null,
            purchaseType,
            effectivePrice: 500,
          },
          {
            isGlobal: false,
            customerId: 'I-6',
            siteId: null,
            productId: null,
            purchaseType,
            effectivePrice: 50,
          },
          {
            isGlobal: false,
            customerId: 'I-6',
            siteId: '90210',
            productId: null,
            purchaseType,
            effectivePrice: 5,
          },
        ],
      });
      const context = { enforce: false, customerId: 'I-6', siteId: '90210' };
      expect(digestManager.getEffectivePrice(context, digest)).to.deep.equal({
        [purchaseType]: 500,
      });
    });
  });
  describe('getEffectiveUrlAndDisplayPriority', () => {
    const purchaseType = 'purchaseType';
    it('should return undefined if there are no rules', () => {
      const digest = ModelFactory.digest();
      const context = { enforce: false, customerId: 'I-6', siteId: '90210' };
      expect(
        digestManager.getEffectiveUrlAndDisplayPriority(context, digest),
      ).to.equal(undefined);
    });
    it('should only match rules per context (product always, customerId=, siteId=)', () => {
      const digest = ModelFactory.digest({
        webViewOverrides: [
          {
            customerId: 'I-6',
            siteId: '90210',
            productId: 5,
            effectiveUrl: 'https://elves.com/noldor/feanor',
            effectiveDisplayPriority: 2,
          },
          {
            customerId: 'I-6',
            siteId: null,
            productId: 5,
            effectiveUrl: 'https://elves.com/noldor/',
            effectiveDisplayPriority: 2,
          },
          {
            customerId: null,
            siteId: null,
            productId: 5,
            effectiveUrl: 'https://elves.com',
            effectiveDisplayPriority: 3,
          },
        ],
      });
      const context = { enforce: false, customerId: 'I-6', siteId: '90210' };
      expect(
        digestManager.getEffectiveUrlAndDisplayPriority(context, digest),
      ).to.deep.equal({
        url: 'https://elves.com/noldor/feanor',
        displayPriority: 2,
      });
    });
  });
  describe('getProductDigest', () => {
    it('should return a default digest if no rules', () => {
      const product = ModelFactory.product({
        productId: 777,
        productTypeId: 'fake',
      });
      mockDigestHelper
        .expects('groupRulesByContext')
        .withExactArgs([])
        .returns([]);
      mockDigestHelper.expects('updateDigestForRuleSet').never();
      const expectedDigest: Digest = ModelFactory.digest({
        productId: 777,
      });
      const digest = digestManager.getProductDigest([], product);
      expect(digest).to.deep.equal(expectedDigest);
      mockDigestHelper.verify();
    });
    it('should create a digest with one matching rule', () => {
      const productTypeId = 'fake';
      const rules = [
        ModelFactory.rule({
          productTypeId,
          ruleId: 10,
          clauses: { 'meta.name': 'elvis' },
          customerId: 'I-5',
          siteId: '90210',
          action: { available: false },
        }),
      ];
      const product = ModelFactory.product({
        productId: 777,
        productTypeId,
        meta: { name: 'elvis' },
      });
      const ruleSet = ModelFactory.ruleSet({
        productTypeId,
        rules,
        context: {
          isGlobal: false,
          customerId: 'I-5',
          siteId: '90210',
          productId: null,
        },
      });
      const expectedDigest: Digest = ModelFactory.digest({
        productId: 777,
        ruleIds: [10],
      });
      mockDigestHelper
        .expects('groupRulesByContext')
        .withExactArgs(rules)
        .returns([ruleSet]);
      mockDigestHelper
        .expects('initializeDigest')
        .withExactArgs(rules, product)
        .returns(expectedDigest);
      mockDigestHelper
        .expects('updateDigestForRuleSet')
        .withExactArgs(expectedDigest, ruleSet)
        .returns(expectedDigest);
      digestManager.getProductDigest(rules, product);
      mockDigestHelper.verify();
    });
  });
});

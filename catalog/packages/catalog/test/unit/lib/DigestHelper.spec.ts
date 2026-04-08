import { _ } from '@securustablets/libraries.utils';
import { expect } from 'chai';
import * as moment from 'moment';
import * as sinon from 'sinon';
import { ProductStatus } from '../../../db/reference/Product';
import { RuleSet } from '../../../src/controllers/models/Rule';
import { Context } from '../../../src/controllers/models/Search';
import { DigestHelper } from '../../../src/lib/DigestHelper';
import { RuleHelper } from '../../../src/lib/RuleHelper';
import {
  Digest,
  PriceOverride,
  WebViewOverride,
} from '../../../src/models/Digest';
import { ModelFactory } from '../../utils/ModelFactory';

describe('DigestHelper - Unit', () => {
  describe('isProductAvailableForContext', () => {
    let clock;
    const NOW = '2018-06-04T23:59:59.000';
    beforeEach(() => {
      clock = sinon.useFakeTimers(moment(NOW).valueOf());
    });
    afterEach(() => {
      clock.restore();
    });
    describe('global filters', () => {
      it('should return false for a product that is not Active', () => {
        const product = ModelFactory.product({
          productId: 123,
          status: ProductStatus.PendingReview,
        });
        const context: Context = { productId: product.productId.toString() };
        const digest: Digest = ModelFactory.digest({
          subscriptionProductIds: [product.productId],
        });
        expect(
          DigestHelper.isProductAvailableForContext(product, context, digest),
        ).to.equal(false);
      });
      it('should return false for a product that isBlocked', () => {
        const product = ModelFactory.product({
          productId: 123,
          isBlocked: true,
        });
        const context: Context = { productId: product.productId.toString() };
        const digest: Digest = ModelFactory.digest({
          subscriptionProductIds: [product.productId],
        });
        expect(
          DigestHelper.isProductAvailableForContext(product, context, digest),
        ).to.equal(false);
      });
      it('should return false for a startDate in the future', () => {
        const product = ModelFactory.product({
          productId: 123,
          meta: { startDate: '2019-01-01' },
        });
        const context: Context = { productId: product.productId.toString() };
        const digest: Digest = ModelFactory.digest({
          subscriptionProductIds: [product.productId],
        });
        expect(
          DigestHelper.isProductAvailableForContext(product, context, digest),
        ).to.equal(false);
      });
      it('should return false for an endDate in the future', () => {
        const product = ModelFactory.product({
          productId: 123,
          meta: { endDate: '2017-01-01' },
        });
        const context: Context = { productId: product.productId.toString() };
        const digest: Digest = ModelFactory.digest({
          subscriptionProductIds: [product.productId],
        });
        expect(
          DigestHelper.isProductAvailableForContext(product, context, digest),
        ).to.equal(false);
      });
    });
    describe('subscriptionProduct context', () => {
      it('should return true if the context is productId and the digest contains the product', () => {
        const product = ModelFactory.product({ productId: 123 });
        const context: Context = { productId: product.productId.toString() };
        const digest: Digest = ModelFactory.digest({
          subscriptionProductIds: [product.productId],
        });
        expect(
          DigestHelper.isProductAvailableForContext(product, context, digest),
        ).to.equal(true);
      });
      it('should return false if the context is productId and the digest does not contains the product', () => {
        const product = ModelFactory.product({ productId: 123 });
        const context: Context = { productId: product.productId.toString() };
        const digest: Digest = ModelFactory.digest({
          subscriptionProductIds: [1234],
        });
        expect(
          DigestHelper.isProductAvailableForContext(product, context, digest),
        ).to.equal(false);
      });
    });
    describe('site context', () => {
      it('should return true if the product is WL at the site', () => {
        const product = ModelFactory.product({ productId: 123 });
        const context: Context = { siteId: '1234', customerId: '4321' };
        const digest: Digest = ModelFactory.digest({ whitelist: ['1234'] });
        expect(
          DigestHelper.isProductAvailableForContext(product, context, digest),
        ).to.equal(true);
      });
      it('should return false if the product is BL at the site', () => {
        const product = ModelFactory.product({ productId: 123 });
        const context: Context = { siteId: '1234', customerId: '4321' };
        const digest: Digest = ModelFactory.digest({ blacklist: ['1234'] });
        expect(
          DigestHelper.isProductAvailableForContext(product, context, digest),
        ).to.equal(false);
      });
    });
    describe('customer context', () => {
      it('should return true if the product is WL at the customer with no site list', () => {
        const product = ModelFactory.product({ productId: 123 });
        const context: Context = { siteId: '1234', customerId: '4321' };
        const digest: Digest = ModelFactory.digest({ whitelist: ['4321'] });
        expect(
          DigestHelper.isProductAvailableForContext(product, context, digest),
        ).to.equal(true);
      });
      it('should return false if the product is BL at the customer with no site list', () => {
        const product = ModelFactory.product({ productId: 123 });
        const context: Context = { siteId: '1234', customerId: '4321' };
        const digest: Digest = ModelFactory.digest({ blacklist: ['4321'] });
        expect(
          DigestHelper.isProductAvailableForContext(product, context, digest),
        ).to.equal(false);
      });
    });
    describe('global context', () => {
      it('should return availableGlobally in the absence of matching customer/site lists', () => {
        const product = ModelFactory.product({ productId: 123 });
        const context: Context = { siteId: '1234', customerId: '4321' };
        const digest: Digest = ModelFactory.digest({ availableGlobally: true });
        expect(
          DigestHelper.isProductAvailableForContext(product, context, digest),
        ).to.equal(true);
        digest.availableGlobally = false;
        expect(
          DigestHelper.isProductAvailableForContext(product, context, digest),
        ).to.equal(false);
      });
    });
    describe('mixed contexts', () => {
      it('should return true if any WL exists', () => {
        const product = ModelFactory.product({ productId: 123 });
        const context: Context = { siteId: '1234', customerId: '4321' };
        const digest: Digest = ModelFactory.digest({
          availableGlobally: true,
          blacklist: ['1234'],
          whitelist: ['4321'],
        });
        expect(
          DigestHelper.isProductAvailableForContext(product, context, digest),
        ).to.equal(true);
      });
      it('should return false if any no WL and any BL', () => {
        const product = ModelFactory.product({ productId: 123 });
        const context: Context = { siteId: '1234', customerId: '4321' };
        const digest: Digest = ModelFactory.digest({
          availableGlobally: true,
          blacklist: ['4321'],
        });
        expect(
          DigestHelper.isProductAvailableForContext(product, context, digest),
        ).to.equal(false);
      });
      it('should return false if any global WL and any BL', () => {
        const product = ModelFactory.product({ productId: 123 });
        const context: Context = { siteId: '1234', customerId: '4321' };
        const digest: Digest = ModelFactory.digest({
          availableGlobally: true,
          whitelist: [DigestHelper.GLOBAL_CONTEXT],
          blacklist: ['4321'],
        });
        expect(
          DigestHelper.isProductAvailableForContext(product, context, digest),
        ).to.equal(true);
      });
    });
  });
  describe('groupRulesByContext', () => {
    it('should group rules by context exactly', () => {
      const productTypeId = 'movie';
      /**
       * Covers all permutations of RuleSet contexts (hence the test being so large)
       *    customer, site, productId
       *    customer, site
       *    customer, productId
       *    customer
       *    global, productId
       *    global
       * It was decided this is the better approach to ensure coverage of context level interactions
       * This test calls DigestHelper.getRuleContext without stubbing
       */

      const rules = [
        // 2 rules at same site context for customer 1
        ModelFactory.productAvailabilityRule({
          ruleId: 1,
          customerId: 'I-123',
          siteId: '123',
          productTypeId,
        }),
        ModelFactory.productAvailabilityRule({
          ruleId: 2,
          customerId: 'I-123',
          siteId: '123',
          productTypeId,
        }),
        // rule for different site for customer 1
        ModelFactory.productAvailabilityRule({
          ruleId: 3,
          customerId: 'I-123',
          siteId: '321',
          productTypeId,
        }),
        // rule for customer 1
        ModelFactory.productAvailabilityRule({
          ruleId: 4,
          customerId: 'I-123',
          productTypeId,
        }),
        // rule for customer 2
        ModelFactory.productAvailabilityRule({
          ruleId: 5,
          customerId: 'I-999',
          productTypeId,
        }),
        // global rules
        ModelFactory.productAvailabilityRule({ ruleId: 6, productTypeId }),
        ModelFactory.productAvailabilityRule({ ruleId: 7, productTypeId }),
        ModelFactory.productAvailabilityRule({ ruleId: 8, productTypeId }),

        // subscription rules
        ModelFactory.productSubscriptionAvailabilityRule({
          ruleId: 10,
          productTypeId,
          productId: 101,
        }),
        ModelFactory.productSubscriptionAvailabilityRule({
          ruleId: 40,
          productTypeId,
          productId: 401,
        }),
        ModelFactory.productSubscriptionAvailabilityRule({
          ruleId: 50,
          productTypeId,
          productId: 501,
        }),
        ModelFactory.productSubscriptionAvailabilityRule({
          ruleId: 60,
          productTypeId,
          productId: 601,
        }),
      ];
      const contexts = [
        { isGlobal: false, customerId: null, siteId: null, productId: 101 },
        {
          isGlobal: false,
          customerId: 'I-123',
          siteId: '123',
          productId: null,
        },
        {
          isGlobal: false,
          customerId: 'I-123',
          siteId: '321',
          productId: null,
        },
        { isGlobal: false, customerId: null, siteId: null, productId: 401 },
        { isGlobal: false, customerId: 'I-123', siteId: null, productId: null },
        { isGlobal: false, customerId: null, siteId: null, productId: 501 },
        { isGlobal: false, customerId: 'I-999', siteId: null, productId: null },
        { isGlobal: false, customerId: null, siteId: null, productId: 601 },
        { isGlobal: true, customerId: null, siteId: null, productId: null },
      ];
      const ruleSets = DigestHelper.groupRulesByContext(rules);
      expect(ruleSets.length).to.equal(contexts.length);
      contexts.forEach((context) => {
        // Each context should have 1 ruleSet
        expect(_.filter(ruleSets, { context }).length).to.equal(1);
      });

      // product rule for customer1, site1
      expect(_.find(ruleSets, { context: contexts[0] }).rules.length).to.equal(
        1,
      );
      // 2 rules, customer1, site1
      expect(_.find(ruleSets, { context: contexts[1] }).rules.length).to.equal(
        2,
      );
      // 1 rule, customer1, site2
      expect(_.find(ruleSets, { context: contexts[2] }).rules.length).to.equal(
        1,
      );
      // product rule for customer1, no site
      expect(_.find(ruleSets, { context: contexts[3] }).rules.length).to.equal(
        1,
      );
      // 1 rule, customer1, no site
      expect(_.find(ruleSets, { context: contexts[4] }).rules.length).to.equal(
        1,
      );
      // product rule for customer2, no site
      expect(_.find(ruleSets, { context: contexts[5] }).rules.length).to.equal(
        1,
      );
      // 1 rule, customer2, no site
      expect(_.find(ruleSets, { context: contexts[6] }).rules.length).to.equal(
        1,
      );
      // product rule for global
      expect(_.find(ruleSets, { context: contexts[7] }).rules.length).to.equal(
        1,
      );
      // 3 rules, global
      expect(_.find(ruleSets, { context: contexts[8] }).rules.length).to.equal(
        3,
      );
    });
  });
  describe('initializeDigest', () => {
    it('should return a Digest with productId, productTypeId, and ruleIds filled in', () => {
      const rules = [
        ModelFactory.rule({ ruleId: 1 }),
        ModelFactory.rule({ ruleId: 2 }),
        ModelFactory.rule({ ruleId: 3 }),
        ModelFactory.rule({ ruleId: 4 }),
      ];
      const product = ModelFactory.product({
        productId: 777,
        productTypeId: 'productTypeId',
      });
      const matchStub = sinon.stub(RuleHelper, 'ruleMatchesProduct');
      matchStub.withArgs(rules[0], product).returns(false);
      matchStub.withArgs(rules[1], product).returns(true);
      matchStub.withArgs(rules[2], product).returns(true);
      matchStub.withArgs(rules[3], product).returns(false);
      const expectedDigest: Digest = {
        productId: 777,
        ruleIds: [2, 3],
        availableGlobally: true,
        whitelist: [],
        blacklist: [],
        subscriptionProductIds: [],
        priceOverrides: [],
        webViewOverrides: [],
        sales: { totalSales: null },
      };
      expect(DigestHelper.initializeDigest(rules, product)).to.deep.equal(
        expectedDigest,
      );
    });
  });
  /**
   * WL = Whitelist, explicitly allowed
   * BL = BlackList, explicitly disallowed
   * Expectations:
   *   - if ruleSet.context.productId
   *      - if WL and no BL, add productId to subscriptionProductIds
   *      - if WL and BL, do not add productId to subscriptionProductIds
   *      - if no WL and no BL, do not add productId to subscriptionProductIds
   *   - if ruleSet.context.siteId
   *      - if WL, updated WL sites
   *      - if BL, updated BL sites
   *   - if ruleSet.context.customerId
   *      - if WL, updated WL customers
   *      - if BL, update BL customers
   *   - if ruleSet.context.isGlobal
   *      - true: !BL || WL
   *      - false: BL && !WL
   */
  describe('updateDigestForRuleSet', () => {
    const productTypeId = 'productTypeId';
    const initialDigest = () => {
      return _.cloneDeep({
        productId: 777,
        productTypeId,
        isDirty: false,
        ruleIds: [1, 2, 3],
        availableGlobally: true,
        whitelist: [],
        blacklist: [],
        subscriptionProductIds: [],
        priceOverrides: [],
        webViewOverrides: [],
        sales: { totalSales: null },
      });
    };
    describe('Availability', () => {
      // default availability rules to enabled:true, there is a test to verify disabled is ignored
      const getRule = (
        ruleId: number,
        available: boolean,
        enabled: boolean = true,
      ) => {
        return ModelFactory.rule({ ruleId, enabled, action: { available } });
      };
      describe('Universal Checks', () => {
        it('should ignore disabled rules', () => {
          const digest = initialDigest();
          const ruleSet: RuleSet = {
            productTypeId,
            context: {
              isGlobal: false,
              customerId: 'cid',
              siteId: null,
              productId: null,
            },
            rules: [
              getRule(1, false, false),
              getRule(2, false, false),
              getRule(3, false, false),
            ],
          };
          DigestHelper.updateDigestForRuleSet(digest, ruleSet);
          expect(digest).to.deep.equal(initialDigest());
        });
        it('should return an unchanged digest if the rule set does not match', () => {
          const digest = initialDigest();
          const ruleSet: RuleSet = {
            productTypeId,
            context: {
              isGlobal: false,
              customerId: 'cid',
              siteId: null,
              productId: null,
            },
            rules: [getRule(7, true), getRule(5, true)],
          };
          DigestHelper.updateDigestForRuleSet(digest, ruleSet);
          expect(digest).to.deep.equal(initialDigest());
        });
      });
      describe('Product Context', () => {
        const context = {
          customerId: null,
          siteId: null,
          isGlobal: false,
          productId: 1234,
        };

        it('should update subscriptionProductIds if WL and no BL', () => {
          const digest = initialDigest();
          const ruleSet: RuleSet = {
            productTypeId,
            context,
            rules: [getRule(1, true)],
          };
          const expectedDigest = { ...digest, subscriptionProductIds: [1234] };
          DigestHelper.updateDigestForRuleSet(digest, ruleSet);
          expect(digest).to.deep.equal(expectedDigest);
        });
        it('should not update subscriptionProductIds if no WL and BL', () => {
          const digest = initialDigest();
          const ruleSet: RuleSet = {
            productTypeId,
            context,
            rules: [getRule(1, false)],
          };
          DigestHelper.updateDigestForRuleSet(digest, ruleSet);
          expect(digest).to.deep.equal(initialDigest());
        });
        it('should not update subscriptionProductIds if no WL and no BL', () => {
          const digest = initialDigest();
          const ruleSet: RuleSet = {
            productTypeId,
            context,
            rules: [getRule(7, false)],
          };
          DigestHelper.updateDigestForRuleSet(digest, ruleSet);
          expect(digest).to.deep.equal(initialDigest());
        });
        it('should not update subscriptionProductIds if WL and BL', () => {
          const digest = initialDigest();
          const ruleSet: RuleSet = {
            productTypeId,
            context,
            rules: [getRule(1, true), getRule(2, false)],
          };
          DigestHelper.updateDigestForRuleSet(digest, ruleSet);
          expect(digest).to.deep.equal(initialDigest());
        });
      });
      describe('Site Context', () => {
        const context = {
          customerId: 'I-5',
          siteId: '90210',
          isGlobal: false,
          productId: null,
        };

        it('should update site WL if WL and no BL', () => {
          const digest = initialDigest();
          const ruleSet: RuleSet = {
            productTypeId,
            context,
            rules: [getRule(1, true)],
          };
          const expectedDigest = { ...digest, whitelist: ['90210'] };
          DigestHelper.updateDigestForRuleSet(digest, ruleSet);
          expect(digest).to.deep.equal(expectedDigest);
        });
        it('should update site BL if no WL and BL', () => {
          const digest = initialDigest();
          const ruleSet: RuleSet = {
            productTypeId,
            context,
            rules: [getRule(1, false)],
          };
          const expectedDigest = { ...digest, blacklist: ['90210'] };
          DigestHelper.updateDigestForRuleSet(digest, ruleSet);
          expect(digest).to.deep.equal(expectedDigest);
        });
        it('should not make any WL/BL updates if no rules match', () => {
          const digest = initialDigest();
          const ruleSet: RuleSet = {
            productTypeId,
            context,
            rules: [getRule(7, false)],
          };
          const expectedDigest = { ...digest };
          DigestHelper.updateDigestForRuleSet(digest, ruleSet);
          expect(digest).to.deep.equal(expectedDigest);
        });
      });
      describe('Customer Context', () => {
        const context = {
          customerId: 'I-5',
          siteId: null,
          isGlobal: false,
          productId: null,
        };

        it('should update customer WL if WL and no BL', () => {
          const digest = initialDigest();
          const ruleSet: RuleSet = {
            productTypeId,
            context,
            rules: [getRule(1, true)],
          };
          const expectedDigest = { ...digest, whitelist: ['I-5'] };
          DigestHelper.updateDigestForRuleSet(digest, ruleSet);
          expect(digest).to.deep.equal(expectedDigest);
        });
        it('should update customer BL if no WL and BL', () => {
          const digest = initialDigest();
          const ruleSet: RuleSet = {
            productTypeId,
            context,
            rules: [getRule(1, false)],
          };
          const expectedDigest = { ...digest, blacklist: ['I-5'] };
          DigestHelper.updateDigestForRuleSet(digest, ruleSet);
          expect(digest).to.deep.equal(expectedDigest);
        });
        it('should not make any WL/BL updates if no rules match', () => {
          const digest = initialDigest();
          const ruleSet: RuleSet = {
            productTypeId,
            context,
            rules: [getRule(7, false)],
          };
          const expectedDigest = { ...digest };
          DigestHelper.updateDigestForRuleSet(digest, ruleSet);
          expect(digest).to.deep.equal(expectedDigest);
        });
      });
      describe('Global Context', () => {
        const context = {
          customerId: null,
          siteId: null,
          isGlobal: true,
          productId: null,
        };
        it('should update BL if no WL and BL', () => {
          const digest = initialDigest();
          const ruleSet: RuleSet = {
            productTypeId,
            context,
            rules: [getRule(1, false)],
          };
          const expectedDigest = {
            ...digest,
            availableGlobally: false,
            blacklist: ['GLOBAL'],
          };
          DigestHelper.updateDigestForRuleSet(digest, ruleSet);
          expect(digest).to.deep.equal(expectedDigest);
        });
        it('should update WL if WL and BL', () => {
          const digest = initialDigest();
          const ruleSet: RuleSet = {
            productTypeId,
            context,
            rules: [getRule(1, false), getRule(2, true)],
          };
          const expectedDigest = {
            ...digest,
            availableGlobally: true,
            whitelist: ['GLOBAL'],
          };
          DigestHelper.updateDigestForRuleSet(digest, ruleSet);
          expect(digest).to.deep.equal(expectedDigest);
        });
        it('should set availableGlobally true if no rules', () => {
          const digest = initialDigest();
          const ruleSet: RuleSet = {
            productTypeId,
            context,
            rules: [getRule(7, false), getRule(9, true)],
          };
          const expectedDigest = { ...digest, availableGlobally: true };
          DigestHelper.updateDigestForRuleSet(digest, ruleSet);
          expect(digest).to.deep.equal(expectedDigest);
        });
      });
    });
    describe('Pricing', () => {
      const purchaseType = 'subscription';
      // default pricing rules to enabled:true, there is a test to verify disabled is ignored
      const getRule = (
        ruleId: number,
        price: number,
        purchaseTypeId: string,
        enabled: boolean = true,
      ) => {
        return ModelFactory.productPriceRule(
          {
            ruleId,
            enabled,
          },
          purchaseTypeId,
          price,
        );
      };
      it('should ignore disabled rules', () => {
        const digest = initialDigest();
        const ruleSet: RuleSet = {
          productTypeId,
          context: {
            isGlobal: false,
            customerId: 'cid',
            siteId: null,
            productId: null,
          },
          rules: [
            getRule(1, 10, purchaseType, false),
            getRule(2, 100, purchaseType, false),
            getRule(3, 1, purchaseType, false),
          ],
        };
        DigestHelper.updateDigestForRuleSet(digest, ruleSet);
        expect(digest).to.deep.equal(initialDigest());
      });
      it('should override the pricing for a rule', () => {
        const digest = initialDigest();
        const ruleSet: RuleSet = {
          productTypeId,
          context: {
            isGlobal: true,
            customerId: null,
            siteId: null,
            productId: null,
          },
          rules: [getRule(1, 10, purchaseType)],
        };
        const expectedPriceOverride: PriceOverride = {
          ...ruleSet.context,
          effectivePrice: 10,
          purchaseType,
        };
        DigestHelper.updateDigestForRuleSet(digest, ruleSet);
        expect(digest.priceOverrides[0]).to.deep.equal(expectedPriceOverride);
      });
      it('should pick the highest priced rule in the ruleSet', () => {
        const digest = initialDigest();
        const ruleSet: RuleSet = {
          productTypeId,
          context: {
            isGlobal: true,
            customerId: null,
            siteId: null,
            productId: null,
          },
          rules: [getRule(1, 10, purchaseType), getRule(1, 100, purchaseType)],
        };
        const expectedPriceOverride: PriceOverride = {
          ...ruleSet.context,
          effectivePrice: 100,
          purchaseType,
        };
        DigestHelper.updateDigestForRuleSet(digest, ruleSet);
        expect(digest.priceOverrides[0]).to.deep.equal(expectedPriceOverride);
      });
    });
    describe('WebViews', () => {
      const url = 'https://soda.com';
      // default webView rules to enabled:true, there is a test to verify disabled is ignored
      const getRule = (
        ruleId: number,
        productId: number,
        customerId: string,
        displayPriority: number,
        url: string,
        enabled: boolean = true,
      ) => {
        return ModelFactory.productWebViewRule({
          ruleId,
          enabled,
          productId,
          customerId,
          action: {
            meta: {
              effectiveUrl: url,
              effectiveDisplayPriority: displayPriority,
            },
          },
        });
      };
      it('should ignore disabled rules', () => {
        const digest = initialDigest();
        const ruleSet: RuleSet = {
          productTypeId,
          context: {
            isGlobal: false,
            customerId: 'cid',
            siteId: null,
            productId: 5,
          },
          rules: [
            getRule(1, 5, 'cid', 1, url, false),
            getRule(2, 5, 'cid', 1, url, false),
            getRule(3, 5, 'cid', 2, url, false),
          ],
        };
        DigestHelper.updateDigestForRuleSet(digest, ruleSet);
        expect(digest).to.deep.equal(initialDigest());
      });
      it('should override the url and displayPriority for a rule', () => {
        const digest = initialDigest();
        const ruleSet: RuleSet = {
          productTypeId,
          context: {
            isGlobal: false,
            customerId: '1',
            siteId: null,
            productId: 5,
          },
          rules: [getRule(1, 5, '1', 2, 'https://soda.com/cocacola/vanilla')],
        };
        const expectedWebViewOverride: WebViewOverride = {
          ...ruleSet.context,
          effectiveUrl: 'https://soda.com/cocacola/vanilla',
          effectiveDisplayPriority: 2,
        };
        DigestHelper.updateDigestForRuleSet(digest, ruleSet);
        expect(digest.webViewOverrides[0]).to.deep.equal(
          expectedWebViewOverride,
        );
      });
    });
  });
});

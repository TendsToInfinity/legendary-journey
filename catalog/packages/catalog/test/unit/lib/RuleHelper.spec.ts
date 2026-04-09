import { _ } from '@securustablets/libraries.utils';
import { expect } from 'chai';
import {
  ProductPriceRule,
  RuleType,
} from '../../../src/controllers/models/Rule';
import { RuleHelper } from '../../../src/lib/RuleHelper';
import { ModelFactory } from '../../utils/ModelFactory';

describe('RuleHelper - Unit', () => {
  describe('getRuleContext', () => {
    const customerId = 'customerId';
    const siteId = 'siteId';
    const productId = 1;
    it('should return global false for siteId and copies all other context fields', () => {
      const rule = ModelFactory.rule({ customerId, siteId, productId });
      const context = RuleHelper.getRuleContext(rule);
      expect(context).to.deep.equal({
        customerId,
        siteId,
        productId,
        isGlobal: false,
      });
    });
    it('should return global false for customerId and copies all other context fields', () => {
      const rule = ModelFactory.rule({
        customerId: 'customerId',
        productId: 1,
      });
      const context = RuleHelper.getRuleContext(rule);
      expect(context).to.deep.equal({
        customerId,
        siteId: null,
        productId,
        isGlobal: false,
      });
    });
    it('should return global true if no customer, site, or product id and copies all other context fields', () => {
      const rule = ModelFactory.rule({ productId: 1 });
      const context = RuleHelper.getRuleContext(rule);
      expect(context).to.deep.equal({
        customerId: null,
        siteId: null,
        productId,
        isGlobal: false,
      });
    });
  });
  describe('ruleMatchesProduct', () => {
    const productTypeId = 'productTypeId';
    it('should return false if the productTypeIds of the rule and product do not match', () => {
      const product = ModelFactory.product({ productTypeId });
      const rule = ModelFactory.rule({ productTypeId: 'car' });
      expect(RuleHelper.ruleMatchesProduct(rule, product)).to.equal(false);
    });
    it('should match a product array field for a single clause', () => {
      const product = ModelFactory.product({
        productTypeId,
        meta: { genres: ['a', 'b', 'c'] },
      });
      const rule = ModelFactory.rule({
        productTypeId,
        clauses: { 'meta.genres': ['b'] },
      });
      // manually expand the clauses
      rule.clauses = [{ meta: { genres: ['b'] } }];
      expect(RuleHelper.ruleMatchesProduct(rule, product)).to.equal(true);
    });
    it('should match a product scalar field for a single clause', () => {
      const product = ModelFactory.product({
        productTypeId,
        meta: { name: 'elvis' },
      });
      const rule = ModelFactory.rule({
        productTypeId,
        clauses: { 'meta.name': ['elvis'] },
      });
      // manually expand the clauses
      rule.clauses = [{ meta: { name: 'elvis' } }];
      expect(RuleHelper.ruleMatchesProduct(rule, product)).to.equal(true);
    });
    it('should match a product across two clauses', () => {
      const product = ModelFactory.product({
        productTypeId,
        meta: { name: 'elvis', genres: ['a', 'b', 'c'] },
      });
      const rule = ModelFactory.rule({
        productTypeId,
        clauses: { 'meta.name': ['elvis'], 'meta.genres': ['c'] },
      });
      // manually expand the clauses
      rule.clauses = [{ meta: { name: 'elvis', genres: ['c'] } }];
      expect(RuleHelper.ruleMatchesProduct(rule, product)).to.equal(true);
    });
    it('should not match a product if one of the clauses does not match', () => {
      const product = ModelFactory.product({
        productTypeId,
        meta: { name: 'elvis', genres: ['a', 'b', 'c'] },
      });
      const rule = ModelFactory.rule({
        productTypeId,
        clauses: { 'meta.name': ['elvis'], 'meta.genres': ['d'] },
      });
      // manually expand the clauses
      rule.clauses = [{ meta: { name: 'elvis', genres: ['d'] } }];
      expect(RuleHelper.ruleMatchesProduct(rule, product)).to.equal(false);
    });
    it('should match an allProducts {} rule', () => {
      const product = ModelFactory.product({
        productTypeId,
        meta: { name: 'elvis', genres: ['a', 'b', 'c'] },
      });
      const rule = ModelFactory.rule({ productTypeId, clauses: {} });
      // manually expand the clauses
      rule.clauses = [];
      expect(RuleHelper.ruleMatchesProduct(rule, product)).to.equal(true);
    });
    it('should not match a webView product if productIds dont match', () => {
      const product = ModelFactory.WebViewProduct({
        productTypeId,
        meta: { name: 'Solitaire Free Pack' },
      });
      const rule = ModelFactory.rule({
        type: RuleType.ProductWebView,
        productTypeId,
        productId: 5,
      });
      expect(RuleHelper.ruleMatchesProduct(rule, product)).to.equal(false);
    });
    xit('should match deep arrays', () => {
      const product = ModelFactory.product({
        productTypeId,
        meta: { name: 'elvis', artists: [{ name: 'Sanborn, David' }] },
      });
      const rule = ModelFactory.rule({
        productTypeId,
        clauses: { 'meta.artists.name': ['Sanborn, David'] },
      });
      // manually expand the clauses
      rule.clauses = [{ meta: { artists: [{ name: 'Sanborn, David' }] } }];
      expect(RuleHelper.ruleMatchesProduct(rule, product)).to.equal(true);
    });
  });
  describe('rulesEqual', () => {
    it('should check all fields for equality', () => {
      const rule = ModelFactory.rule({
        clauses: { 'meta.name': ['elvis'] },
        action: { available: false },
        productTypeId: 'car',
      });
      expect(RuleHelper.rulesEqual(rule, _.omit(rule, 'clauses'))).to.equal(
        false,
      );
      expect(RuleHelper.rulesEqual(rule, _.omit(rule, 'action'))).to.equal(
        false,
      );
      expect(
        RuleHelper.rulesEqual(rule, _.omit(rule, 'productTypeId')),
      ).to.equal(false);
      expect(RuleHelper.rulesEqual(rule, rule)).to.equal(true);
    });
  });
  describe('getPurchaseType', () => {
    it('should return a purchaseType for a productPriceRule', () => {
      const rule = ModelFactory.productPriceRule();
      expect(RuleHelper.getPurchaseType(rule)).to.equal('rental');
    });
    it('should cleanly handle a non productPriceRule', () => {
      const rule = ModelFactory.rule();
      expect(RuleHelper.getPurchaseType(rule as ProductPriceRule)).to.equal(
        undefined,
      );
    });
  });
  describe('getRulePrice', () => {
    it('should return a rule price on a productPriceRule', () => {
      const rule = ModelFactory.productPriceRule();
      expect(RuleHelper.getRulePrice(rule)).to.equal(
        rule.action.meta.effectivePrice.rental,
      );
    });
  });
  describe('getRuleUrl', () => {
    it('should return a rule url on a productWebViewRule', () => {
      const rule = ModelFactory.productWebViewRule({
        action: {
          meta: {
            effectiveUrl: 'https://elements.com/water',
            effectiveDisplayPriority: 8,
          },
        },
      });
      expect(RuleHelper.getRuleUrl(rule)).to.equal(
        rule.action.meta.effectiveUrl,
      );
    });
  });
  describe('getRuleDisplayPriority', () => {
    it('should return a rule displayPriority on a productWebViewRule', () => {
      const rule = ModelFactory.productWebViewRule({
        action: {
          meta: {
            effectiveUrl: 'https://elements.com/earth',
            effectiveDisplayPriority: 8,
          },
        },
      });
      expect(RuleHelper.getRuleDisplayPriority(rule)).to.equal(
        rule.action.meta.effectiveDisplayPriority,
      );
    });
  });
});

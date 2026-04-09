import { _ } from '@securustablets/libraries.utils';
import * as moment from 'moment';
import { Product, ProductStatus } from '../controllers/models/Product';
import {
  ProductPriceRule,
  ProductWebViewRule,
  Rule,
  RuleSet,
  RuleType,
} from '../controllers/models/Rule';
import { Context } from '../controllers/models/Search';
import { Digest } from '../models/Digest';
import { RuleHelper } from './RuleHelper';

export class DigestHelper {
  public static readonly GLOBAL_CONTEXT = 'GLOBAL';
  /**
   * Run-time method for testing availability against rules that have already been digested
   * Given a context and a product Digest, determines if the product is available
   * Example contexts:
   *      User Search: {enforce: true, customerId: 'X', siteId: 'Y'}
   *      User Subscription Search: {enforce: true, customerId: 'X', siteId: 'Y', productId: '123'}
   *      Admin Searches:
   *          - {enforce: false/true, productId: '123'}
   *          - {enforce: false/true}
   *          - {enforce: false/true, customerId: 'X'}
   *          - {enforce: false/true, customerId: 'X', siteId: 'Y'}
   * @param product
   * @param context
   * @param digest
   */
  public static isProductAvailableForContext(
    product: Product,
    context: Context,
    digest: Digest,
  ): boolean {
    if (product.status !== ProductStatus.Active) {
      return false;
    }
    if (product.isBlocked) {
      return false;
    }
    if (
      product.meta.startDate &&
      moment(product.meta.startDate).isAfter(moment.now())
    ) {
      return false;
    }
    if (
      product.meta.endDate &&
      moment(product.meta.endDate).isBefore(moment.now())
    ) {
      return false;
    }
    // Subscription context, only return available if the productId exists
    if (
      context.productId &&
      !digest.subscriptionProductIds.includes(_.toNumber(context.productId))
    ) {
      return false;
    }

    if (
      digest.whitelist.some((i) =>
        [
          context.siteId,
          context.customerId,
          DigestHelper.GLOBAL_CONTEXT,
        ].includes(i),
      )
    ) {
      return true;
    }
    if (
      digest.blacklist.some((i) =>
        [
          context.siteId,
          context.customerId,
          DigestHelper.GLOBAL_CONTEXT,
        ].includes(i),
      )
    ) {
      return false;
    }
    return digest.availableGlobally;
  }

  /**
   * Groups rules by context and returns a ruleset for each distinct context
   * @param rules
   */
  public static groupRulesByContext(rules: Rule[]): RuleSet[] {
    const ruleSets: RuleSet[] = [];
    rules.forEach((rule) => {
      const context = RuleHelper.getRuleContext(rule);
      const exists = ruleSets.find((ruleSet) =>
        _.isEqual(ruleSet.context, context),
      );
      if (exists) {
        exists.rules.push(rule);
      } else {
        // initialize the context
        ruleSets.push({
          productTypeId: rule.productTypeId,
          rules: [rule],
          context,
        });
      }
    });
    return ruleSets;
  }

  public static initializeDigest(rules: Rule[], product: Product): Digest {
    return {
      productId: product.productId,
      ruleIds: _.filter(rules, (rule: Rule) =>
        RuleHelper.ruleMatchesProduct(rule, product),
      ).map((i) => i.ruleId),
      availableGlobally: true,
      whitelist: [],
      blacklist: [],
      subscriptionProductIds: [],
      priceOverrides: [],
      webViewOverrides: [],
      sales: { totalSales: null },
    };
  }

  /**
   * Updates Digest by reference according to the ruleSetByContext
   *   - For each Product matchingRuleId with enabled: true
   *   - Availability Rules
   *      - Count # of Whitelist and Blacklist rule matches
   *      - Availability is one of: [whitelisted, blacklisted, noRuleMatches]
   *      - If whitelisted or blacklisted, update the appropriate context level arrays on digest
   *      - if noRuleMatches and ruleSet.context.isGlobal then set isGlobal to true;
   *      - subscriptionProduct rules are backwards from normal rules
   *          - products are by default not available
   *          - products must be whitelisted to be available
   *          - if a blacklist exists for the product it overrides the whitelist
   *   - Pricing Rules
   *      - Find all matching price rules from the ruleSet
   *      - Choose the highest priced rule
   *   - WebView Rules
   *      - Find all matching webView rules from the ruleSet
   * @param digest
   * @param ruleSet
   */
  public static updateDigestForRuleSet(digest: Digest, ruleSet: RuleSet) {
    /**
     * Filter rule set rules by digest matched ruleIds
     *   e.g. digest.ruleIds = [1, 2, 3]. ruleSet.rules.map('ruleId') = [2, 5, 7], ruleSetRules = [2]
     */
    const ruleSetRules = _.filter(ruleSet.rules, (rule: Rule) =>
      digest.ruleIds.includes(rule.ruleId),
    );
    /**
     * Count matching enabled whitelist and blacklist rules ignoring disabled rules
     */
    const availabilityRules = ruleSetRules.filter((r) =>
      [
        RuleType.ProductAvailability,
        RuleType.ProductSubscriptionAvailability,
      ].includes(r.type),
    );
    const whitelistMatches = availabilityRules.filter(
      (r: Rule) => r.action.available === true && r.enabled,
    ).length;
    const blacklistMatches = availabilityRules.filter(
      (r: Rule) => r.action.available === false && r.enabled,
    ).length;

    /**
     * Find pricing override rule
     * Choose the highest price between price rules at the same context
     * Customer: 5.00, Customer: 7.00, base: 10 = 7.00
     */
    const priceRules = ruleSetRules.filter(
      (r) => r.type === RuleType.ProductPrice && r.enabled,
    ) as ProductPriceRule[];
    if (!_.isEmpty(priceRules)) {
      const priceRule = _.orderBy(
        priceRules,
        (pr) => RuleHelper.getRulePrice(pr),
        'desc',
      )[0];
      digest.priceOverrides[0] = {
        ...RuleHelper.getRuleContext(priceRule),
        purchaseType: RuleHelper.getPurchaseType(priceRule),
        effectivePrice: RuleHelper.getRulePrice(priceRule),
      };
    }

    /**
     * Find webView url and displayPriority override rule
     * Choose the url and the displayPriority at the same context
     */
    const webViewRules = ruleSetRules.filter(
      (r) => r.type === RuleType.ProductWebView && r.enabled,
    ) as ProductWebViewRule[];
    if (!_.isEmpty(webViewRules)) {
      for (let i = 0; i < webViewRules.length; i++) {
        digest.webViewOverrides[i] = {
          ...RuleHelper.getRuleContext(webViewRules[i]),
          effectiveUrl: RuleHelper.getRuleUrl(webViewRules[i]),
          effectiveDisplayPriority: RuleHelper.getRuleDisplayPriority(
            webViewRules[i],
          ),
        };
      }
    }

    /**
     * Figure out what context needs to be updated
     */
    const context = ruleSet.context;
    // Product Context
    if (context.productId) {
      if (whitelistMatches > 0 && blacklistMatches === 0) {
        digest.subscriptionProductIds.push(context.productId);
      }
    } else {
      // Other Contexts
      const contextId =
        context.siteId ?? context.customerId ?? DigestHelper.GLOBAL_CONTEXT;
      if (whitelistMatches > 0) {
        digest.whitelist.push(contextId);
      } else if (blacklistMatches > 0) {
        digest.blacklist.push(contextId);
      }
    }
    /**
     * GlobalAvailability is determined as:
     *    true: at least one whitelist rule applies or no rules apply
     *    false: no whitelist rule applies and at least one blacklist rule applies
     */
    if (context.isGlobal) {
      digest.availableGlobally = blacklistMatches === 0 || whitelistMatches > 0;
    }
    /**
     * Clean lists as duplicates can happen if contexts are layered
     */
    digest.whitelist = _.uniq(digest.whitelist);
    digest.blacklist = _.uniq(digest.blacklist);
    digest.subscriptionProductIds = _.uniq(digest.subscriptionProductIds);
  }
}

import { _ } from '@securustablets/libraries.utils';
import { Product } from '../controllers/models/Product';
import {
  ProductPriceRule,
  ProductWebViewRule,
  Rule,
  RuleContext,
  RuleType,
} from '../controllers/models/Rule';

export class RuleHelper {
  /**
   * Marshal context fields into a single context object with isGlobal calculated
   * Explicitly set null to ensure contexts don't cross (e.g. site rules get picked up if searching by customer)
   * Null is what the database will return for these fields on the Rule lookup
   * Note: .trim() is required because some joker made the DB fields char(x) so they come back padded...
   * @param rule
   * @public
   */
  public static getRuleContext(rule: Rule): RuleContext {
    const customerId = rule.customerId?.trim();
    const siteId = rule.siteId?.trim();
    return {
      customerId: customerId || null,
      siteId: siteId || null,
      productId: rule.productId || null,
      isGlobal: !customerId && !siteId && !rule.productId,
    };
  }

  /**
   * Evaluate a Product for matching a Rule's clauses
   * Within a rule, all clauses must match the Product
   * Within a clause, at least one of the values must match the Product
   * @param rule
   * @param product
   */
  public static ruleMatchesProduct(rule: Rule, product: Product): boolean {
    if (rule.productTypeId !== product.productTypeId) {
      return false;
    }

    // we will not have clauses for web view rules; so match products by id
    if (
      rule.type === RuleType.ProductWebView &&
      rule.productId !== product.productId
    ) {
      return false;
    }

    // empty clauses means all products
    if (_.isEmpty(rule.clauses)) {
      return true;
    }
    return _.some(rule.clauses, (match) => _.isMatch(product, match));
  }

  /**
   * Determines if two rules are equal based on clauses, action, and productTypeId
   * @param rule1 Rule can be partial
   * @param rule2 Rule can be partial
   */
  public static rulesEqual(
    rule1: Partial<Rule>,
    rule2: Partial<Rule>,
  ): boolean {
    return (
      _.isEqual(rule1.clauses, rule2.clauses) &&
      _.isEqual(rule1.action, rule2.action) &&
      _.isEqual(rule1.productTypeId, rule2.productTypeId)
    );
  }

  public static getPurchaseType(rule: ProductPriceRule): string {
    return _.keys(_.get(rule, 'action.meta.effectivePrice', {}))[0];
  }

  public static getRulePrice(rule: ProductPriceRule): number {
    const purchaseType = RuleHelper.getPurchaseType(rule);
    return _.get(rule, `action.meta.effectivePrice.${purchaseType}`);
  }

  public static getRuleUrl(rule: ProductWebViewRule): string {
    return _.get(rule, 'action.meta.effectiveUrl');
  }

  public static getRuleDisplayPriority(rule: ProductWebViewRule): number {
    return _.get(rule, 'action.meta.effectiveDisplayPriority');
  }
}

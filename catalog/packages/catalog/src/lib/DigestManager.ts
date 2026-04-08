import { Csi, MethodCache } from '@securustablets/libraries.cache';
import { Logger } from '@securustablets/libraries.logging';
import { _ } from '@securustablets/libraries.utils';
import * as Bluebird from 'bluebird';
import { Exception } from 'securus.tablets.libraries.exceptions';
import { Container, Inject } from 'typescript-ioc';
import { Product } from '../controllers/models/Product';
import { Rule, RuleType } from '../controllers/models/Rule';
import { Context } from '../controllers/models/Search';
import { RuleDao } from '../data/PGCatalog/RuleDao';
import { Digest, PriceOverride, WebViewOverride } from '../models/Digest';
import { AppConfig } from '../utils/AppConfig';
import { DigestHelper } from './DigestHelper';

export class DigestManager {
  @Inject
  private ruleDao!: RuleDao;

  @Inject
  private logger!: Logger;

  /**
   * Return all digestible rules; ProductAvailability and ProductSubscriptionAvailability
   * Ignores enabled flag in order to fully match a product against all available rules
   * TODO: This method does not yet return pricing rules as it's only use is to digest rules into OpenSearch
   *          and the digest doesn't currently have a structure to store price rules long term
   * NOTE: This method makes an uncached call to retrieve rules
   * @param productTypeId
   */
  public async getDigestRulesByProductTypeId(
    productTypeId: string,
  ): Promise<Rule[]> {
    const rules = await this.ruleDao.find({
      by: {
        productTypeId,
      },
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
    });
    return this.convertRulesToMatches(rules);
  }

  /**
   * Returns all digestible rules (including PriceRules) for a given Context
   * To be used with a single context during live lookup
   * @param context
   */
  @MethodCache(Csi.Tier1, {
    secondsToLive: Container.get(AppConfig).cache.ttlShort,
  })
  public async getDigestRulesByContext(context: Context): Promise<Rule[]> {
    return this.ruleDao.findByContextWithJsonClauses(context, undefined, [
      RuleType.ProductAvailability,
      RuleType.ProductSubscriptionAvailability,
      RuleType.ProductPrice,
    ]);
  }

  /**
   * Returns rules for the type specified by context
   * Specialized method to only return rules for required types instead of full digest
   * Rules will include json styled clauses
   * @param context
   * @param ruleTypes The rule types to be returned
   * @param productTypeIds The productTypes for the rules to return
   * NOTE: This method gets cached rule data
   */
  @MethodCache(Csi.Tier1, {
    secondsToLive: Container.get(AppConfig).cache.ttlShort,
  })
  public async getRulesByProductType(
    context: Context,
    productTypeIds: string[],
    ruleTypes: RuleType[],
  ): Promise<Rule[]> {
    return this.ruleDao.findByContextWithJsonClauses(
      context,
      productTypeIds,
      ruleTypes,
    );
  }

  private async convertRulesToMatches(rules: Rule[]): Promise<Rule[]> {
    return Bluebird.map(rules, async (rule) => {
      return _.mapKeys(await this.ruleDao.convertTo(rule), (value, key) =>
        _.camelCase(key),
      ) as Rule;
    });
  }

  /**
   * Process digests for a group of products for a specific context.
   * All products in the array must have the same productTypeId
   * @param products
   * @param context
   */
  public async digestProductsForContext(
    products: Product[],
    context: Context,
  ): Promise<Digest[]> {
    const productTypeIds = _.uniq(_.map(products, 'productTypeId'));
    if (productTypeIds.length > 1) {
      const message = `All products must have the same productTypeId. Found: ${JSON.stringify(productTypeIds)}`;
      this.logger.error(message);
      throw Exception.InvalidData(message);
    }
    // find un-cached rules as we need to be up-to-date
    const rules: Rule[] = await this.getDigestRulesByContext(context);

    return products.map((product) => this.getProductDigest(rules, product));
  }

  /**
   * Process digests for a group of products across all contexts.
   * All products in the array must have the same productTypeId
   * @param products
   */
  public async digestProducts(products: Product[]): Promise<Digest[]> {
    const productTypeIds = _.uniq(_.map(products, 'productTypeId'));
    if (productTypeIds.length > 1) {
      const message = `All products must have the same productTypeId. Found: ${JSON.stringify(productTypeIds)}`;
      this.logger.error(message);
      throw Exception.InvalidData(message);
    }
    // find un-cached rules as we need to be up-to-date
    const rules: Rule[] = await this.getDigestRulesByProductTypeId(
      productTypeIds[0],
    );

    return products.map((product) => this.getProductDigest(rules, product));
  }

  /**
   * Run-time method for getting correct product price given context and digest
   * @param context
   * @param digest
   */
  public getEffectivePrice(
    context: Context,
    digest: Digest,
  ): { [purchaseType: string]: number } {
    const priceOverrides = _.filter(
      digest.priceOverrides,
      (priceOverride: PriceOverride) => {
        if (
          !_.isNull(context.siteId) &&
          priceOverride.siteId === context.siteId
        ) {
          return true;
        }
        if (
          !_.isNull(context.customerId) &&
          priceOverride.customerId === context.customerId
        ) {
          return true;
        }
        if (priceOverride.isGlobal) {
          return true;
        }
      },
    );
    if (!_.isEmpty(priceOverrides)) {
      const highestPriceOverride = _.orderBy(
        priceOverrides,
        'effectivePrice',
        'desc',
      )[0];
      return {
        [highestPriceOverride.purchaseType]:
          highestPriceOverride.effectivePrice,
      };
    }
  }

  /**
   * Run-time method for getting correct webView url and displayPriority given context
   * @param context
   * @param digest
   */
  public getEffectiveUrlAndDisplayPriority(
    context: Context,
    digest: Digest,
  ): { url: string; displayPriority: number } {
    const webViewOverrides = _.filter(
      digest.webViewOverrides,
      (webViewOverride: WebViewOverride) => {
        if (
          !_.isNil(context.siteId) &&
          webViewOverride.siteId === context.siteId
        ) {
          webViewOverride.contextSortOrder = 1;
          return true;
        }
        if (
          !_.isNil(context.customerId) &&
          webViewOverride.customerId === context.customerId
        ) {
          webViewOverride.contextSortOrder = 2;
          return true;
        }
        // if the rule matches just the productId
        {
          webViewOverride.contextSortOrder = 3;
          return true;
        }
      },
    );

    if (!_.isEmpty(webViewOverrides)) {
      // most specific context rule takes precedence
      const webViewOverride = _.orderBy(
        webViewOverrides,
        'contextSortOrder',
        'asc',
      )[0];
      return {
        url: webViewOverride.effectiveUrl,
        displayPriority: webViewOverride.effectiveDisplayPriority,
      };
    }
  }

  /**
   * Given a group of rules and a product
   * 1. Identify Rules that match the product
   * 2. Group rules by context RuleSets
   * 3. Evaluate product black/white/global/product availability for the RuleSet
   * @param rules
   * @param product
   */
  public getProductDigest(rules: Rule[], product: Product): Digest {
    // Group all rules by contexts (unique sets of global/customer/site/product)
    const ruleSets = DigestHelper.groupRulesByContext(rules);

    // Initialize the digest with the productId and set of matching ruleIds
    const digest: Digest = DigestHelper.initializeDigest(rules, product);

    // given product's matching rule ids, find all ruleSets that contain any
    const matchedRuleSets = ruleSets.filter((ruleSet) =>
      _.some(ruleSet.rules, (r) => digest.ruleIds.includes(r.ruleId)),
    );

    matchedRuleSets.forEach((matchedRuleSet) => {
      DigestHelper.updateDigestForRuleSet(digest, matchedRuleSet);
    });

    return digest;
  }
}

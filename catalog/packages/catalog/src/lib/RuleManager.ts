import { SvSecurityContext } from '@securustablets/libraries.httpsecurity';
import { Inject } from 'typescript-ioc';
import { Product } from '../controllers/models/Product';
import { Rule, RuleType } from '../controllers/models/Rule';
import { RuleDao } from '../data/PGCatalog/RuleDao';
import { OpenSearchManager } from './OpenSearchManager';
import { ProductDecoratorManager } from './ProductDecoratorManager';
import { RuleValidator } from './RuleValidator';
import { DigestDecorator } from './decorators/product/DigestDecorator';
import { ProductPublishManager } from './product/ProductPublishManager';

export class RuleManager {
  @Inject
  private decorator!: ProductDecoratorManager;

  @Inject
  private digestDecorator!: DigestDecorator;

  @Inject
  private openSearchManager!: OpenSearchManager;

  @Inject
  private productPublishManager!: ProductPublishManager;

  @Inject
  private ruleDao!: RuleDao;

  @Inject
  private ruleValidator!: RuleValidator;

  public findByQueryString = this.ruleDao.findByQueryString;
  public find = this.ruleDao.find;
  public findOneOrFail = this.ruleDao.findOneOrFail;
  public exists = this.ruleDao.exists;

  public async createRule(
    rule: Rule,
    securityContext: SvSecurityContext,
  ): Promise<number> {
    rule.ruleId = await this.ruleDao.create(
      await this.ruleValidator.validate(rule),
      securityContext,
    );

    await this.digestRule(rule);

    return rule.ruleId;
  }

  public async updateRule(
    rule: Rule,
    securityContext: SvSecurityContext,
  ): Promise<void> {
    await this.ruleDao.update(
      rule.ruleId,
      await this.ruleValidator.validate(rule),
      securityContext,
    );

    await this.digestRule(rule);
  }

  public async deleteRule(
    ruleId: number,
    securityContext: SvSecurityContext,
  ): Promise<void> {
    const rule = await this.ruleDao.findOneOrFail(ruleId);

    await this.ruleDao.delete(rule.ruleId, securityContext);

    await this.digestRule(rule);
  }

  public async digestRule(rule: Rule): Promise<void> {
    // Don't digest rules that can't be digested ie: ProductTypeRule, also don't digest music rules
    if (!this.isDigestableRule(rule) || this.isMusicRule(rule)) {
      return;
    }

    let moreProducts = true;
    const products = [];
    let scrollId = null;
    while (moreProducts) {
      let batchProducts: Product[] = [];
      ({ data: batchProducts, scrollId } =
        await this.openSearchManager.getProductsByRules(
          rule.productTypeId,
          [rule],
          scrollId,
        ));
      if (!batchProducts || batchProducts.length === 0) {
        moreProducts = false;
      } else {
        products.push(...batchProducts);
      }
    }

    if (products.length === 0) {
      return;
    }
    const digestedProducts =
      await this.openSearchManager.digestProductsIntoOpenSearch(products);

    if (rule.type === RuleType.ProductSubscriptionAvailability) {
      // Hydrate product.subscriptionIds before publishing removal message
      await this.decorator.apply(
        digestedProducts,
        [this.digestDecorator.decorator],
        { enforce: true },
      );

      const removedProducts = this.getRemovedProducts(
        digestedProducts,
        rule.productId,
      );
      await this.productPublishManager.publishRemovalMessage(removedProducts);
    }
  }

  /**
   * Accepts an array of products and a productId. Returns all products
   * where the product's subscriptionIds do not contain the passed productId.
   * @param products Array of products to filter
   * @param ruleProductId ProductId to filter against
   * @public
   */
  public getRemovedProducts(
    products: Product[],
    ruleProductId: number,
  ): Product[] {
    return products.filter(
      (product) =>
        !((product.subscriptionIds ?? []) as number[]).includes(ruleProductId),
    );
  }

  public isMusicRule(rule: Rule): boolean {
    return ['track', 'album', 'artist'].includes(rule.productTypeId);
  }
  public isDigestableRule(rule: Rule): boolean {
    return [
      RuleType.ProductAvailability,
      RuleType.ProductSubscriptionAvailability,
    ].includes(rule.type);
  }
}

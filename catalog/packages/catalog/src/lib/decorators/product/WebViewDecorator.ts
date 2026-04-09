import { _ } from '@securustablets/libraries.utils';
import { Exception } from 'securus.tablets.libraries.exceptions';
import { Inject, Singleton } from 'typescript-ioc';
import { Product } from '../../../controllers/models/Product';
import { RuleType } from '../../../controllers/models/Rule';
import { Context } from '../../../controllers/models/Search';
import { DigestManager } from '../../DigestManager';
import { Decorator } from '../../ProductDecoratorManager';

@Singleton
export class WebViewDecorator {
  @Inject
  private digestManager!: DigestManager;

  // When adding or changing decorator fields also update getDecoratorFields to reflect these new values
  public decorator: Decorator = async (
    products: Product[],
    context: Context,
  ): Promise<void> => {
    await this.decorateEffectiveUrl(products, context);
  };

  private async decorateEffectiveUrl(products, context): Promise<void> {
    const productTypeIds = _.uniq(_.map(products, 'productTypeId'));
    const rules = await this.digestManager.getRulesByProductType(
      context,
      productTypeIds,
      [RuleType.ProductWebView],
    );

    if (!_.isEmpty(rules)) {
      products.map((product) => {
        const digest = this.digestManager.getProductDigest(rules, product);
        // some were found that match the product and context or lack thereof
        if (!_.isEmpty(digest.webViewOverrides)) {
          const { url = undefined, displayPriority = 100 } =
            this.digestManager.getEffectiveUrlAndDisplayPriority(
              context,
              digest,
            ) || {};

          if (_.isUndefined(url) && product.productTypeId === 'webView') {
            throw Exception.NotFound({
              errors: `No webView rule url found matching context for the webView`,
            });
          }

          product.meta.webViewUrl = url;
          product.meta.displayPriority = displayPriority;
        }
      });
    }
  }

  public getDecoratorFields(): string[] {
    return [];
  }
}

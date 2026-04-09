import { Singleton } from 'typescript-ioc';
import { PricedProduct } from '../../../controllers/models/Product';
import { Context } from '../../../controllers/models/Search';
import { Decorator } from '../../ProductDecoratorManager';

@Singleton
export class DigestDecorator {
  // When adding or changing decorator fields also update getDecoratorFields to reflect these new values
  public decorator: Decorator = async (
    products: PricedProduct[],
    context: Context,
  ): Promise<void> => {
    products.forEach((product) => {
      product.subscriptionIds = product.digest.subscriptionProductIds;
      if (context.enforce) {
        // remove digest from products
        delete product.digest;
      }
    });
  };

  public getDecoratorFields(): string[] {
    return ['digest', 'subscriptionIds'];
  }
}

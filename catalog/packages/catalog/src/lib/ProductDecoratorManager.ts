import { Singleton } from 'typescript-ioc';
import { PricedProduct, Product } from '../controllers/models/Product';
import { Context } from '../controllers/models/Search';

export type Decorator = (
  products: Product[] | PricedProduct[],
  context: Context,
) => Promise<void>;

@Singleton
export class ProductDecoratorManager {
  public async apply(
    products: Product[] | PricedProduct[],
    decorators: Decorator[],
    context: Context = {},
  ) {
    for (const decorator of decorators) {
      await decorator(products, context);
    }
  }
}

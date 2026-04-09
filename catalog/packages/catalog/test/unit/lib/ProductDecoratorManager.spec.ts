import { _ } from '@securustablets/libraries.utils';
import { assert } from 'chai';
import { PricedProduct } from '../../../src/controllers/models/Product';
import {
  Decorator,
  ProductDecoratorManager,
} from '../../../src/lib/ProductDecoratorManager';
import { ModelFactory } from '../../utils/ModelFactory';

const productDecoratorManager = new ProductDecoratorManager();

describe('ProductDecoratorManager - Unit', () => {
  it('apply() calls decorators in order', async () => {
    const input: PricedProduct[] = [
      ModelFactory.pricedProduct({ productId: 111 } as any as PricedProduct),
    ];
    const decorators: Decorator[] = [
      async (products: PricedProduct[]): Promise<void> => {
        _.first(products).productId = 222;
      },
      async (products: PricedProduct[]): Promise<void> => {
        _.first(products).productId = 333;
      },
    ];

    await productDecoratorManager.apply(input, decorators);

    assert.equal(_.first(input).productId, 333);
  });
});

import { _ } from '@securustablets/libraries.utils';
import { Singleton } from 'typescript-ioc';
import { Fee } from '../controllers/models/Fee';
import { Product } from '../controllers/models/Product';

@Singleton
export class FeeManager {
  public productMatchesFee(fee: Fee, product: Product) {
    return (
      fee.productTypeId === product.productTypeId &&
      (_.isEmpty(fee.clauses) || this.isMatch(product, fee.clauses))
    );
  }

  private isMatch(product: Product, clauses: Array<Partial<Product>>): boolean {
    return !!_.find(clauses, (clause) => _.isMatch(product, clause));
  }
}

import { Product } from '../../controllers/models/Product';

export interface ProductMessage {
  product: Product;
  [key: string]: any;
}

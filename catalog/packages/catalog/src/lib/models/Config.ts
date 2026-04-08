import { ProductTypeIds } from '../../controllers/models/Product';

export interface Config {
  /**
   * Controls what productTypes are NOT allowed to be utilized (purchase/rental/subscription)
   * @context Customer
   */
  disablePurchaseType: {
    /**
     * Controls what productTypes are NOT allowed for purchase
     * @context Customer
     * @default []
     */
    purchase?: ProductTypeIds[];
    /**
     * Controls what productTypes are NOT allowed for rental
     * @context Customer
     * @default []
     */
    rental?: ProductTypeIds[];
    /**
     * Controls what productTypes are NOT allowed for subscription
     * @context Customer
     * @default []
     */
    subscription?: ProductTypeIds[];
  };
}

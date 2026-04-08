import { IntervalUnit, Product } from './Product';

// Naming the interface without "Schema" for Schema API. Keeping the filename with "Schema" for GenerateSchemaCommand
export interface GameSubscription extends Product {
  productTypeId: 'gameSubscription';
  productTypeGroupId: 'game';
  purchaseCode?: 'GAMESUBSCRIPTION';
  purchaseTypes?: ['subscription'];
  fulfillmentType?: 'digital';
  subscribable?: true;
  /**
   * @keyField true
   */
  isBlocked?: boolean;
  /**
   * @keyField true
   */
  isManuallyBlocked?: boolean;
  meta: {
    /**
     * @keyField true
     */
    name: string;
    thumbnail?: string;
    /**
     * @requiredIfActive true
     */
    description?: string;
    /**
     * @requiredIfActive true
     */
    basePrice?: {
      /**
       * @autoComplete true
       * @distinctValue meta.basePrice.subscription
       * @keyField true
       */
      subscription: number;
    };
    /**
     * @format date
     */
    startDate?: string;
    /**
     * @format date
     */
    endDate?: string;

    billingInterval: {
      /**
       * @default 1
       */
      count: number;
      /**
       * @default "months"
       */
      interval: IntervalUnit;
    };

    multipleSubscription?: boolean;
  };
}

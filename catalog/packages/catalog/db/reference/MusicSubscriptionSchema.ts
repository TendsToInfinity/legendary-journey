import { IntervalUnit, Product } from './Product';

// Naming the interface without "Schema" for Schema API. Keeping the filename with "Schema" for GenerateSchemaCommand
export interface MusicSubscription extends Product {
  productTypeId: 'musicSubscription';
  productTypeGroupId: 'music';
  purchaseCode?: 'MUSICSUBSCRIPTION';
  purchaseTypes?: ['subscription'];
  fulfillmentType?: 'digital';
  subscribable?: true;
  source: {
    vendorProductId: string; // subscription offer SKU from AM's system
    vendorName: string;
    productTypeId: 'musicSubscription';
  };
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
       * @keyField true
       */
      subscription: number;
    };
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
    /**
     * @format date
     */
    startDate?: string;
    /**
     * @format date
     */
    endDate?: string;

    multipleSubscription?: boolean;
  };
}

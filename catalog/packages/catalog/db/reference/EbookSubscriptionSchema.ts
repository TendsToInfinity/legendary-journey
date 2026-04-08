import { IntervalUnit, Product, ProductStatus } from './Product';

// Naming the interface without "Schema" for Schema API. Keeping the filename with "Schema" for GenerateSchemaCommand
export interface EbookSubscription extends Product {
  productTypeId: 'ebookSubscription';
  productTypeGroupId: 'book';
  purchaseCode: 'EBOOKSUBSCRIPTION';
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
  status: ProductStatus;

  source: {
    /**
     * @keyField true
     */
    vendorProductId: string;

    /**
     * @keyField true
     */
    vendorName: string;
    productTypeId: string;
    purchaseTypes: ['subscription'];
  };

  meta: {
    /**
     * @keyField true
     */
    name: string;
    authors?: string[];
    description?: string;
    thumbnail?: string;

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

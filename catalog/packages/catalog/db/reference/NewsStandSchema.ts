import { IntervalUnit, Product } from './Product';

// Naming the interface without "Schema" for Schema API. Keeping the filename with "Schema" for GenerateSchemaCommand
export interface NewsStand extends Product {
  productTypeId: 'newsStand';
  productTypeGroupId: 'newsStand';
  purchaseCode: 'NEWSSTAND';
  purchaseTypes: ['subscription'];
  fulfillmentType: 'digital';
  subscribable?: false;
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
    // Thumbnail may not be currently possible (requires file upload from protoss and possibly base64encoding to PG?)
    // A generic thumbnail solution is required for catalog at some point, but can probably be skipped for this product type
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
    /**
     * @requiredIfActive true
     */
    termsAndConditions: string;

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
  };
}

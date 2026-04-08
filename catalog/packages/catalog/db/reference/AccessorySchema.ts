import { Product } from './Product';

// Naming the interface without "Schema" for Schema API. Keeping the filename with "Schema" for GenerateSchemaCommand
export interface Accessory extends Product {
  productTypeId: 'accessory';
  productTypeGroupId: 'accessory';
  purchaseCode: 'ACCESSORY';
  purchaseTypes: ['purchase'];
  fulfillmentType: 'physical';
  subscribable?: false;
  /**
   * @keyField true
   */
  isBlocked?: boolean;
  /**
   * @keyField true
   */
  isManuallyBlocked?: boolean;
  source: {
    vendorProductId: string;
    vendorName: string;
    productTypeId: string;
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
     * @autoComplete true
     * @distinctValue meta.categories
     */
    categories?: string[];
    /**
     * @requiredIfActive true
     */
    basePrice?: {
      /**
       * @autoComplete true
       * @distinctValue meta.basePrice.purchase
       * @keyField true
       */
      purchase: number;
    };
    /**
     * @requiredIfActive true
     */
    disclaimer?: string;
    /**
     * @requiredIfActive true
     * @keyField true
     */
    sku?: string;
    /**
     * @format date
     */
    startDate?: string;
    /**
     * @format date
     */
    endDate?: string;
  };
}

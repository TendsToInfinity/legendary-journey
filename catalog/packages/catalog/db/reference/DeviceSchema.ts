import { Product } from './Product';

// Naming the interface without "Schema" for Schema API. Keeping the filename with "Schema" for GenerateSchemaCommand
export interface Device extends Product {
  productTypeId: 'device';
  productTypeGroupId: 'device';
  purchaseCode?: 'TABLETDEVICE';
  purchaseTypes?: ['purchase'];
  childProductIds?: number[]; // APKs (SvControl, lockscreen, deskclock
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
  meta: {
    /**
     * @keyField true
     */
    name: string;
    description?: string;
    thumbnail?: string;
    /**
     * @autoComplete true
     * @distinctValue meta.modelNumber
     * @keyField true
     */
    modelNumber: string;
    sku?: string;
    features?: {
      camera?: boolean;
      fmReceiver?: boolean;
    };
    startDate?: string;
    endDate?: string;
    basePrice?: {
      /**
       * @autoComplete true
       * @distinctValue meta.basePrice.purchase
       * @keyField true
       */
      purchase: number;
    };
  };
}

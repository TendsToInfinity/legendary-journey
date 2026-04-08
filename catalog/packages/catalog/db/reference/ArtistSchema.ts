import { Product, ProductStatus } from './Product';

// Naming the interface without "Schema" for Schema API. Keeping the filename with "Schema" for GenerateSchemaCommand
export interface Artist extends Product {
  productTypeId: 'artist';
  productTypeGroupId: 'music';
  status: ProductStatus;
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
    description?: string;
    thumbnail?: string;
  };
}

import { Product, ProductStatus } from './Product';

// Naming the interface without "Schema" for Schema API. Keeping the filename with "Schema" for GenerateSchemaCommand
export interface Ebook extends Product {
  productTypeId: 'ebook';
  productTypeGroupId: 'book';
  purchaseCode: 'EBOOK';
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
    purchaseTypes: ['purchase'];
    url: string;
    languages: string[];
    format: string; // application/epub+zip
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
     * @autoComplete true
     * @requiredIfActive true
     * @keyField true
     * @distinctValue meta.genres
     */
    genres?: string[];
    /**
     * @autoComplete true
     * @distinctValue meta.categories
     * @keyField true
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
     * @format date
     */
    startDate?: string;
    /**
     * @format date
     */
    endDate?: string;
  };
}

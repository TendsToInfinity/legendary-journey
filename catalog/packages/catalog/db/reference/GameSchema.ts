import { Product } from './Product';

// Naming the interface without "Schema" for Schema API. Keeping the filename with "Schema" for GenerateSchemaCommand
export interface Game extends Product {
  // not mentioned in doc
  productTypeId: 'game';
  productTypeGroupId: 'game';
  purchaseCode?: 'GAME';
  purchaseTypes?: ['purchase'];
  fulfillmentType?: 'digital';
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
    /**
     * @keyField true
     */
    vendorProductId: string;
    /**
     * @keyField true
     */
    vendorName: string;
    productTypeId: string;
    submittedBy: string;
    /**
     * @format date
     */
    submittedOn: string;
    /**
     * @keyField true
     */
    msrp?: string;
    version: string;
    url: string;
    md5: string;
    fileSize: number;
    /**
     * @keyField true
     */
    verified: boolean;
    /**
     * @distinctValue meta.genres
     */
    genres?: string[];
  };
  meta: {
    /**
     * @keyField true
     */
    name: string;
    description?: string;
    thumbnail?: string;
    /**
     * @format date
     */
    startDate?: string;
    /**
     * @format date
     */
    endDate?: string;
    // document is singular but this is plural. Plural is correct
    /**
     * @autoComplete true
     * @requiredIfActive true
     * @keyField true
     */
    genres: string[];
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
     * @autoComplete true
     * @keyField true
     */
    rating?: GameRating;
    inAppPurchase: boolean;
    /**
     * @autoComplete true
     * @distinctValue meta.categories
     * @keyField true
     */
    categories?: string[];
    compatibility: string[];
    imageUrls: string[];
    bannerUrl?: string;
  };
  // why don't want fields for devices?
}

export enum GameRating {
  Everyone = 'E',
  E10 = 'E10+',
  Teen = 'T',
  Mature = 'M',
  AdultsOnly = 'AO',
  RatingPending = 'RP',
}

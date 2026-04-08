import { MusicArtist } from './MusicArtist';
import { Product, ProductStatus } from './Product';

// Naming the interface without "Schema" for Schema API. Keeping the filename with "Schema" for GenerateSchemaCommand
export interface Album extends Product {
  productTypeId: 'album';
  productTypeGroupId: 'music';
  purchaseCode: 'MUSIC';
  purchaseTypes: ['purchase'];
  fulfillmentType: 'digital';
  status: ProductStatus;
  subscribable?: false;
  childProductIds?: number[];
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
    vendorName: string;
    /**
     * @keyField true
     */
    vendorProductId: string;
    vendorArtistId: string;
    productTypeId: string;
    ingestionBatchId?: string;
    contentFeedVersion?: string;
    wholesalePrice: string;
    /**
     * @keyField true
     */
    msrp: string;
    upcs?: string[];
    assetCode?: string;
    parentLabelCode?: string;
    /**
     * @keyField true
     */
    parentLabelName?: string;
    albumArtUrl?: string;
    copyright?: string;
    /**
     * @distinctValue meta.genres
     */
    genres?: string[];
    availableForSubscription?: boolean;
    availableForPurchase?: boolean;
  };
  meta: {
    /**
     * @keyField true
     * @requiredIfActive true
     */
    name: string;
    subTitle?: string;
    description?: string;
    thumbnail?: string;
    /**
     * @autoComplete true
     * @requiredIfActive true
     * @keyField true
     */
    genres?: string[];
    /**
     * @autoComplete true
     * @distinctValue meta.categories
     * @keyField true
     */
    categories?: string[];
    /**
     * @keyField true
     */
    length?: number;
    basePrice?: {
      /**
       * @keyField true
       * @autoComplete true
       * @distinctValue meta.basePrice.purchase
       * @requiredIfActive true
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
    /**
     * @keyField true
     */
    releaseDate?: string;
    explicit?: boolean;
    artists: MusicArtist[];

    rendition?: string;
    thumbnailApproved?: string;
    /**
     * @distinctValue meta.releaseYear
     * @autoComplete true
     */
    releaseYear?: number;
  };
}

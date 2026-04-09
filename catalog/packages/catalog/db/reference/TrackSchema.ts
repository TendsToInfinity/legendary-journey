import { MusicArtist } from './MusicArtist';
import { Product, ProductStatus } from './Product';

// Naming the interface without "Schema" for Schema API. Keeping the filename with "Schema" for GenerateSchemaCommand
export interface Track extends Product {
  productTypeId: 'track';
  parentProductId?: number;
  parentProductTypeId?: 'album';
  productTypeGroupId: 'music';
  purchaseCode: 'MUSIC';
  purchaseTypes: ['purchase'];
  status: ProductStatus;
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
    vendorName: string;
    /**
     * @keyField true
     */
    vendorProductId: string;
    vendorArtistId: string;
    productTypeId: string;
    /**
     * @keyField true
     */
    vendorParentProductId?: string;
    ingestionBatchId?: string;
    contentFeedVersion?: string;
    wholesalePrice: string;
    /**
     * @keyField true
     */
    msrp: string;
    upcs?: string[];
    parentLabelCode?: string;
    /**
     * @keyField true
     */
    parentLabelName?: string;
    assetCode?: string;
    assetTypeCode?: string;
    subscriptionAssetCode?: string;
    extension?: string;
    sampleUrl?: string;
    sampleUrl_s3Alias?: string;
    grid?: string;
    isrc?: string;
    /**
     * @distinctValue meta.genres
     */
    genres?: string[];
    availableForSubscription?: boolean;
    availableForPurchase?: boolean;
    diskNumber?: number;
    trackNumber?: number;
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
    albumName?: string;
    /**
     * @distinctValue meta.releaseYear
     * @autoComplete true
     */
    releaseYear?: number;
  };
}

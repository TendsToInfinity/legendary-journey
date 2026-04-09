export enum ProductStatus {
  PendingReview = 'PendingReview',
  Active = 'Active',
  Deleted = 'Deleted',
  Reingest = 'Reingest',
  Inactive = 'Inactive',
}

export interface Product {
  productId?: number;
  productTypeId: string;
  productTypeGroupId: string;
  childProductIds?: number[];
  requiredProductIds?: number[];
  purchaseCode?: string;
  purchaseTypes?: string[];
  fulfillmentType?: string;
  status: ProductStatus;
  subscribable?: boolean;
  isBlocked?: boolean;
  isManuallyBlocked?: boolean;
  source?: {
    vendorProductId: string;
    vendorName: string;
    vendorParentProductId?: string;
    vendorArtistId?: string;
    s3Path?: string;
    productTypeId: string;
  };
  meta: {
    name: string;
    description?: string;
    thumbnail?: string;
    startDate?: string;
    endDate?: string;
    [key: string]: any;
  };
  cdate?: string;
  udate?: string;
}

/**
 * Duplicated from controllers\models\product
 * to fix reference issues
 */
export enum IntervalUnit {
  Days = 'days',
  Weeks = 'weeks',
  Months = 'months',
}

import { Digest } from '../../models/Digest';
import { OrderPurchaseType } from '../../models/Order';

export enum ProductStatus {
  PendingReview = 'PendingReview',
  Active = 'Active',
  Deleted = 'Deleted',
  Reingest = 'Reingest',
  Inactive = 'Inactive',
}

export enum VendorNames {
  AudibleMagic = 'Audible Magic',
  Swank = 'swank', // Lowercase swank to match products source
}

export enum ProductTypeIds {
  Accessory = 'accessory',
  Album = 'album',
  APK = 'apk',
  Artist = 'artist',
  Device = 'device',
  EBook = 'ebook',
  EBookSubscription = 'ebookSubscription',
  Game = 'game',
  GameSubscription = 'gameSubscription',
  Movie = 'movie',
  MusicSubscription = 'musicSubscription',
  NewsStand = 'newsStand',
  TabletPackage = 'tabletPackage',
  Track = 'track',
  TvEpisode = 'tvEpisode',
  TvShow = 'tvShow',
}

export enum Extensions {
  MP3 = 'mp3',
  MP4 = 'mp4',
}

export enum IntervalUnit {
  Days = 'days',
  Weeks = 'weeks',
  Months = 'months',
}

interface ProductSource {
  vendorProductId: string;
  vendorName: string;
  vendorParentProductId?: string;
  vendorArtistId?: string;
  s3Path?: string;
  signedUrl?: string;
  extension?: Extensions;
  productTypeId: string;
  genres?: string[];
  availableForSubscription?: boolean;
  availableForPurchase?: boolean;
  [key: string]: any;
}
export interface Product {
  // in postgres row
  productId: number;
  version?: number;
  cdate: string;
  udate: string;

  // in postgres document
  source: ProductSource;
  productTypeId: string;
  productTypeGroupId: string;
  childProductIds?: number[];
  childProducts?: any[];
  purchaseCode?: string;
  purchaseTypes?: string[];
  fulfillmentType?: string;
  status: ProductStatus;
  meta: {
    name: string;
    description?: string;
    thumbnail?: string;
    thumbnailApproved?: ThumbnailApprovedStatus;
    startDate?: string;
    endDate?: string;
    billingInterval?: {
      count: number;
      interval: IntervalUnit;
    };
    genres?: string[];
    [key: string]: any;
  };
  subscribable?: boolean;
  isBlocked?: boolean;
  isManuallyBlocked?: boolean;
  [key: string]: any;
}

export interface ProductSalesSearch {
  productId: number;
  productTypeGroupId: string;
  productTypeId: string;
  purchaseType: OrderPurchaseType;
  customerId: string;
  year: number;
  month: number;
  day: number;
}

export interface ProductSales extends ProductSalesSearch {
  productSalesId?: number;
  productName: string;
  artistProductId?: number;
  parentProductId?: number;
  completedOrders?: number;
  cdate?: string;
  udate?: string;
  version?: number;
}

export interface PricedProduct extends Product {
  purchaseOptions: PurchaseOption[];
}

export interface DigestProduct extends Product {
  digest: Digest;
}

export interface PurchaseOption {
  type: string;
  totalPrice: number;
  priceDetails: PurchasePriceDetail[];
}

export interface PurchasePriceDetail {
  name: string;
  amount: number;
  type: PriceDetailType;
}

export enum PriceDetailType {
  Fee = 'fee',
  Price = 'price',
}

export enum ThumbnailApprovedStatus {
  Approved = 'approved',
  Pending = 'pending',
  Blocked = 'blocked',
  Escalated = 'escalated',
}

export interface ArtApprovalList {
  vendorProductId: string;
  thumbnailApproved: ThumbnailApprovedStatus;
  genres: string[];
}

export interface ThumbnailApprovalApiBody {
  vendor: string;
  artApproval: ArtApprovalList[];
}

export enum DistinctProductFieldPath {
  Genres = 'meta.genres',
}

import {
  IntervalUnit,
  PurchasePriceDetail,
} from '../../controllers/models/Product';

export interface PurchaseToken {
  customerId: string;
  siteId: string;
  inmateId?: string;
  custodyAccount?: string;
  callPartyId?: string;
  purchaseType: string;
  purchaseCode: string;
  product: PurchaseProduct;
}

export interface PurchaseProduct {
  productId: number;
  price: number;
  name: string;
  description: string;
  thumbnail: string;
  productType: string;
  productTypeGroupId: string;
  priceDetail: PurchasePriceDetail[];
  version: number;
  fulfillmentType?: string;
  billingInterval?: {
    count: number;
    interval: IntervalUnit;
  };
  includedProductIds?: number[];
  multipleSubscription?: boolean;
}

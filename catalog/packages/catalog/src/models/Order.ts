export enum OrderPurchaseType {
  Subscription = 'subscription',
  Purchase = 'purchase',
  Rental = 'rental',
}

export enum OrderState {
  Complete = 'complete', // to cancelled, refunded
  Finished = 'finished', // to nada (eol) ???
}

export interface OrderProduct {
  // This model contains only information relevant to catalog service, more information is included in ordering
  productId: number;
  productType: string;
  productTypeGroupId: string;
  price: number;
  parentProductId?: number;
  name: string;
}

export interface Order {
  orderId?: number;
  parentOrderId?: number;
  state: OrderState;
  isActive: boolean;
  customerId: string;
  siteId: string;
  inmateId?: string;
  custodyAccount?: string;
  callPartyId?: string;
  purchaseType: OrderPurchaseType;
  product: OrderProduct;
  cdate: string;
  udate: string;
}

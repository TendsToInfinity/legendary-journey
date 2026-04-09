export enum FutureState {
  Pending = 'pending',
  Processing = 'processing',
  Cancelled = 'cancelled',
  Complete = 'complete',
  Error = 'error',
}

export interface FutureProductChange {
  futureProductChangeId: number;
  productId?: number;
  productTypeId: string;
  vendorProductId: string;
  actionDate: string;
  vendorName: string;
  state: string;
  error?: string;
  version?: number;
  cdate?: string;
  udate?: string;
  ingestionBatchId?: string;
  action: {
    source?: {
      [key: string]: any;
    };
    meta?: {
      [key: string]: any;
    };
  };
}

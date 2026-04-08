import { VendorNames } from '../../controllers/models/Product';

export interface CidnFulfillmentRequestFields {
  vendor: VendorNames;
  customerId: string;
  transactionId: string;
}

export interface CidnContentToDeliver {
  fullContentS3Path?: string;
  s3Path?: string;
  vendorProductId?: string;
  fileName?: string;
  error?: string; // if error - only error and productNumber
  productTypeId?: string;
}

export interface CidnMusicSharedOutput extends CidnFulfillmentRequestFields {
  contentToDeliver: CidnContentToDeliver[];
}

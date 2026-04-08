import { VendorNames } from '../../controllers/models/Product';

export interface CDNFailureMessage {
  vendorName: VendorNames;
  vendorProductId: string;
  productTypeId: string;
  error: string;
}

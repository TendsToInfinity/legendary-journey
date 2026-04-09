import { Product } from './Product';

// Naming the interface without "Schema" for Schema API. Keeping the filename with "Schema" for GenerateSchemaCommand
interface TvSeason extends Product {
  // tslint:disable-line:no-unused-variable
  vendorName: string;
  vendorProductId: string;
  productTypeId: 'tvSeason';
  productTypeGroupId: 'tv';
  purchaseCode: 'VIDEO';
  purchaseTypes: ['rental'];
  fulfillmentType: 'digital';
  subscribable?: false;
  /**
   * @keyField true
   */
  isBlocked?: boolean;
  /**
   * @keyField true
   */
  isManuallyBlocked?: boolean;

  meta: {
    name: string;
    description: string;
    thumbnail: string;
    season: number;
    year: string;
    /**
     *  @autoComplete: true
     */
    basePrice: {
      rental: number;
    };
    startDate: string;
    endDate: string;
  };
}

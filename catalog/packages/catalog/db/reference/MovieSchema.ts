import { Product } from './Product';

export interface MovieCast {
  name: string;
  roles: string[];
}

export enum VideoRating {
  NR = 'NR',
  NC17 = 'NC-17',
  R = 'R',
  PG13 = 'PG-13',
  PG = 'PG',
  G = 'G',
  TV17 = 'TV-17',
  TVY = 'TV-Y',
  TVY7 = 'TV-Y7',
  TVG = 'TV-G',
  TVPG = 'TV-PG',
  TV14 = 'TV-14',
  TVMA = 'TV-MA',
}

// Naming the interface without "Schema" for Schema API. Keeping the filename with "Schema" for GenerateSchemaCommand
export interface Movie extends Product {
  // tslint:disable-line:no-unused-variable
  productTypeId: 'movie';
  productTypeGroupId: 'movie';
  purchaseCode: 'MOVIE';
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

  source: {
    vendorProductId: string;
    /**
     * @keyField true
     */
    vendorName: string;
    productTypeId: string;
    url: string;
    /**
     * @distinctValue meta.genres
     */
    genres?: string[];
    /**
     * @keyField true
     */
    subtitles?: string[];
    /**
     * @keyField true
     */
    languages?: string[];
    /**
     * @keyField true
     */
    licensed?: boolean;
  };
  meta: {
    /**
     * @keyField true
     */
    name: string;
    /**
     * @requiredIfActive true
     */
    description?: string;
    /**
     * @requiredIfActive true
     */
    thumbnail?: string;
    /**
     * @requiredIfActive true
     */
    year?: string;
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
     * @requiredIfActive true
     */
    cast?: MovieCast[];
    /**
     * @requiredIfActive true
     */
    directors?: string[];
    /**
     * @autoComplete true
     * @requiredIfActive true
     * @keyField true
     */
    rating?: VideoRating;
    /**
     * @requiredIfActive true
     * @keyField true
     */
    length?: number;
    /**
     * @requiredIfActive true
     */
    basePrice?: {
      /**
       * @autoComplete true
       * @distinctValue meta.basePrice.rental
       * @keyField true
       */
      rental: number;
    };
    /**
     * @format date
     */
    startDate?: string;
    /**
     * @format date
     */
    endDate?: string;
    downloadAllowed?: boolean;
  };
}

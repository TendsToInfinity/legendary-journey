import { MovieCast, VideoRating } from './MovieSchema';
import { Product } from './Product';

export enum TmdbVendor {
  Tmdb = 'tmdb',
}

// Naming the interface without "Schema" for Schema API. Keeping the filename with "Schema" for GenerateSchemaCommand
interface TvShow extends Product {
  // tslint:disable-line:no-unused-variable
  productTypeId: 'tvShow';
  productTypeGroupId: 'tv';
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
    vendorName: TmdbVendor;
    productTypeId: string;
    /**
     * @distinctValue meta.genres
     */
    genres?: string[];
  };

  meta: {
    /**
     * @keyField true
     */
    name: string;
    /**
     * @requiredIfActive true
     */
    description: string;
    /**
     * @requiredIfActive true
     */
    thumbnail: string;
    /**
     * @autoComplete true
     * @requiredIfActive true
     * @keyField true
     */
    genres?: string[];
    /**
     * @requiredIfActive true
     * @keyField true
     */
    airDate: string;
    /**
     * @requiredIfActive true
     */
    cast?: MovieCast[];
    directors?: string[];
    /**
     * @requiredIfActive true
     */
    languages?: string[];
    /**
     * @autoComplete true
     * @distinctValue meta.categories
     * @keyField true
     */
    categories?: string[];
    /**
     * @autoComplete true
     * @requiredIfActive true
     * @keyField true
     */
    rating?: VideoRating;
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

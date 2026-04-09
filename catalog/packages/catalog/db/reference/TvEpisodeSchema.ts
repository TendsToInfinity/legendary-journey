import { MovieCast, VideoRating } from './MovieSchema';
import { Product } from './Product';

// Naming the interface without "Schema" for Schema API. Keeping the filename with "Schema" for GenerateSchemaCommand
interface TvEpisode extends Product {
  // tslint:disable-line:no-unused-variable
  productTypeId: 'tvEpisode';
  productTypeGroupId: 'tv';
  purchaseCode: 'TVEPISODE';
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

  /**
   * @requiredIfActive true
   */
  tmdbShowId?: string;
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
     * @keyField true
     */
    showName: string;
    /**
     * @requiredIfActive true
     */
    description?: string;
    /**
     * @autoComplete true
     * @requiredIfActive true
     * @keyField true
     */
    genres?: string[];
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
    thumbnail?: string;
    /**
     * @autoComplete true
     * @distinctValue meta.season
     * @keyField true
     */
    season: number;
    /**
     * @autoComplete true
     * @distinctValue meta.episode
     * @keyField true
     */
    episode: number;
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
    directors?: string[];
    /**
     * @requiredIfActive true
     * @keyField true
     */
    airDate: string;
    /**
     * @requiredIfActive true
     */
    basePrice?: {
      /**
       *  @autoComplete: true
       *  @keyField true
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

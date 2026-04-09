import {
  Get,
  Path,
  Query,
  Route,
  Security,
  Tags,
} from 'securus.tablets.external.tsoa';
import { Inject, Singleton } from 'typescript-ioc';
import { ProductDao } from '../data/PGCatalog/ProductDao';
import { Availability } from './models/AvailabilityCheck';

@Singleton
@Route('products')
@Tags('Products')
export class ProductAvailabilityController {
  @Inject
  private productDao!: ProductDao;

  @Security('apiKey')
  @Security('corpJwt')
  @Get('{productId}/availability')
  public async findOne(
    @Path('productId') productId: string,
    @Query customerId?: string,
    @Query siteId?: string,
  ): Promise<Availability> {
    return this.productDao.findProductAvailabilityOrFail(
      parseInt(productId, 10),
      { customerId, siteId },
    );
  }
}

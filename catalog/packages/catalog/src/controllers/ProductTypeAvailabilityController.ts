import {
  Get,
  Path,
  Query,
  Route,
  Security,
  Tags,
} from 'securus.tablets.external.tsoa';
import { Inject, Singleton } from 'typescript-ioc';
import { ProductTypeDao } from '../data/PGCatalog/ProductTypeDao';
import { ProductTypeAvailability } from './models/ProductTypeAvailability';

@Singleton
@Route('productTypes')
@Tags('ProductTypes')
export class ProductTypeAvailabilityController {
  @Inject
  private productTypeDao!: ProductTypeDao;

  @Security('apiKey')
  @Security('corpJwt')
  @Get('{productTypeId}/availability')
  public async findOne(
    @Path('productTypeId') productTypeId: string,
    @Query customerId?: string,
    @Query siteId?: string,
  ): Promise<ProductTypeAvailability> {
    return this.productTypeDao.findAvailabilityOrFail(productTypeId, {
      customerId,
      siteId,
    });
  }
}

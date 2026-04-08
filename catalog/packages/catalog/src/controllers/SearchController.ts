import { SvSecurityContext } from '@securustablets/libraries.httpsecurity';
import { Valid } from 'securus.libraries.expressApi';
import {
  Body,
  Path,
  Post,
  Route,
  Security,
  SecurityContext,
  Tags,
} from 'securus.tablets.external.tsoa';
import { Inject, Singleton } from 'typescript-ioc';
import { OpenSearchManager } from '../lib/OpenSearchManager';
import { ProductManager } from '../lib/ProductManager';
import { Paginated } from '../lib/models/Paginated';
import { Product } from './models/Product';
import { Search } from './models/Search';

@Singleton
@Route('search')
@Tags('Search')
export class SearchController {
  @Inject
  private productManager!: ProductManager;

  @Inject
  private openSearchManager!: OpenSearchManager;

  /**
   * Performs a search of Products.
   * Always better to provide ProductTypeId/ProductId in the post body request.
   * Involving total=true in the request might see a delay in the response than with total=false
   * Order by should be part of the requests, with combination of productTypeId or productId
   * @param productTypeId
   * @param search
   * @param securityContext
   */
  @Security('apiKey')
  @Security('corpJwt')
  @Security('inmateJwt')
  @Post('{productTypeId}')
  public searchProducts(
    @Path productTypeId: string,
    @Body @Valid('Search') search: Search,
    @SecurityContext securityContext: SvSecurityContext,
  ): Promise<Paginated<Product>> {
    return this.openSearchManager.search(
      productTypeId,
      this.productManager.enforceSearchSecurityContext(search, securityContext),
    );
  }
}

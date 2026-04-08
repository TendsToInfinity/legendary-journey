import * as express from 'express';
import {
  Path,
  Post,
  Query,
  Request,
  Route,
  Security,
  Tags,
} from 'securus.tablets.external.tsoa';
import { Inject, Singleton } from 'typescript-ioc';
import { OpenSearchManager } from '../lib/OpenSearchManager';
import { ProductManager } from '../lib/ProductManager';
import { Paginated } from '../lib/models/Paginated';
import { Product } from './models/Product';

@Singleton
@Route('digest')
@Tags('Search Availability Digest')
export class DigestController {
  @Inject
  private productManager!: ProductManager;

  @Inject
  private openSearchManager!: OpenSearchManager;

  /**
   * Performs a digest of a set of Products defined by a FBQS query
   * Returns the product + digest for entities loaded into OpenSearch
   * @param request
   * @param productTypeId string [Required] The productTypeId to search
   * @param pageNumber number [Optional] PageNumber to pull from results, default 0
   * @param pageSize number [Optional] Number of results to pull per page, default 25
   * @param total boolean [Optional] Return a total result count, default false
   * @param orderBy "$field:[asc|desc]" [Optional] An Order field and sortOrder in string format
   */
  @Security('apiKey')
  @Security('corpJwt', ['catalogAdmin'])
  @Post('/products/{productTypeId}')
  public async digestProducts(
    @Request request: express.Request,
    @Path('productTypeId') productTypeId: string,
    @Query('pageNumber') pageNumber?: number,
    @Query('pageSize') pageSize?: number,
    @Query('total') total?: boolean,
    @Query('orderBy') orderBy?: any,
  ): Promise<Paginated<Product[]>> {
    const products = await this.productManager.findByQueryString({
      ...request.query,
      productTypeId,
    });
    products.data = await this.openSearchManager.digestProductsIntoOpenSearch(
      products.data,
    );
    return products;
  }
}

import { SvSecurityContext } from '@securustablets/libraries.httpsecurity';
import * as express from 'express';
import { Valid } from 'securus.libraries.expressApi';
import {
  Body,
  Get,
  Path,
  Post,
  Put,
  Query,
  Route,
  Security,
  SecurityContext,
  SuccessResponse,
  Tags,
} from 'securus.tablets.external.tsoa';
import { Exception } from 'securus.tablets.libraries.exceptions';
import { Inject, Singleton } from 'typescript-ioc';
import { ProductSalesDao } from '../data/PGCatalog/ProductSalesDao';
import { ProductSalesManager } from '../lib/ProductSalesManager';
import { Paginated } from '../lib/models/Paginated';
import { ProductSales } from './models/Product';

@Singleton
@Route('productSales')
@Tags('ProductSales')
export class ProductSalesController {
  @Inject
  private productSalesManager!: ProductSalesManager;

  @Inject
  private productSalesDao!: ProductSalesDao;

  /**
   * Performs a search of Product Sales.
   *
   * All fields on a Product Sales can be used as a query term, e.g. ?productTypeGroupId=music&productTypeId=track.
   *
   * @param pageNumberString number [Optional] PageNumber to pull from results, default 0
   * @param pageSizeString number [Optional] Number of results to pull per page, default 25
   * @param totalString boolean [Optional] Return a total result count, default false
   * @param orderByString "$field:[asc|desc]" [Optional] An Order field and sortOrder in string format
   */
  @Security('apiKey')
  @Security('corpJwt')
  @SuccessResponse('200', 'Success')
  @Get
  public async findProductSales(
    request: express.Request,
    @Query('pageNumber') pageNumberString?: number,
    @Query('pageSize') pageSizeString?: number,
    @Query('total') totalString?: boolean,
    @Query('orderBy') orderByString?: string,
  ): Promise<Paginated<ProductSales>> {
    return this.productSalesDao.findByQueryString(request.query as any);
  }

  @SuccessResponse('200', 'Success')
  @Security('apiKey')
  @Security('corpJwt')
  @Post
  public async createProductSales(
    @Body @Valid('ProductSales') productSales: ProductSales,
    @SecurityContext securityContext: SvSecurityContext,
  ): Promise<{ productSalesId: number }> {
    return {
      productSalesId: await this.productSalesManager.createProductSales(
        productSales,
        securityContext,
      ),
    };
  }

  @SuccessResponse('204', 'No Content')
  @Security('apiKey')
  @Security('corpJwt')
  @Put('{productSalesId}')
  public updateProductSales(
    @Path productSalesId: string,
    @Body @Valid('ProductSales') productSales: ProductSales,
    @SecurityContext securityContext: SvSecurityContext,
  ): Promise<void> {
    if (
      !productSales.productSalesId ||
      parseInt(productSalesId, 10) !== productSales.productSalesId
    ) {
      throw Exception.InvalidData({
        errors: `Update productSalesId ${productSalesId} does not equal productSales payload id ${productSales.productSalesId}`,
      });
    }
    return this.productSalesManager.updateProductSales(
      productSales,
      securityContext,
    );
  }
}

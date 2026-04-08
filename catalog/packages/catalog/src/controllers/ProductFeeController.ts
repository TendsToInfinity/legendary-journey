import * as express from 'express';
import {
  Get,
  Path,
  Query,
  Request,
  Route,
  Security,
  Tags,
} from 'securus.tablets.external.tsoa';
import { Inject, Singleton } from 'typescript-ioc';
import { FeeDao } from '../data/PGCatalog/FeeDao';
import { FeeManager } from '../lib/FeeManager';
import { ProductManager } from '../lib/ProductManager';
import { Paginated } from '../lib/models/Paginated';
import { SearchHelper } from './SearchHelper';
import { Fee } from './models/Fee';

@Singleton
@Route('products')
@Tags('Products')
export class ProductFeeController {
  @Inject
  private productMan!: ProductManager;
  @Inject
  private feeDao!: FeeDao;
  @Inject
  private feeManager!: FeeManager;
  @Inject
  private searchHelper!: SearchHelper;

  @Security('apiKey')
  @Security('corpJwt')
  @Get('{productId}/fees')
  public async find(
    @Request request: express.Request,
    @Path productId: string,
    @Query customerId?: string,
    @Query siteId?: string,
    @Query('pageNumber') pageNumberString?: number,
    @Query('pageSize') pageSizeString?: number,
    @Query('total') totalString?: boolean,
    @Query('orderBy') orderByString?: string,
  ): Promise<Paginated<Fee>> {
    const product = await this.productMan.findOneByProductIdOrFail(
      parseInt(productId, 10),
      false,
      {},
      { customerId, siteId },
    );
    const fees = await this.feeDao.findByContextWithJsonClauses({
      customerId,
      siteId,
    });
    const feeIds = fees
      .filter((fee) => this.feeManager.productMatchesFee(fee, product))
      .map((fee) => fee.feeId);

    const findOptions = {
      ids: feeIds,
      ...this.searchHelper.buildPaginationOptions(request.query as any),
    };
    return this.searchHelper.buildResponse(
      await this.feeDao.find(findOptions),
      findOptions,
    );
  }
}

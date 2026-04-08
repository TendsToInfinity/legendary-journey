import { SvSecurityContext } from '@securustablets/libraries.httpsecurity';
import * as express from 'express';
import { Valid } from 'securus.libraries.expressApi';
import {
  Body,
  Delete,
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
import { FeeDao } from '../data/PGCatalog/FeeDao';
import { Paginated } from '../lib/models/Paginated';
import { Fee } from './models/Fee';

@Singleton
@Route('fees')
@Tags('Fees')
export class FeeController {
  @Inject
  private feeDao!: FeeDao;

  /**
   * Performs a search of Fees.
   *
   * All fields on a Fee can be used as a query term, e.g. ?customerId=I-003320&siteId=09340.
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
  public async findFees(
    request: express.Request,
    @Query('pageNumber') pageNumberString?: number,
    @Query('pageSize') pageSizeString?: number,
    @Query('total') totalString?: boolean,
    @Query('orderBy') orderByString?: string,
  ): Promise<Paginated<Fee>> {
    return this.feeDao.findByQueryString(request.query as any);
  }

  @Security('apiKey')
  @Security('corpJwt')
  @Get('{feeId}')
  public async findFee(@Path feeId: string): Promise<Fee> {
    return this.feeDao.findOneOrFail(parseInt(feeId, 10));
  }

  @SuccessResponse('200', 'Success')
  @Security('corpJwt', ['catalogAdmin'])
  @Post
  public async createFee(
    @Body @Valid('Fee') fee: Fee,
    @SecurityContext securityContext: SvSecurityContext,
  ): Promise<{ feeId: number }> {
    return { feeId: await this.feeDao.create(fee, securityContext) };
  }

  @SuccessResponse('204', 'No Content')
  @Security('corpJwt', ['catalogAdmin'])
  @Put('{feeId}')
  public updateFee(
    @Path feeId: string,
    @Body @Valid('Fee') fee: Fee,
    @SecurityContext securityContext: SvSecurityContext,
  ): Promise<void> {
    if (!fee.feeId || parseInt(feeId, 10) !== fee.feeId) {
      throw Exception.InvalidData({
        errors: `Update feeId ${feeId} does not equal fee payload id ${fee.feeId}`,
      });
    }
    return this.feeDao.update(fee.feeId, fee, securityContext);
  }

  @SuccessResponse('204', 'No Content')
  @Security('corpJwt', ['catalogAdmin'])
  @Delete('{feeId}')
  public deleteFee(
    @Path feeId: string,
    @SecurityContext securityContext: SvSecurityContext,
  ): Promise<void> {
    return this.feeDao.delete(parseInt(feeId, 10), securityContext);
  }
}

import { SvSecurityContext } from '@securustablets/libraries.httpsecurity';
import { SearchParameters } from '@securustablets/libraries.postgres/dist/src/models/SearchParameters';
import * as express from 'express';
import {
  Get,
  Path,
  Query,
  Request,
  Route,
  Security,
  SecurityContext,
  SuccessResponse,
  Tags,
} from 'securus.tablets.external.tsoa';
import { Inject, Singleton } from 'typescript-ioc';
import { BlocklistReasonManager } from '../lib/BlocklistReasonManager';
import { Paginated } from '../lib/models/Paginated';
import { BlockReason } from './models/BlockReason';

@Singleton
@Route('blockReasons')
@Tags('blockReasons')
export class BlockReasonController {
  @Inject
  private blocklistReasonManager!: BlocklistReasonManager;

  /**
   * Performs a search of blockReasons.
   * Any field on an BlockReason can be used as a query term, e.g. ?blockReasonId=1357
   * @param request
   * @param corpJwt
   * @param apiKey
   * @param blockReasonId number [Optional] returns the BlockReason matching the blockReasonId
   * @param productId number [Optional] returns the BlockReason matching the productId
   * @param termId number [Optional] returns the BlockReason matching the termId
   * @param term string [Optional] returns all the BlockReasons matching the term
   * @param blockActionId number [Optional] returns the BlockReason matching the blockActionId
   * @param isActive boolean [Optional] returns all the BlockReason which are isActive when true and vice versa
   * @param isManuallyBlocked boolean [Optional] returns all the BlockReason which are isManuallyBlocked when true and vice versa
   * @param pageNumber number [Optional] PageNumber to pull from results, default 0
   * @param pageSize number [Optional] Number of results to pull per page, default 25
   * @param total boolean [Optional] Return a total result count, default false
   * @param orderBy "$field:[asc|desc]" [Optional] An Order field and sortOrder in string format
   * @returns {Paginated<BlockReason>}
   */
  @Get()
  @Security('apiKey')
  @Security('corpJwt')
  @SuccessResponse('200', 'Successfully retrieved blockReasons')
  public async getBlockReasons(
    @Request request: express.Request,
    @Query('blockReasonId') blockReasonId?: number,
    @Query('productId') productId?: number,
    @Query('termId') termId?: number,
    @Query('term') term?: string,
    @Query('blockActionId') blockActionId?: number,
    @Query('isActive') isActive?: boolean,
    @Query('isManuallyBlocked') isManuallyBlocked?: boolean,
    @Query('pageNumber') pageNumber?: number,
    @Query('pageSize') pageSize?: number,
    @Query('total') total?: boolean,
    @Query('orderBy') orderBy?: any,
  ): Promise<Paginated<BlockReason>> {
    return this.blocklistReasonManager.getBlockReasons(
      request.query as SearchParameters,
    );
  }

  /**
   * Gets a single BlockReason by id
   * @param id number
   * @param corpJwt
   * @param apiKey
   * @returns {BlockReason}
   */
  @Get('{id}')
  @Security('apiKey')
  @Security('corpJwt')
  @SuccessResponse('200', 'Successfully retrieved BlockReason by id')
  public async getBlockReason(
    @Path() id: number,
    @SecurityContext() securityContext: SvSecurityContext,
  ): Promise<BlockReason> {
    return this.blocklistReasonManager.getBlockReason(id);
  }
}

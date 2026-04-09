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
import { BlocklistActionManager } from '../lib/BlocklistActionManager';
import { Paginated } from '../lib/models/Paginated';
import { BlockAction } from './models/BlockAction';

@Singleton
@Route('blockActions')
@Tags('BlockActions')
export class BlockActionController {
  @Inject
  private blocklistMan!: BlocklistActionManager;

  /**
   * Performs a search of BlockActions.
   * Any field on an BlockAction can be used as a query term, e.g. ?blockActionId=1357
   * @param request
   * @param blockActionId number [Optional] returns the exact blockAction by the blockActionId
   * @param type string [Optional] terms, product, manual - should be one of them - returns all the blockActions matching the type
   * @param productId number [Optional]- returns all the blockActions for the productId
   * @param pageNumber number [Optional] PageNumber to pull from results, default 0
   * @param pageSize number [Optional] Number of results to pull per page, default 25
   * @param total boolean [Optional] Return a total result count, default false
   * @param orderBy "$field:[asc|desc]" [Optional] An Order field and sortOrder in string format
   * @param corpJwt
   * @param apiKey
   * @returns {Paginated<BlockAction>}
   */
  @Get()
  @Security('apiKey')
  @Security('corpJwt')
  @SuccessResponse('200', 'Successfully retrieved BlockActions')
  public async getBlockActions(
    @Request request: express.Request,
    @Query('blockActionId') blockActionId?: number,
    @Query('type') type?: string,
    @Query('productId') productId?: number,
    @Query('pageNumber') pageNumber?: number,
    @Query('pageSize') pageSize?: number,
    @Query('total') total?: boolean,
    @Query('orderBy') orderBy?: any,
  ): Promise<Paginated<BlockAction>> {
    return this.blocklistMan.getBlockActions(request.query as SearchParameters);
  }

  /**
   * Gets a single BlocklistAction by id
   * @param id number
   * @param corpJwt
   * @param apiKey
   * @returns {BlockAction}
   */
  @Get('{id}')
  @Security('apiKey')
  @Security('corpJwt')
  @SuccessResponse('200', 'Successfully retrieved BlockAction by id')
  public async getBlockAction(
    @Path() id: number,
    @SecurityContext() securityContext: SvSecurityContext,
  ): Promise<BlockAction> {
    return this.blocklistMan.getBlockAction(id);
  }
}

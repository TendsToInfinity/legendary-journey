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
  Request,
  Route,
  Security,
  SecurityContext,
  SuccessResponse,
  Tags,
} from 'securus.tablets.external.tsoa';
import { Exception } from 'securus.tablets.libraries.exceptions';
import { Inject, Singleton } from 'typescript-ioc';
import { LargeImpactEventManager } from '../lib/LargeImpactEventManager';
import { Paginated } from '../lib/models/Paginated';
import {
  LargeImpactEvent,
  LargeImpactEventState,
} from './models/LargeImpactEvent';

@Singleton
@Route('lies')
@Tags('Large Impact Event')
export class LieController {
  @Inject
  private lieManager!: LargeImpactEventManager;

  /**
   * Performs a search of Large Impact Events.
   * Any field on an LargeImpactEvent can be used as a query term, e.g. ?blockReasonId=1357
   * @param request
   * @param corpJwt
   * @param apiKey
   * @param('largeImpactEventId') largeImpactEventId?: number,
   * @param('routingKey') routingKey?: string,
   * @param('payload') payload?: any,
   * @param('state') state?: LargeImpactEventState,
   * @param('cdate') cdate?: string,
   * @param('udate') udate?: string,
   * @param('version') version?: number,
   * @param('pageNumber') pageNumber?: number,
   * @param('pageSize') pageSize?: number,
   * @param('total') total?: boolean,
   * @param('orderBy') orderBy?: any
   * @returns {Paginated<BlockReason>}
   */
  @Get()
  @Security('apiKey')
  @Security('corpJwt', ['catalogAdmin'])
  @SuccessResponse('200', 'Successfully retrieved blockReasons')
  public async findLargeImpactEvents(
    @Request request: express.Request,
    @Query('largeImpactEventId') largeImpactEventId?: number,
    @Query('routingKey') routingKey?: string,
    @Query('payload') payload?: any,
    @Query('state') state?: LargeImpactEventState,
    @Query('cdate') cdate?: string,
    @Query('udate') udate?: string,
    @Query('version') version?: number,
    @Query('pageNumber') pageNumber?: number,
    @Query('pageSize') pageSize?: number,
    @Query('total') total?: boolean,
    @Query('orderBy') orderBy?: any,
  ): Promise<Paginated<LargeImpactEvent>> {
    return this.lieManager.findByQueryString(request.query as any);
  }

  /**
   * Gets a single LargeImpactEvent by id
   * @param id number
   * @param corpJwt
   * @param apiKey
   * @returns {LargeImpactEvent}
   */
  @Get('{id}')
  @Security('apiKey')
  @Security('corpJwt', ['catalogAdmin'])
  @SuccessResponse('200', 'Successfully retrieved BlockReason by id')
  public async getLargeImpactEvent(
    @Path() id: string,
    @SecurityContext() securityContext: SvSecurityContext,
  ): Promise<LargeImpactEvent> {
    const lieId = parseInt(id, 10);
    return this.lieManager.findOneOrFail(lieId);
  }

  @SuccessResponse('200', 'Success')
  @Security('apiKey')
  @Security('corpJwt', ['catalogAdmin'])
  @Post()
  public async createLargeImpactEvent(
    @Body @Valid('LargeImpactEvent') lie: LargeImpactEvent,
    @SecurityContext securityContext: SvSecurityContext,
  ): Promise<LargeImpactEvent> {
    return this.lieManager.createAndPublish(lie, securityContext);
  }

  @SuccessResponse('204', 'No Content')
  @Security('apiKey')
  @Security('corpJwt', ['catalogAdmin'])
  @Put('{lieId}')
  public async updateLargeImpactEvent(
    @Path lieId: string,
    @Body @Valid('LargeImpactEvent') lie: LargeImpactEvent,
    @SecurityContext securityContext: SvSecurityContext,
  ): Promise<LargeImpactEvent> {
    if (
      !lie.largeImpactEventId ||
      parseInt(lieId, 10) !== lie.largeImpactEventId
    ) {
      throw Exception.InvalidData({
        errors: `Update lieId ${lieId} does not equal lie payload id ${lie.largeImpactEventId}`,
      });
    }
    return await this.lieManager.updateAndPublish(lie, securityContext);
  }
}

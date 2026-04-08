import { SvSecurityContext } from '@securustablets/libraries.httpsecurity';
import { SearchParameters } from '@securustablets/libraries.postgres/dist/src/models/SearchParameters';
import * as express from 'express';
import {
  Body,
  Get,
  Path,
  Put,
  Query,
  Request,
  Route,
  Security,
  SecurityContext,
  SuccessResponse,
  Tags,
} from 'securus.tablets.external.tsoa';
import { Inject, Singleton } from 'typescript-ioc';
import { DistinctProductValueManager } from '../lib/DistinctProductValueManager';
import { Paginated } from '../lib/models/Paginated';
import {
  BulkDvt,
  DistinctProductValue,
  EditableDistinctProductValueFields,
} from './models/DistinctProductValue';

@Singleton
@Route('distinctProductValues')
@Tags('DistinctProductValues')
export class DistinctProductValueController {
  @Inject
  private distinctProductValueManager!: DistinctProductValueManager;

  /**
   * Performs a search of DistinctProductValue.
   * Any field on an DistinctProductValue can be used as a query term, e.g. ?distinctProductValueId=1357
   * @param request
   * @param corpJwt
   * @param apiKey
   * @param pageNumber number [Optional] PageNumber to pull from results, default 0
   * @param pageSize number [Optional] Number of results to pull per page, default 25
   * @param orderBy "$field:[asc|desc]" [Optional] An Order field and sortOrder in string format
   * @returns {DistinctProductValue}
   */
  @Get()
  @Security('apiKey')
  @Security('corpJwt')
  @SuccessResponse('200', 'Successfully retrieved DistinctProductValues')
  public async getDistinctProductValues(
    @Request request: express.Request,
    @Query('pageNumber') pageNumber?: number,
    @Query('pageSize') pageSize?: number,
    @Query('total') total?: boolean,
    @Query('orderBy') orderBy?: any,
  ): Promise<Paginated<DistinctProductValue>> {
    return this.distinctProductValueManager.findByQueryString(
      request.query as SearchParameters,
    );
  }

  /**
   * Gets a single DistinctProductValue by DistinctProductValueId
   * @param distinctProductValueId number
   * @param corpJwt
   * @param apiKey
   */
  @Get('{distinctProductValueId}')
  @Security('apiKey')
  @Security('corpJwt')
  @SuccessResponse('200', 'Successfully retrieved DistinctProductValue by id')
  public async getDistinctProductValueById(
    @Path() distinctProductValueId: number,
  ): Promise<DistinctProductValue> {
    return this.distinctProductValueManager.findOneOrFail(
      distinctProductValueId,
    );
  }

  /**
   * Updates DistinctProductValues by array of DistinctProductValueIds in the request body
   * @param distinctProductValueId number
   * @param corpJwt
   * @param apiKey
   * @param body BulkDvt
   * @param securityContext
   * Allowed fields to update: displayName: string, blocked: boolean
   * Enqueues a job in case blocked field is updated
   */
  @Put('bulk')
  @Security('apiKey')
  @Security('corpJwt', ['catalogAdmin'])
  @SuccessResponse(
    '200',
    'Successfully updated DistinctProductValue by DistinctProductValueId',
  )
  public async bulkUpdateDistinctProductValues(
    @SecurityContext() securityContext: SvSecurityContext,
    @Body() body: BulkDvt,
  ): Promise<{ data: DistinctProductValue[] }> {
    const data = await this.distinctProductValueManager.updateBulk(
      body.ids,
      body.data,
      securityContext,
    );
    return { data };
  }

  /**
   * Updates a single DistinctProductValue by DistinctProductValueId
   * @param distinctProductValueId number
   * @param corpJwt
   * @param apiKey
   * @param body EditableDistinctProductValueFields
   * @param securityContext
   * Allowed fields to update: displayName: string, blocked: boolean
   * Enqueues a job in case blocked field is updated
   */
  @Put('{distinctProductValueId}')
  @Security('apiKey')
  @Security('corpJwt', ['catalogAdmin'])
  @SuccessResponse(
    '200',
    'Successfully updated DistinctProductValue by DistinctProductValueId',
  )
  public async updateDistinctProductValueById(
    @Path() distinctProductValueId: number,
    @SecurityContext() securityContext: SvSecurityContext,
    @Body() body: EditableDistinctProductValueFields,
  ): Promise<DistinctProductValue> {
    const data = await this.distinctProductValueManager.updateBulk(
      [distinctProductValueId],
      body,
      securityContext,
    );
    return data[0];
  }
}

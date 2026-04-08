import { SearchParameters } from '@securustablets/libraries.postgres/dist/src/models/SearchParameters';
import * as express from 'express';
import {
  Get,
  Hidden,
  Query,
  Request,
  Route,
  Security,
  Tags,
} from 'securus.tablets.external.tsoa';
import { Inject, Singleton } from 'typescript-ioc';
import { FutureProductChangeManager } from '../lib/FutureProductChangeManager';
import {
  FutureProductChangeUpdateJob,
  ProductsToUpdateStatus,
  ProductsUpdateJobStatus,
} from '../lib/jobs/FutureProductChangeUpdateJob';
import { Paginated } from '../lib/models/Paginated';
import { FutureProductChange } from './models/FutureProductChange';

@Singleton
@Route('futureProductChanges')
@Tags('FutureProductChanges')
export class FutureProductChangeController {
  @Inject
  private futureProductChangeMan!: FutureProductChangeManager;

  @Inject
  private futureProductChangeUpdateJob!: FutureProductChangeUpdateJob;

  /**
   * Performs a paginated search of Future Product Changes object.
   * Any field on a Future Product Changes can be used as a query term, e.g. ?productId=1357
   * @param request
   * @param corpJwt
   * @param apiKey
   * @param pageNumber number [Optional] PageNumber to pull from results, default 0
   * @param pageSize number [Optional] Number of results to pull per page, default 25
   * @param total boolean [Optional] Return a total result count, default false
   */
  @Security('apiKey')
  @Security('corpJwt')
  @Get()
  public async find(
    @Request request: express.Request,
    @Query pageNumber?: number,
    @Query pageSize?: number,
    @Query total?: boolean,
  ): Promise<Paginated<FutureProductChange>> {
    return this.futureProductChangeMan.findFutureProducts(
      request.query as SearchParameters,
    );
  }

  @Hidden
  @Security('apiKey')
  @Get('runUpdate')
  public async runUpdate(): Promise<ProductsUpdateJobStatus> {
    return this.futureProductChangeUpdateJob.execute();
  }

  @Hidden
  @Security('apiKey')
  @Get('getUpdateStatus')
  public async getCurrentJobStatus(): Promise<ProductsToUpdateStatus> {
    return this.futureProductChangeUpdateJob.getCurrentJobStatus();
  }
}

import { Postgres } from '@securustablets/libraries.postgres';
import { _, findPkgRootSync } from '@securustablets/libraries.utils';
import * as express from 'express';
import * as path from 'path';
import {
  Get,
  Query,
  Request,
  Route,
  Tags,
} from 'securus.tablets.external.tsoa';
import { Exception } from 'securus.tablets.libraries.exceptions';
import { Inject, Singleton } from 'typescript-ioc';
import { EligibilityManager } from '../lib/EligibilityManager';
import { Heartbeat } from './models/Heartbeat';

@Singleton
@Tags('Heartbeat')
@Route('heartbeat')
export class HeartbeatController {
  @Inject
  private postgres!: Postgres;

  @Inject
  private eligibilityManager!: EligibilityManager;

  @Get
  public async heartbeat(
    @Request request: express.Request,
    @Query('isAlive') isAlive?: boolean,
  ): Promise<Heartbeat> {
    const version = require(
      path.join(findPkgRootSync(__dirname), 'package.json'),
    ).version;
    if (_.get(request, 'query.isAlive') === 'true') {
      return { version };
    }
    let hasError = false;
    const markHasError = (e) => {
      hasError = true;
      return e;
    };
    const [postgres, eligibility] = await Promise.all([
      this.postgres.heartbeat().catch((e) => markHasError(e)),
      this.eligibilityManager.heartbeat().catch((e) => markHasError(e)),
    ]);
    const response: Heartbeat = { version, postgres, eligibility };
    if (hasError) {
      throw Exception.InternalError({ errors: response });
    }
    return response;
  }
}

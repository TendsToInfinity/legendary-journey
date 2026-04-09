import { SvSecurityContext } from '@securustablets/libraries.httpsecurity';
import { _ } from '@securustablets/libraries.utils';
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
  Request,
  Response,
  Route,
  Security,
  SecurityContext,
  SuccessResponse,
  Tags,
} from 'securus.tablets.external.tsoa';
import { Exception } from 'securus.tablets.libraries.exceptions';
import { Inject, Singleton } from 'typescript-ioc';
import { RuleManager } from '../lib/RuleManager';
import { Paginated } from '../lib/models/Paginated';
import { Rule } from './models/Rule';

@Singleton
@Route('rules')
@Tags('Rules')
export class RuleController {
  @Inject
  private ruleManager!: RuleManager;

  /**
   * Performs a search of Rules.
   *
   * All fields on a Rule can be used as a query term, e.g. ?customerId=I-003320&siteId=09340.
   *
   * @param request
   * @param pageNumberString number [Optional] PageNumber to pull from results, default 0
   * @param pageSizeString number [Optional] Number of results to pull per page, default 25
   * @param totalString boolean [Optional] Return a total result count, default false
   * @param orderByString "$field:[asc|desc]" [Optional] An Order field and sortOrder in string format
   */
  @SuccessResponse('200', 'Success')
  @Security('apiKey')
  @Security('corpJwt')
  @Get
  public async findRules(
    @Request request: express.Request,
    @Query('pageNumber') pageNumberString?: number,
    @Query('pageSize') pageSizeString?: number,
    @Query('total') totalString?: boolean,
    @Query('orderBy') orderByString?: string,
  ): Promise<Paginated<Rule>> {
    return this.ruleManager.findByQueryString(request.query as any);
  }

  @SuccessResponse('204', 'No Content')
  @Response('404', 'Rule not found')
  @Security('apiKey')
  @Security('corpJwt')
  @Get('{ruleId}')
  public findRule(@Path ruleId: string): Promise<Rule> {
    return this.ruleManager.findOneOrFail(_.toNumber(ruleId));
  }

  @SuccessResponse('200', 'Success')
  @Security('apiKey')
  @Security('corpJwt', ['catalogAdmin'])
  @Post
  public async createRule(
    @Body @Valid('Rule') rule: Rule,
    @SecurityContext securityContext: SvSecurityContext,
  ): Promise<{ ruleId: number }> {
    if (
      !securityContext.apiKey &&
      this.ruleManager.isMusicRule(rule) &&
      this.ruleManager.isDigestableRule(rule)
    ) {
      throw Exception.InvalidData(
        `Music availability and subscription rules cannot be created at this time`,
      );
    }
    const ruleId = await this.ruleManager.createRule(rule, securityContext);

    return { ruleId };
  }

  @SuccessResponse('204', 'No Content')
  @Security('apiKey')
  @Security('corpJwt', ['catalogAdmin'])
  @Put('{ruleId}')
  public async updateRule(
    @Path ruleId: string,
    @Body @Valid('Rule') rule: Rule,
    @SecurityContext securityContext: SvSecurityContext,
  ): Promise<void> {
    if (!rule.ruleId || parseInt(ruleId, 10) !== rule.ruleId) {
      throw Exception.InvalidData({
        errors: `Update ruleId ${ruleId} does not equal rule payload id ${rule.ruleId}`,
      });
    }
    if (
      !securityContext.apiKey &&
      this.ruleManager.isMusicRule(rule) &&
      this.ruleManager.isDigestableRule(rule)
    ) {
      throw Exception.InvalidData(
        `Music availability and subscription rules cannot be created at this time`,
      );
    }
    await this.ruleManager.updateRule(rule, securityContext);
  }

  @SuccessResponse('204', 'No Content')
  @Security('corpJwt', ['catalogAdmin'])
  @Delete('{ruleId}')
  public async deleteRule(
    @Path ruleId: string,
    @SecurityContext securityContext: SvSecurityContext,
  ): Promise<void> {
    const rule = await this.ruleManager.findOneOrFail(_.toNumber(ruleId));

    if (
      this.ruleManager.isMusicRule(rule) &&
      this.ruleManager.isDigestableRule(rule)
    ) {
      throw Exception.InvalidData(
        `Music availability and subscription rules cannot be created at this time`,
      );
    }

    await this.ruleManager.deleteRule(parseInt(ruleId, 10), securityContext);
  }
}

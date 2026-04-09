import { SvSecurityContext } from '@securustablets/libraries.httpsecurity';
import { SearchParameters } from '@securustablets/libraries.postgres/dist/src/models/SearchParameters';
import * as express from 'express';
import {
  Body,
  Get,
  Path,
  Post,
  Query,
  Request,
  Response,
  Route,
  Security,
  SecurityContext,
  SuccessResponse,
  Tags,
} from 'securus.tablets.external.tsoa';
import { Inject, Singleton } from 'typescript-ioc';
import { BlocklistActionManager } from '../lib/BlocklistActionManager';
import { Paginated } from '../lib/models/Paginated';
import {
  BlocklistTerm,
  CreateBlocklistTermsRequestBody,
  DisableBlocklistTermsRequestBody,
} from './models/BlocklistTerm';

@Singleton
@Route('blocklistTerms')
@Tags('BlocklistTerms')
export class BlocklistTermController {
  @Inject
  private blocklistMan!: BlocklistActionManager;

  /**
   * Performs a search of BlocklistTerms.
   * Any field on an BlocklistTerm can be used as a query term, e.g. ?blocklistTermId=1357
   * @param request
   * @param corpJwt
   * @param apiKey
   * @param blocklistTermId number [Optional] returns the blockListTerm matching blocklistTermId
   * @param term string [Optional] returns the blockListTerm matching term
   * @param state string [Optional] pending,applied, should be one of them, returns the blockListTerm matching state
   * @param pageNumber number [Optional] PageNumber to pull from results, default 0
   * @param pageSize number [Optional] Number of results to pull per page, default 25
   * @param total boolean [Optional] Return a total result count, default false
   * @param orderBy "$field:[asc|desc]" [Optional] An Order field and sortOrder in string format
   * @returns {Paginated<BlocklistTerm>}
   */
  @Get()
  @Security('apiKey')
  @Security('corpJwt')
  @SuccessResponse('200', 'Successfully retrieved BlocklistTerms')
  public async findBlocklistTerms(
    @Request request: express.Request,
    @Query('blocklistTermId') blocklistTermId?: number,
    @Query('term') term?: string,
    @Query('pageNumber') pageNumber?: number,
    @Query('pageSize') pageSize?: number,
    @Query('total') total?: boolean,
    @Query('orderBy') orderBy?: string,
  ): Promise<Paginated<BlocklistTerm>> {
    return this.blocklistMan.getBlocklistTerms(
      request.query as SearchParameters,
    );
  }

  /**
   * Retrieves a BlocklistTerm by id
   * @param id number
   * @param corpJwt
   * @param apiKey
   * @returns {BlockListTerm}
   */
  @Get('{id}')
  @Security('apiKey')
  @Security('corpJwt')
  @SuccessResponse('200', 'Successfully retrieved BlocklistTerm')
  public async findBlocklistTermById(
    @Path('id') id: number,
  ): Promise<BlocklistTerm> {
    return this.blocklistMan.getBlocklistTerm(id);
  }

  /**
   * Creates a new BlocklistTerms
   * @param request
   * @param corpJwt
   * @param apiKey
   * @param body CreateBlocklistTermsRequestBody
   * @returns {BlockListTerm[]}
   */
  @Post()
  @Security('apiKey')
  @Security('corpJwt', ['catalogAdmin'])
  @SuccessResponse('201', 'Successfully created BlocklistTerm')
  @Response('400', 'Request data is invalid', { errors: [] })
  public async createBlocklistTerm(
    @Body() body: CreateBlocklistTermsRequestBody,
    @SecurityContext securityContext: SvSecurityContext,
  ): Promise<Paginated<BlocklistTerm>> {
    return {
      data: await this.blocklistMan.createOrUpdateBlocklistTerms(
        body.terms,
        body.productTypeGroupId,
        securityContext,
      ),
    };
  }

  /**
   * delete
   * @param id number
   * @param corpJwt
   * @param apiKey
   * @param body DisableBlocklistTermsRequestBody
   * @returns {BlockListTerm[]}
   */
  @Post('/disable')
  @Security('apiKey')
  @Security('corpJwt', ['catalogAdmin'])
  @Response('400', 'Request data is invalid', { errors: [] })
  public async disableBlocklistTerms(
    @Body() body: DisableBlocklistTermsRequestBody,
    @SecurityContext securityContext: SvSecurityContext,
  ): Promise<BlocklistTerm[]> {
    return this.blocklistMan.disableBlocklistTerms(body.ids, securityContext);
  }
}

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
import { ProductDao } from '../data/PGCatalog/ProductDao';
import { DigestManager } from '../lib/DigestManager';
import { Paginated } from '../lib/models/Paginated';
import { SearchHelper } from './SearchHelper';
import { Rule } from './models/Rule';

@Singleton
@Route('products')
@Tags('Products')
export class ProductRuleController {
  @Inject
  private productDao!: ProductDao;

  @Inject
  private searchHelper!: SearchHelper;

  @Inject
  private digestManager!: DigestManager;

  @Security('apiKey')
  @Security('corpJwt')
  @Get('{productId}/rules')
  public async find(
    @Request request: express.Request,
    @Path('productId') productId: string,
    @Query customerId?: string,
    @Query siteId?: string,
    @Query('pageNumber') pageNumberString?: number,
    @Query('pageSize') pageSizeString?: number,
    @Query('total') totalString?: boolean,
    @Query('orderBy') orderByString?: string,
  ): Promise<Paginated<Rule>> {
    const rules = await this.digestManager.getDigestRulesByContext({
      customerId,
      siteId,
    });
    const product = await this.productDao.findOneOrFail(
      parseInt(productId, 10),
    );
    const ruleIds = this.digestManager.getProductDigest(rules, product).ruleIds;
    const findOptions = {
      ...this.searchHelper.buildPaginationOptions(request.query as any),
    };
    return this.searchHelper.buildResponse(
      rules.filter((r) => ruleIds.includes(r.ruleId)),
      findOptions,
    );
  }
}

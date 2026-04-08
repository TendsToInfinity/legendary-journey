import { Client } from '@opensearch-project/opensearch';
import { SearchHit } from '@opensearch-project/opensearch/api/types';
import { Csi, MethodCache } from '@securustablets/libraries.cache';
import { SecurityContextManager } from '@securustablets/libraries.httpsecurity';
import { Logger } from '@securustablets/libraries.logging';
import { Lazy, _, apmWrapper } from '@securustablets/libraries.utils';
import * as moment from 'moment';
import { Container, Inject, Singleton } from 'typescript-ioc';
import { v4 as uuidv4 } from 'uuid';
import { PricedProduct, Product } from '../controllers/models/Product';
import { Search } from '../controllers/models/Search';
import { OpenSearchHelper } from '../lib/OpenSearchHelper';
import { Paginated } from '../lib/models/Paginated';
import { ProductType } from '../lib/models/ProductType';
import { AppConfig } from '../utils/AppConfig';
import { OpenSearchConverter } from './OpenSearchConverter';

@Singleton
export class OpenSearchDao {
  @Inject
  private config!: AppConfig;

  @Inject
  private logger!: Logger;

  @Inject
  private openSearchConverter!: OpenSearchConverter;

  @Lazy
  private get client(): Client {
    return new Client({
      node: this.config.openSearch.host,
      auth: {
        username: this.config.openSearch.user,
        password: this.config.openSearch.pass,
      },
      compression: 'gzip',
    });
  }

  /**
   * Execute a script block directly against OpenSearch
   * items matching a given document ID. Uses underlying update API.
   * @param id Index document ID
   * @param productTypeId Product type identifier of this product
   * @param script Script block to execute
   * @returns True if successful, false if failure
   */
  public async updateByScript(
    id: number,
    productTypeId: string,
    script: any,
    retryOnConflict: number = 0,
  ) {
    const productTypeIndex =
      OpenSearchHelper.getIndexFromProductTypeId(productTypeId);
    const updateRequest = {
      id: id.toString(),
      index: productTypeIndex,
      body: {
        script,
      },
      retry_on_conflict: retryOnConflict,
    };

    try {
      await this.query(
        this.client.update(updateRequest),
        `update - updateRequest: ${JSON.stringify(updateRequest)}`,
      );
      return true;
    } catch (error) {
      this.logger.error(`Error running script against OpenSearch: ${error}`);
      return false;
    }
  }

  /**
   * Bulk index a set of Products into OpenSearch in the correct index
   * @param products
   */
  public async bulkProducts(products: Product[]): Promise<boolean> {
    if (products.length === 0) {
      this.logger.info(`Refusing to bulkProducts for an empty array`);
      return true;
    }
    const body: any[] = [];
    products.map((product) => {
      body.push({
        update: {
          _index: OpenSearchHelper.getIndexFromProductTypeId(
            product.productTypeId,
          ),
          _id: product.productId,
        },
      });
      body.push({ doc: this.convertTo(product), doc_as_upsert: true });
    });
    // Choose what response body fields we get back from bulkProducts. Fewer fields = more performant
    const filterPath = [
      'items.update._id',
      'errors',
      'items.update.status',
      'items.update.error',
    ];
    const result = await this.query(
      this.client.bulk({
        body,
        filter_path: filterPath,
        refresh: true,
      }),
      `Bulking ${products.length} for ${products.map((p) => p.productTypeId)}`,
    );

    if (result.body.errors) {
      // only print error entries
      this.logger.error(
        JSON.stringify(
          _.filter(result.body.items, (i) => i.update.status !== 201),
        ),
      );
    }

    return !result.body.errors;
  }

  public async scrollSearch(
    productTypeId: string,
    search: Search,
    productType: ProductType,
  ): Promise<Paginated<Product>> {
    // Remove pageNumber from scroll searches
    delete search.pageNumber;
    // Enforce total on scroll searches
    search.total = true;

    const body = this.openSearchConverter.convertSearchToQuery(
      search,
      productType,
    );
    this.logger.info(
      `OpenSearch index: ${OpenSearchHelper.getAliasFromProductTypeId(productTypeId)}, query: ${JSON.stringify(body)}`,
    );

    const searchResult = await this.query(
      this.client.search({
        index: OpenSearchHelper.getAliasFromProductTypeId(productTypeId),
        body,
        scroll: '5m',
      }),
      JSON.stringify(body),
    );

    return this.paginateResults(searchResult, search);
  }

  public async getScrollPage(scrollId: string): Promise<Paginated<Product>> {
    const params = { scroll_id: scrollId, scroll: '5m' };

    const searchResult = await this.query(
      this.client.scroll(params),
      JSON.stringify({ scrollId }),
    );
    // Apply total: true just like the default for scrollSearch
    return this.paginateResults(searchResult, { total: true });
  }

  @MethodCache(Csi.Tier3, {
    secondsToLive: Container.get(AppConfig).cache.ttlLong,
    bypass: () =>
      _.isUndefined(
        Container.get(SecurityContextManager).securityContext?.inmateJwt,
      ),
  })
  public async search(
    productTypeId: string,
    search: Search,
    productType: ProductType,
  ): Promise<Paginated<PricedProduct>> {
    const body = this.openSearchConverter.convertSearchToQuery(
      search,
      productType,
    );
    this.logger.info(
      `OpenSearch index: ${OpenSearchHelper.getAliasFromProductTypeId(productTypeId)}, query: ${JSON.stringify(body)}`,
    );

    const searchResult = await this.query(
      this.client.search({
        index: OpenSearchHelper.getAliasFromProductTypeId(productTypeId),
        body,
      }),
      JSON.stringify(body),
    );

    return this.paginateResults(searchResult, search);
  }

  private paginateResults(
    searchResult: any,
    search: Search,
  ): Paginated<PricedProduct> {
    return {
      ...(searchResult.body._scroll_id && {
        scrollId: searchResult.body._scroll_id,
      }),
      pageNumber: search.pageNumber || 0,
      pageSize: search.pageSize || 25,
      ...(search.total && { total: searchResult.body.hits.total.value }),
      data: searchResult.body.hits.hits.map((i) => this.convertFrom(i)),
    };
  }

  private convertFrom(record: SearchHit): Product {
    return record._source as Product;
  }

  private convertTo(product: Product): Product {
    // normalize start and end dates
    if (!_.get(product, 'meta.startDate')) {
      product.meta.startDate = '1970-01-01';
    }
    if (!_.get(product, 'meta.endDate')) {
      product.meta.endDate = '9999-01-01';
    }
    if (!_.has(product, 'isBlocked')) {
      product.isBlocked = false;
    }
    return _.omit(
      product,
      'digest.productId',
      'digest.priceOverrides',
      'digest.webViewOverrides',
    ) as Product;
  }

  public async getAffectedProductsByRulesSearch(
    productTypeId: string,
    search: Search,
  ) {
    const index = OpenSearchHelper.getAliasFromProductTypeId(productTypeId);
    const body = this.openSearchConverter.convertRulesSearchToQuery(search);

    this.logger.info(
      `OpenSearch index: ${OpenSearchHelper.getAliasFromProductTypeId(productTypeId)}, query: ${JSON.stringify(body)}`,
    );

    const searchResult = await this.query(
      this.client.search({
        index,
        body,
        scroll: '5m',
      }),
      JSON.stringify(body),
    );

    return this.paginateResults(searchResult, search);
  }

  // Wrap all openSearch queries for timing logging
  private async query(promise: any, args: string): Promise<any> {
    const queryId = uuidv4();
    this.logger.debug(`Begin query:"${queryId}" args:${args}`);
    const start = moment.now();
    const span = apmWrapper.startSpan('openSearchQuery', 'db');
    const result = await promise;
    if (span) {
      span.end();
    }
    this.logger.debug(
      `End query:"${queryId}" took:"${moment.now() - start}ms" result:${JSON.stringify(result.body)}`,
    );
    return result;
  }
}

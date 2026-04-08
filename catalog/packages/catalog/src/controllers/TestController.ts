import { CacheManager } from '@securustablets/libraries.cache';
import { Postgres } from '@securustablets/libraries.postgres';
import { _ } from '@securustablets/libraries.utils';
import * as Bluebird from 'bluebird';
import { Response } from 'express';
import {
  NewElasticSearchPromiseClient,
  PromiseClient,
} from 'securus.libraries.elasticsearch-promise';
import {
  Body,
  Get,
  Hidden,
  HttpResponse,
  Post,
  Route,
  Security,
  Tags,
} from 'securus.tablets.external.tsoa';
import { Exception } from 'securus.tablets.libraries.exceptions';
import { Inject, Singleton } from 'typescript-ioc';
import { ProductManager } from '../lib/ProductManager';
import { AppConfig } from '../utils/AppConfig';
import { Product } from './models/Product';

@Singleton
@Tags('Test')
@Route('test')
export class TestController {
  @Inject
  private config!: AppConfig;

  private client: PromiseClient = NewElasticSearchPromiseClient({
    host: this.config.elastic,
  });

  @Inject
  private postgres!: Postgres;

  @Inject
  private productManager!: ProductManager;

  @Inject
  private cacheManager!: CacheManager;

  @Hidden
  @Security('apiKey')
  @Get('cache/clear')
  public async clearCache(): Promise<void> {
    return this.cacheManager.flush();
  }

  @Hidden
  @Post('bulk')
  public async bulk(
    @Body products: Product[],
    @HttpResponse response: Response,
  ): Promise<void> {
    if (this.config.allowTestApis) {
      const idMap: { [key: number]: number } = {};
      await Bluebird.map(
        products,
        (product) => this.createProduct(idMap, product, 'bulkApi'),
        { concurrency: 1 },
      );
      response.sendStatus(204);
    } else {
      throw Exception.Forbidden();
    }
  }

  @Hidden
  @Post('wipe')
  public async wipe(): Promise<void> {
    if (this.config.allowTestApis) {
      await Promise.all([
        this.postgres.query(
          'TRUNCATE product, rule, distinct_product_value, block_reason, block_action, blocklist_term, future_product_change, product_sales',
        ),
        this.client.indices
          .delete({ index: 'sv_catalog' })
          // Ignore index doesnt exist error.
          .catch((err) => {
            if (err.statusCode !== 404) {
              throw err;
            }
          }),
      ]);
    } else {
      throw Exception.Forbidden();
    }
  }

  private async createProduct(
    idMap: { [key: number]: number },
    product: Product,
    apiKey: string,
  ) {
    if (!_.isUndefined(idMap[product.productId])) {
      return;
    }

    if (!_.isEmpty(product.childProducts)) {
      product.childProductIds = [];
      await Bluebird.map(
        product.childProducts,
        async (childProduct) => {
          const childProductId = childProduct.productId;
          await this.createProduct(idMap, childProduct, apiKey);
          product.childProductIds.push(idMap[childProductId]);
        },
        { concurrency: 1 },
      );
      product.childProducts = undefined;
    }

    idMap[product.productId] = await this.productManager.createProduct(
      product,
      { apiKey },
    );
  }
}

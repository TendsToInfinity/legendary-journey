import { Client } from '@opensearch-project/opensearch';
import { CacheManager } from '@securustablets/libraries.cache';
import { Postgres } from '@securustablets/libraries.postgres';
import { _, Lazy } from '@securustablets/libraries.utils';
import * as Bluebird from 'bluebird';
import { ElasticsearchTestClient } from 'securus.tablets.elasticsearch.utils';
import { Container, Inject } from 'typescript-ioc';
import { CatalogService } from '../../src/CatalogService';
import { Product } from '../../src/controllers/models/Product';
import { Rule } from '../../src/controllers/models/Rule';
import { Context } from '../../src/controllers/models/Search';
import { ProductDao } from '../../src/data/PGCatalog/ProductDao';
import { RuleDao } from '../../src/data/PGCatalog/RuleDao';
import { OpenSearchManager } from '../../src/lib/OpenSearchManager';
import { AppConfig } from '../../src/utils/AppConfig';
import { ModelFactory } from '../utils/ModelFactory';

export class IntegrationTestSuite {
  @Inject
  private static postgres: Postgres;

  @Inject
  private static config: AppConfig;

  @Inject
  private static cacheManager: CacheManager;

  @Inject
  private static ruleDao: RuleDao;

  @Inject
  private static productDao: ProductDao;

  @Inject
  private static openSearchManager: OpenSearchManager;

  @Lazy
  private static get esTestClient() {
    return new ElasticsearchTestClient({ host: this.config.elastic });
  }

  @Lazy
  private static get osTestClient(): Client {
    return new Client({
      node: this.config.openSearch.host,
      auth: {
        username: this.config.openSearch.user,
        password: this.config.openSearch.pass,
      },
      compression: 'gzip',
    });
  }

  public static setUp(
    suite: any,
    options?: {
      postgres?: boolean;
      elasticsearch?: boolean;
      cache?: boolean;
      openSearch?: boolean;
    },
  ) {
    suite.timeout(30000);
    suite.retries(3);

    // Force dependency binding. Ugly
    Container.get(CatalogService);

    beforeEach(async () => {
      const promises = [];
      if (_.get(options, 'postgres', true)) {
        promises.push(
          this.postgres
            .write(`TRUNCATE product, rule, homepage, fee, distinct_product_value,
                                            block_reason, block_action, blocklist_term, future_product_change, large_impact_event, product_sales`),
        );
      }
      if (_.get(options, 'elasticsearch', false)) {
        promises.push(this.esTestClient.wipe());
      }
      if (_.get(options, 'openSearch', false)) {
        const productTypeIndexes = [
          'movie',
          'track',
          'album',
          'game',
          'tvShow',
          'tvEpisode',
          'musicSubscription',
          'movieSubscription',
          'gameSubscription',
        ];
        for (const productTypeId of productTypeIndexes) {
          promises.push(
            (async () => {
              const index = `${productTypeId.toLowerCase()}_main`;
              const indexExists = await this.osTestClient.indices.exists({
                index,
              });
              if (indexExists.body) {
                // remove any existing indexes to clear the data
                await this.osTestClient.indices
                  .delete({ index })
                  .catch((error) => {
                    console.error(
                      `Error deleting index ${index}: ${error.message}`,
                    );
                  });
              }
              // create all indexes so they're ready to be searched
              await this.osTestClient.indices.create({ index });
            })(),
          );
        }
      }
      if (_.get(options, 'cache', true)) {
        promises.push(this.cacheManager.flush());
      }
      await Promise.all(promises);
    });
  }

  public static async enableProductTypes(
    productTypeIds: string[],
    contexts: Context[],
  ) {
    const rules = _.chain(productTypeIds)
      .map((productTypeIdTmp) =>
        _.map(contexts, ({ customerId: cid, siteId: sid }) =>
          ModelFactory.productTypeAvailabilityRule({
            customerId: cid,
            siteId: sid,
            productTypeId: productTypeIdTmp,
            action: { available: true },
          }),
        ),
      )
      .flatten()
      .value();

    await Bluebird.map(rules, async (rule) => {
      await this.ruleDao.create(rule, { apiKey: 'API_KEY_DEV' });
    });
  }
  public static async loadProductsAndRules(
    products: Product[],
    rules: Rule[] = [],
    contexts: Context[] = [],
    enableProductType: string[] = [],
  ): Promise<any> {
    const productTypeIds = _.isEmpty(enableProductType)
      ? _.uniq(_.map(products, 'productTypeId'))
      : enableProductType;
    // Enable product types for availability
    if (enableProductType) {
      await IntegrationTestSuite.enableProductTypes(productTypeIds, contexts);
    }

    // Ensure products are created in order
    const dbProducts: Product[] = [];
    for (const product of products) {
      dbProducts.push(
        await this.productDao.createAndRetrieve(product, { apiKey: 'test' }),
      );
    }

    // create the rules
    for (const rule of rules) {
      // This bit allows the caller to specify a rule.productId
      //      that should match a product created with a source.vendorProductId of the same value
      //      Note: this is to support subscriptionProductAvailability rules (and the damn FK)
      if (rule.productId) {
        rule.productId = _.find(dbProducts, {
          source: { vendorProductId: rule.productId.toString() },
        }).productId;
      }
      await this.ruleDao.create(rule, { apiKey: 'test' });
    }
    for (const productTypeId of productTypeIds) {
      const productTypeProducts = _.filter(dbProducts, { productTypeId });
      if (!_.isEmpty(productTypeProducts)) {
        await this.openSearchManager.digestProductsIntoOpenSearch(
          productTypeProducts,
        );
      }
    }
    return dbProducts;
  }
}

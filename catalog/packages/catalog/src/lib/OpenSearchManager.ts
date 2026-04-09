import { _ } from '@securustablets/libraries.utils';
import { Exception } from 'securus.tablets.libraries.exceptions';
import { Inject, Singleton } from 'typescript-ioc';
import {
  DigestProduct,
  PricedProduct,
  Product,
  ProductTypeIds,
} from '../controllers/models/Product';
import { Rule } from '../controllers/models/Rule';
import { Query, Search } from '../controllers/models/Search';
import { OpenSearchDao } from '../data/OpenSearchDao';
import { AppConfig } from '../utils/AppConfig';
import { DigestHelper } from './DigestHelper';
import { DigestManager } from './DigestManager';
import { ProductDecoratorManager } from './ProductDecoratorManager';
import { ProductTypeManager } from './ProductTypeManager';
import { DigestDecorator } from './decorators/product/DigestDecorator';
import { PriceDecorator } from './decorators/product/PriceDecorator';
import { ThumbnailDecorator } from './decorators/product/ThumbnailDecorator';
import { WebViewDecorator } from './decorators/product/WebViewDecorator';
import { Paginated } from './models/Paginated';

@Singleton
export class OpenSearchManager {
  private static readonly MAX_RESULT_WINDOW = 10000;

  @Inject
  private openSearchDao!: OpenSearchDao;

  // TODO These decorator imports seem clunky, why can't the manager do it for us?
  @Inject
  private priceDecorator!: PriceDecorator;

  @Inject
  private webViewDecorator!: WebViewDecorator;

  @Inject
  private thumbnailDecorator!: ThumbnailDecorator;

  @Inject
  private digestDecorator!: DigestDecorator;

  @Inject
  private decorator!: ProductDecoratorManager;

  @Inject
  private productTypeManager!: ProductTypeManager;

  @Inject
  private digestManager!: DigestManager;

  @Inject
  private config!: AppConfig;

  public getScrollPage = this.openSearchDao.getScrollPage.bind(
    this.openSearchDao,
  );

  /**
   * Enforce basic search interface validation
   * @param search
   * @private
   */
  private validateSearch(search: Search): void {
    if (search.query && search.match) {
      throw Exception.InvalidData({
        errors: `Cannot search with both 'query' and 'match'.`,
      });
    }

    const pageSize = search.pageSize || 25;
    const pageNumber = search.pageNumber || 0;

    if (
      !Number.isFinite(pageSize) ||
      !Number.isFinite(pageNumber) ||
      !Number.isInteger(pageSize) ||
      !Number.isInteger(pageNumber) ||
      pageSize <= 0 ||
      pageNumber < 0
    ) {
      throw Exception.InvalidData({
        errors:
          'Invalid pagination values. pageSize/pageNumber must be finite integers, with pageSize > 0 and pageNumber >= 0.',
      });
    }

    const from = pageSize * pageNumber;
    const resultWindow = from + pageSize;

    if (resultWindow > OpenSearchManager.MAX_RESULT_WINDOW) {
      throw Exception.InvalidData({
        errors:
          `Requested page exceeds OpenSearch result window (${OpenSearchManager.MAX_RESULT_WINDOW.toLocaleString()}). Please refine filters or use a scroll-based query.`,
      });
    }
  }

  /**
   * Apply search defaults
   * @param search
   * @private
   */
  private applyDefaults(search: Search): Search {
    return _.merge(
      {
        context: { enforce: false },
        pageNumber: 0,
        pageSize: 25,
        total: false,
      },
      search,
    );
  }

  /**
   * Scroll search is used for bulk operations where >10,000 records are expected to be pulled
   * This method is considered only usable for "GLOBAL" context so no productTypeAvailability is taken into consideration
   * @param productTypeId
   * @param search
   */
  public async scrollSearch(
    productTypeId: string,
    search: Search,
  ): Promise<Paginated<Product>> {
    this.validateSearch(search);
    const productType =
      await this.productTypeManager.getProductType(productTypeId);
    return this.openSearchDao.scrollSearch(productTypeId, search, productType);
  }

  /**
   * Sets (for new products) or increments (for existing products) total sales count
   * @param productIds ProductId of product to update
   * @param newCount Sales to set or increment
   */
  public async incrementProductTotalSales(
    productId: number,
    productTypeId: string,
    newCount: number = 1,
    retryOnConflict: number = 0,
  ): Promise<boolean> {
    const source = `
            if (ctx._source.digest == null) {
                ctx._source.digest = [:];
            }
            if (ctx._source.digest.sales == null) {
                ctx._source.digest.sales = [:];
                ctx._source.digest.sales.totalSales = null;
            }
            if (ctx._source.digest.sales.totalSales == null) {
                ctx._source.digest.sales.totalSales = params.newCount;
            } else {
                ctx._source.digest.sales.totalSales += params.newCount;
            }
        `;

    const script = {
      source: source.replace(/\n\s*/, ' '),
      params: {
        newCount,
      },
    };

    return await this.openSearchDao.updateByScript(
      productId,
      productTypeId,
      script,
      retryOnConflict,
    );
  }

  /**
   * You know, for search...
   * @param productTypeId
   * @param search
   */
  public async search(
    productTypeId: string,
    search: Search,
  ): Promise<Paginated<PricedProduct>> {
    this.validateSearch(search);
    search = this.applyDefaults(search);
    let productTypeAvailable = false;

    // Whenever we're utilizing local media only we aren't able to sell subscriptions so prevent them from showing
    if (
      this.config.catalogLocalMedia.catalogUseLocalMedia &&
      productTypeId === ProductTypeIds.MusicSubscription
    ) {
      productTypeAvailable = false;
    } else {
      productTypeAvailable =
        await this.productTypeManager.isProductTypeAvailableForContext(
          productTypeId,
          search.context,
        );
    }

    if (!productTypeAvailable && search.context.enforce) {
      // ProductTypeRule (not whitelisted or is blacklisted) prevents this productType from being returned. Give back an empty result
      return {
        pageSize: search.pageSize,
        pageNumber: search.pageNumber,
        ...(search.total && { total: 0 }),
        data: [],
      };
    }
    const productType =
      await this.productTypeManager.getProductType(productTypeId);
    const paginated = await this.openSearchDao.search(
      productTypeId,
      search,
      productType,
    );

    paginated.data.forEach((product) => {
      product.available = productTypeAvailable
        ? DigestHelper.isProductAvailableForContext(
            product,
            search.context,
            product.digest,
          )
        : false;
    });

    const decorators = [
      this.digestDecorator.decorator,
      this.priceDecorator.decorator,
      this.webViewDecorator.decorator,
      this.thumbnailDecorator.decorator,
    ];

    await this.decorator.apply(paginated.data, decorators, search.context);

    return paginated;
  }

  /**
   * Given a set of products, will run digests (rule lookup) and push the products to OpenSearch
   * @param products
   */
  public async digestProductsIntoOpenSearch(
    products: Product[],
  ): Promise<DigestProduct[]> {
    const digests = await this.digestManager.digestProducts(products);
    const bulkProducts = products.map((product) => {
      return {
        // Clear out any calculated or decorated fields that might be on the source data
        ..._.omit(product, 'childProducts', 'available', [
          ...this.priceDecorator.getDecoratorFields(),
          ...this.webViewDecorator.getDecoratorFields(),
          ...this.thumbnailDecorator.getDecoratorFields(),
          ...this.digestDecorator.getDecoratorFields(),
        ]),
        digest: digests.find((d) => d.productId === product.productId),
      } as DigestProduct;
    });
    await this.openSearchDao.bulkProducts(bulkProducts);
    return bulkProducts;
  }

  /**
   * Will return set of products that match the given rules
   * @param productTypeId
   * @param rules
   * @param scrollId Scroll context identifier for continuing an already-opened scrolled search. For more information, see https://docs.opensearch.org/latest/api-reference/search-apis/scroll/
   * @returns
   */
  public async getProductsByRules(
    productTypeId: string,
    rules: Rule[],
    scrollId?: string,
  ): Promise<Paginated<Product>> {
    // 1. Get all rule ids, to return all products that match any of the updated rules
    const ruleIds = rules.map((rule) => rule.ruleId);
    // 2. Get all clauses, to return all products that will be affected by the update
    const ruleClauses = rules.map((rule) => rule.clauses);

    let clauses = {};
    // If we have an empty clause we need to match all products so don't merge all clauses together leave it empty
    if (!_.find(ruleClauses, (clause) => _.isEmpty(clause))) {
      // Merge all clauses together while uniquely concatenating array values
      clauses = _.mergeWith(
        {},
        ...ruleClauses,
        OpenSearchManager.clauseMergeHelper,
      );
      // We need to return products that match either the clauses of the current rules OR previously matched the rules in the digest
      clauses = { ...clauses, 'digest.ruleIds': ruleIds };
    }

    // 3. Make a query to return only unique ids for products that match ids and clauses
    const query: Query = {
      productTypeId,
      clauses,
    };

    const search: Search = {
      query,
      pageSize: 10000,
      total: true,
    };

    let result: Promise<Paginated<Product>>;

    if (scrollId) {
      // If there exists a `scrollId`, a scrolled search context has already been created,
      // so we will query the next batch of results.
      result = this.openSearchDao.getScrollPage(scrollId);
    } else {
      result = this.openSearchDao.getAffectedProductsByRulesSearch(
        productTypeId,
        search,
      );
    }

    return result;
  }

  /**
   * Merge Customizer that enables merging rule clauses into a single clause
   * If the clause contains multiple values for the same attribute merge their values together uniquely
   */
  private static clauseMergeHelper(obj: any, src: any): any {
    if (_.isArray(obj)) {
      return _.uniq([...obj, ...src]);
    }
  }
}

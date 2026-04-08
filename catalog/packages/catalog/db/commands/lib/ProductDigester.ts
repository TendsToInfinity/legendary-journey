import { Logger } from '@securustablets/libraries.logging';
import { FindOptions, Postgres } from '@securustablets/libraries.postgres';
import * as Bluebird from 'bluebird';
import * as moment from 'moment';
import { Inject } from 'typescript-ioc';
import { Product } from '../../../src/controllers/models/Product';
import { ProductDao } from '../../../src/data/PGCatalog/ProductDao';
import { OpenSearchManager } from '../../../src/lib/OpenSearchManager';
import { AppConfig } from '../../../src/utils/AppConfig';

export class ProductDigester {
  @Inject
  private productDao!: ProductDao;

  @Inject
  private logger!: Logger;

  @Inject
  private openSearchManager!: OpenSearchManager;

  @Inject
  private config!: AppConfig;

  // Command Line Arguments
  private productTypeId: string;
  private max: number;
  private lastProductId: number;
  private pageSize: number;
  private pagesPerBatch: number;
  private exec: boolean;
  private verbose: boolean;

  // Configs/CLi
  private openSearchHost: string;
  private openSearchUser: string;
  private openSearchPass: string;

  // timers
  private timers = {};

  public async handle(args: any): Promise<void> {
    // init args
    this.productTypeId = args.productTypeId;
    this.max = args.max;
    this.lastProductId = args.lastProductId;
    this.pageSize = args.pageSize;
    this.pagesPerBatch = args.pagesPerBatch;
    this.exec = args.exec;
    this.verbose = args.verbose;

    this.openSearchHost = this.config.openSearch.host;
    this.openSearchUser = this.config.openSearch.user;
    this.openSearchPass = this.config.openSearch.pass;

    // init data sources
    const pg = Postgres.getInstance();

    // tslint:disable-next-line:no-console
    console.table({
      osHost: this.openSearchHost,
      osUser: this.openSearchUser,
      osPass: this.openSearchPass,
      productTypeId: this.productTypeId,
      max: this.max,
      lastProductId: this.lastProductId,
      pageSize: this.pageSize,
      pagesPerBatch: this.pagesPerBatch,
      exec: this.exec,
      verbose: this.verbose,
    });

    // number of records pulled and stored
    let count = 0;

    // setup batch page array
    const batchPages: number[] = [...Array(this.pagesPerBatch).keys()];

    this.startTimer('main');
    while (count < this.max) {
      let productBatchCount = 0;
      this.startTimer('batch');
      await Bluebird.map(batchPages, async (pageNumber) => {
        this.startTimer(`batchPage:${pageNumber}`);
        const currLastProduct = this.lastProductId;
        const products = await this.getProducts(this.lastProductId, pageNumber);
        productBatchCount += products.length;
        if (products && products.length) {
          if (this.lastProductId < products[products.length - 1].productId) {
            this.lastProductId = products[products.length - 1].productId;
          }
        }
        // count the products
        count += products.length;
        // digest the products into openSearch
        await this.bulkOpenSearch(products, pageNumber, currLastProduct);
      });
      this.logger.info(`Total ${this.productTypeId}s digested: ` + count);
      this.getTimeString('batch');
      this.getTimeString('main');
      if (productBatchCount < this.pageSize) {
        count = this.max;
        break;
      }
    }
    this.getTimeString('main');
    this.logger.info('Final productId: ' + this.lastProductId);
    await pg.end();
  }

  private async getProducts(
    lastProductId: number = 0,
    pageNumber: number = 0,
  ): Promise<Product[]> {
    this.startTimer(
      `Getting Products lastId:${lastProductId} pageNumber:${pageNumber}`,
    );
    const options: FindOptions<any, any> = {
      customClauses: [
        { clause: `product_id > $1`, params: [lastProductId] },
        {
          clause: `document->>'productTypeId' = $1`,
          params: [this.productTypeId],
        },
      ],
      pageSize: this.pageSize,
      pageNumber,
      orderBy: { productId: 'ASC' },
    };
    if (this.verbose) {
      this.logger.info(JSON.stringify(options));
    }
    const products = await this.productDao.find(options);
    this.getTimeString(
      `Getting Products lastId:${lastProductId} pageNumber:${pageNumber}`,
    );
    this.logger.info('getProducts: ' + products.length);
    return products as Product[];
  }

  private async bulkOpenSearch(
    products: Product[],
    pageNumber: number = 0,
    currLastProduct: number = 0,
  ): Promise<any> {
    this.startTimer(
      `Bulking data into OpenSearch lastId:${currLastProduct} pageNumber:${pageNumber}`,
    );
    if (products.length === 0) {
      this.logger.info(`Cowardly, not bulking zero products`);
      this.getTimeString(
        `Bulking data into OpenSearch lastId:${currLastProduct} pageNumber:${pageNumber}`,
      );
      return;
    }
    this.logger.info(`bulking ${products.length} to ${this.productTypeId}`);
    if (this.exec) {
      try {
        await this.openSearchManager.digestProductsIntoOpenSearch(products);
      } catch (error) {
        this.logger.info(
          `Error trying to digest products into openSearch: ${error}`,
        );
      }
    }

    // bulk the data here
    this.getTimeString(
      `Bulking data into OpenSearch lastId:${currLastProduct} pageNumber:${pageNumber}`,
    );
  }

  private startTimer(name: string): void {
    this.timers[name] = moment.now();
  }

  private getTimeString(name: string): void {
    const now = moment.now();
    const totalTime = moment.duration(now - this.timers[name]);
    this.logger.info(
      `Total ${name ? name : ''} time : ${totalTime.hours()}:${totalTime.minutes()}:${totalTime.seconds()} -- ${now - this.timers[name]}ms`,
    );
  }
}

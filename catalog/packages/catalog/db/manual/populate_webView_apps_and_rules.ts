import { Postgres } from '@securustablets/libraries.postgres';
import { _ } from '@securustablets/libraries.utils';
import axios from 'axios';
import * as Bluebird from 'bluebird';
import * as csv from 'fast-csv';
import * as fs from 'fs';
import { Container, Inject } from 'typescript-ioc';
import * as yargs from 'yargs';
import { CatalogService } from '../../src/CatalogService';
import { DigestProduct, Product } from '../../src/controllers/models/Product';
import { Rule, RuleType } from '../../src/controllers/models/Rule';
import { ProductDao } from '../../src/data/PGCatalog/ProductDao';
import { RuleDao } from '../../src/data/PGCatalog/RuleDao';
import { OpenSearchManager } from '../../src/lib/OpenSearchManager';
import { ProductStatus } from '../reference/Product';

/**
 * Specify path to csv file (-f)
 * Csv file format (with headers) see CsvFile interface, separated by ','.
 */

interface CsvFileRow {
  url_id: string;
  customer_id: string;
  site_id: string;
  application: string;
  url: string;
  active: boolean;
}

CatalogService.bindAll();

export class CreateWebViewAppsAndRules {
  @Inject
  private productDao!: ProductDao;

  @Inject
  private OpenSearchManager!: OpenSearchManager;

  @Inject
  private ruleDao!: RuleDao;

  private filePath: string;

  private env: string;

  private exec: boolean;

  constructor(args) {
    this.filePath = args.filepath;
    this.env = args.env;
    this.exec = args.exec;
  }

  public async execute() {
    console.log(`Reading file ${this.filePath}`);
    const cacApps = await this.readCsvFile<CsvFileRow>(this.filePath, true);
    const sortedCacApps = _.sortBy(cacApps, [
      'customer_id',
      'site_id',
      'application',
    ]);

    // Step 1 web view products creation
    // Create a list of unique webView product app names per cacApp
    // Dedupe array
    const allOfCacAppsDataByUniqueAppName = _.uniqBy(
      sortedCacApps,
      (cacApp) => cacApp.application,
    );

    // need to select a DEFAULT csv entry for the unique app name
    // to use as the base url
    const cacAppsWithDefaultSiteIdBeingUsedForBaseURL = _.map(
      allOfCacAppsDataByUniqueAppName,
      (eachUniqueCacApp) => {
        return sortedCacApps.find(
          (cacApp) =>
            cacApp.application === eachUniqueCacApp.application &&
            cacApp.site_id.toLocaleLowerCase() === 'default',
        );
      },
    );

    let webViewProductsCreated = 0;
    let existingWebViewProducts = 0;
    const failedProducts = [];
    const createdProducts: Product[] = [];
    let digestedProductsToOpenSearch: DigestProduct[] = [];

    // Check to see if the product already exists
    await Bluebird.map(
      allOfCacAppsDataByUniqueAppName,
      async (cacApp) => {
        const webViewProduct = await this.productDao.find({
          contains: {
            document: {
              meta: {
                packageName: `net.securustech.sv.cac.${cacApp.application.toLowerCase()}`,
              },
              productTypeId: 'webView',
            },
            pageSize: 1,
          },
        });
        if (!_.isEmpty(webViewProduct)) {
          existingWebViewProducts++;
          return;
        }

        // Create new webView products that don't already exist
        // first call dmm service to retrieve the app icon by tag with app name

        // after the other shell script has run...
        let theAppIconURLResponse;
        const DMM_SERVICE = `https://dmm.${this.env}.tp.stqlp.org/mediaAssets`;

        try {
          theAppIconURLResponse = await axios.get(DMM_SERVICE, {
            params: {
              tags: cacApp.application,
            },
            headers: {
              'X-API-KEY': 'API_KEY_DEV',
            },
          });

          // if this cacApp had a csv entry with 'DEFAULT', then use that url as the base
          let url = cacApp.url.trim();
          let csvEntryWithDefault;
          if (
            cacAppsWithDefaultSiteIdBeingUsedForBaseURL
              .filter((app) => app !== undefined)
              .some((app) => app.application === cacApp.application)
          ) {
            csvEntryWithDefault = cacAppsWithDefaultSiteIdBeingUsedForBaseURL
              .filter((app) => app !== undefined)
              .find((app) => app.application === cacApp.application);
            url = csvEntryWithDefault.url.trim();
          }

          const newWebViewProduct: Product = {
            productTypeId: 'webView',
            productTypeGroupId: 'apk',
            fulfillmentType: 'digital',
            meta: {
              name: cacApp.application,
              packageName: `net.securustech.sv.cac.${cacApp.application.toLowerCase()}`,
              webViewUrl: url,
              displayPriority: 100,
              thumbnail: theAppIconURLResponse.data.data[0]?.rendition?.url
                ? theAppIconURLResponse.data.data[0]?.rendition?.url
                : undefined,
              webViewConfig: {
                //fileSelectionAllowed?: boolean;
                //downloadAllowed?: boolean;
                //downloadDirectory?: string;
                //killOnPause?: boolean;
                //orientationLock?: WebViewOrientation;
                //microphoneAllowed?: boolean;
                //customUrlDecorations: '?customerId={customerId}&siteId={siteId}&aidFlo={serialNumber}&tabletType={role}&source=',
              },
            },
            status: ProductStatus.Active,
            enabled: true,
          } as any;
          // } as any as Product;

          try {
            if (this.exec) {
              newWebViewProduct.productId = await this.productDao.create(
                newWebViewProduct,
                {
                  apiKey: 'WebView apps & Rules Migration',
                },
              );
            }
            createdProducts.push(newWebViewProduct);
            webViewProductsCreated++;
          } catch (e) {
            failedProducts.push(cacApp.application);
            console.log(e.message);
          }
        } catch (error) {
          if (error instanceof Bluebird.AggregateError) {
            console.log(`failed with ${error.length} errors`);

            error.forEach((e, i) => {
              console.log(
                {
                  index: i,
                  message: e.message,
                  stack: e.stack,
                },
                'Mapped dmm operation error',
              );
            });
          } else {
            console.log(
              {
                message: error.message,
                stack: error.stack,
              },
              `Unexpected error during Bluebird.map. The cac app this is failing on: ${cacApp.application}`,
            );
          }
          failedProducts.push(cacApp.application);
        }
      },
      { concurrency: 3 },
    );

    // digest products into OpenSearch
    try {
      if (this.exec) {
        digestedProductsToOpenSearch =
          await this.OpenSearchManager.digestProductsIntoOpenSearch(
            createdProducts,
          );
      }
    } catch (e) {
      console.log(
        `Something went wrong digesting the products. Error: ${e.message}`,
      );
    }

    console.log(
      `------------------------------------------------------------------------`,
    );
    console.log(`webView Products created: ${webViewProductsCreated}`);
    console.log(
      `Number of products With Existing Web View Products records: ${existingWebViewProducts}`,
    );
    console.log(
      `Number of products Attempted: ${allOfCacAppsDataByUniqueAppName.length}`,
    );
    console.log(`Number of products Failed: ${failedProducts.length}`);
    console.log(
      `digested Products: ${JSON.stringify(digestedProductsToOpenSearch)}`,
    );

    console.log(
      `------------------------------------------------------------------------`,
    );

    // Step 2 Create the Rules
    // leverage returned productIds from Step 1
    let uniqueContextsURLEquivalentToBaseURL = 0;
    let rulesCreated = 0;
    let existingRules = 0;
    const preExistingRules = [];
    const failedRules = [];

    // Building up object array with computed properties for unique 'customerId:siteId:appName' keys
    // the value is the url and productId from created products only for urls different to base
    const uniqueContextAndAppArray: {
      [uniqueContextAndApp: string]: {
        url: string;
        productId: number;
      };
    }[] = [];

    if (_.isEmpty(createdProducts)) {
      console.log(`No new web view products were created.`);
      return;
    }

    _.map(sortedCacApps, (cacApp) => {
      // Step 2.a
      // compare sortedCacApps to createdProducts array; match on
      // application name equivalence and extract productId for rule
      const product: Product = _.find(
        createdProducts,
        (createdProduct) => createdProduct.meta.name === cacApp.application,
      );

      if (!product) return;

      // Step 2.b
      // check unique context csv entry's url against the associated product's
      // base url. If equivalent, return and skip rule creation. However if the
      // url value differs from the base product webViewUrl, proceed
      if (product.meta.webViewUrl === cacApp.url.trim()) {
        uniqueContextsURLEquivalentToBaseURL++;
        return;
      }

      const contextAndAppName =
        `${cacApp.customer_id}:${cacApp.site_id}:${cacApp.application}`.trim();

      const existingEntryForContext = uniqueContextAndAppArray.find(
        (object) => {
          Object.keys(object)[0] === contextAndAppName;
        },
      );
      if (existingEntryForContext) return;

      uniqueContextAndAppArray.push({
        [contextAndAppName]: { url: cacApp.url, productId: product.productId },
      });
    });

    await Bluebird.map(
      uniqueContextAndAppArray,
      async (contextAndApp) => {
        // split string into an array of strings by specific character
        const customerId = Object.keys(contextAndApp)[0].split(':')[0];
        const siteId = Object.keys(contextAndApp)[0].split(':')[1];
        const appName = Object.keys(contextAndApp)[0].split(':')[2];
        const productId =
          contextAndApp[Object.keys(contextAndApp)[0]].productId;

        // Check to see if a WebView rule already exists for context/app
        const customerSiteRule = await this.ruleDao.find({
          by: {
            customerId,
            ...(siteId &&
              siteId.toLocaleLowerCase() !== 'default' && { siteId }),
            productId,
            type: RuleType.ProductWebView,
            productTypeId: 'webView',
          },
          pageSize: 1,
        });

        if (!_.isEmpty(customerSiteRule)) {
          preExistingRules.push(customerSiteRule);
          existingRules++;
          return;
        }

        // Create new webView rule
        const webViewRule: Rule = {
          customerId,
          ...(siteId && siteId.toLocaleLowerCase() !== 'default' && { siteId }),
          productTypeId: 'webView',
          name: `Rule for ${appName}`,
          type: RuleType.ProductWebView,
          productId,
          clauses: {},
          action: {
            meta: {
              effectiveUrl: contextAndApp[Object.keys(contextAndApp)[0]].url,
              effectiveDisplayPriority: 100,
            },
          },
          enabled: true,
        };
        if (this.exec) {
          try {
            await this.ruleDao.create(webViewRule, {
              apiKey: 'WebView Rule Migration',
            });
            rulesCreated++;
          } catch (e) {
            failedRules.push(webViewRule);
            console.log(e.message);
          }
        }
      },
      { concurrency: 3 },
    );

    console.log(
      `------------------------------------------------------------------------`,
    );
    console.log(`Rules created: ${rulesCreated}`);
    console.log(`Number of contexts with Existing Rules: ${existingRules}`);
    console.log(
      `The existing rules found: ${JSON.stringify(preExistingRules)}`,
    );
    console.log(
      `Number of Rules Attempted: ${uniqueContextAndAppArray.length}`,
    );
    console.log(
      `Rules skipped because context url is equivalent to base: ${uniqueContextsURLEquivalentToBaseURL}`,
    );
    console.log(`Rules that failed: ${JSON.stringify(failedRules)}`);
    console.log(
      `------------------------------------------------------------------------`,
    );
  }

  private async readCsvFile<T>(
    filePath: string,
    returnArray: false,
  ): Promise<undefined>;
  private async readCsvFile<T>(
    filePath: string,
    returnArray: true,
  ): Promise<T[]>;
  private async readCsvFile<T>(filePath: string, returnArray: boolean) {
    // Parse options
    const parseParam = {
      headers: true,
      delimiter: ',',
      quote: '"',
      escape: '"',
      ignoreEmpty: true,
      discardUnmappedColumns: true,
    };
    const resultArray: T[] = [];

    // get stream
    const fileStream = fs.createReadStream(filePath);

    let total: number | undefined;
    let counter = 0;
    await new Promise((resolve, reject) => {
      fileStream
        .on('error', (error) => {
          console.log(`Read stream error: ${error.message}`);
          console.log(JSON.stringify(error));
          return reject(error);
        })
        .pipe(csv.parse(parseParam))
        .on('data', async (row: T) => {
          if (row) {
            counter += 1;
            if (returnArray) {
              resultArray.push(row);
            }
          }
        })
        .on('end', (rowCount: number) => {
          total = rowCount;
          resolve(returnArray);
          console.log(`Total rows fom CSV: ${rowCount}`);
        });
    });
    if (returnArray) {
      return resultArray;
    }
    return undefined;
  }
}

export default function main(args: any): Promise<void> {
  console.log('start');
  CatalogService.bindAll();

  return new CreateWebViewAppsAndRules(args).execute().then(() => {
    Container.get(Postgres).end();
  });
}

if (require.main === module) {
  const args = yargs
    .option('filepath', {
      alias: 'f',
      description: 'File containing csv file',
      default: './db/manual/webView_apps_and_rules.csv',
      type: 'string',
      demand: false,
    })
    .option('env', {
      alias: 'e',
      description: 'Env to use',
      default: 'dev',
      type: 'string',
      demand: false,
    })
    .option('exec', {
      alias: 'ex',
      description: 'To create db records or not',
      default: false,
      type: 'boolean',
      demand: false,
    }).argv;

  main(args).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

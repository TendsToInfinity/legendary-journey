import { Postgres } from '@securustablets/libraries.postgres';
import { _ } from '@securustablets/libraries.utils';
import * as Bluebird from 'bluebird';
import { Container, Inject } from 'typescript-ioc';
import * as yargs from 'yargs';
import { CatalogService } from '../../src/CatalogService';
import { Product } from '../../src/controllers/models/Product';
import { ProductDao } from '../../src/data/PGCatalog/ProductDao';
import { ProductManager } from '../../src/lib/ProductManager';

CatalogService.bindAll();

export class ReplaceExistingCacAppsWithWebViews {
  @Inject
  private productDao!: ProductDao;

  @Inject
  private productManager!: ProductManager;

  private removeCac: boolean;

  private addHubApp: boolean;

  private exec: boolean;

  private customers: string[];

  constructor(args) {
    this.removeCac = args.removeCac;
    this.addHubApp = args.addHubApp;
    this.exec = args.exec;
    this.customers = args.customers;
  }

  public async execute() {
    let customerIdsWithNoPackages = 0;
    const listOfCustomerIdsWithNoPackages: string[] = [];

    await Bluebird.map(
      this.customers,
      async (customerId) => {
        console.log(`Processing customer: ${customerId}`);

        // Step 1
        // Query for all tabletPackages for that customer
        const tabletPackages = await this.productDao.find({
          contains: {
            document: {
              filter: {
                customerId: [customerId],
              },
              productTypeId: 'tabletPackage',
            },
            pageSize: 1,
          },
        });

        if (_.isEmpty(tabletPackages)) {
          customerIdsWithNoPackages++;
          listOfCustomerIdsWithNoPackages.push(customerId);
          return;
        }

        // Step 2: Map -> Call findProduct on each tabletPackage with resolve flag
        await Bluebird.map(
          tabletPackages,
          async (pkg) => {
            let webViewHubApp: Product[] = [];
            let totalTabletPackagesAttempted = 0;
            let totalTabletPackagesSucceeded = 0;
            let newPackageChildProductIds: number[] = [];
            const updatedTabletPackages: number[] = [];
            const failedTabletPackageUpdates: Product[] = [];
            const cacProductsToRemoveFromPackage: number[] = [];
            // if the tabletPackage's webViews array already has productIds in it,
            // we don't want to overwrite the array values on rerun; append to it
            const webViewsToBeAddedToTabletPackage: number[] = pkg.webViews
              ?.length
              ? [...pkg.webViews]
              : [];
            const listOfCACAppsWithNoMatchingWebViewFound: Product[] = [];
            const tabletPackageWithChildren =
              await this.productManager.findOneByProductIdOrFail(
                pkg.productId,
                true,
              );

            // Step 3: Create a list of all webView hub products that need to be added to the tabletPackage.
            // Matching webView products to cacs by androidClass to webView field 'packageName'. Return
            // and collect those webView productIds to be added to the tabletPackage webViews array.

            // we only need to map the cac app children of the tabletPackage - filter out all non cac app children
            const onlyCacTabletPackageChildren: Product[] =
              tabletPackageWithChildren.childProducts?.filter((childProduct) =>
                childProduct.meta.androidClass?.includes(
                  'net.securustech.sv.cac',
                ),
              ) ?? [];

            // if there are no cac apps to process for this tabletPackage and addHubApp is false, return
            if (_.isEmpty(onlyCacTabletPackageChildren) && !this.addHubApp) {
              console.log(
                `Not proceeding with the update because there are no cac apps to process and addHubApp is false`,
              );
              return;
            }

            await Bluebird.map(
              onlyCacTabletPackageChildren,
              async (childCACProduct) => {
                // retrieve the product id of a matching webView product on androidClass === packageName equivalence
                const matchingWebViews: Product[] =
                  await this.productManager.find({
                    contains: {
                      document: {
                        meta: {
                          packageName: childCACProduct.meta.androidClass,
                        },
                        productTypeId: 'webView',
                      },
                      pageSize: 1,
                    },
                  });

                if (_.isEmpty(matchingWebViews)) {
                  listOfCACAppsWithNoMatchingWebViewFound.push(childCACProduct);
                  return;
                }
                cacProductsToRemoveFromPackage.push(childCACProduct.productId);
                // only add if not there; no dupes
                !webViewsToBeAddedToTabletPackage.includes(
                  matchingWebViews[0].productId,
                )
                  ? webViewsToBeAddedToTabletPackage.push(
                      matchingWebViews[0].productId,
                    )
                  : undefined;
              },
              { concurrency: 3 },
            );

            // if webViewsToBeAddedToTabletPackage is empty and addHubApp is false, skip update
            if (
              _.isEmpty(webViewsToBeAddedToTabletPackage) &&
              !this.addHubApp
            ) {
              console.log(
                `Not proceeding with the update because no webview products were found and addHubApp is false`,
              );
              return;
            }

            // logic will still do the update even if there are no new web views to add
            // so that any remaining cac/s can be removed from the childProductIds array or the web view hub can be added
            // If remove is set then remove the existing cac child productIds from the tabletPackage
            newPackageChildProductIds = this.removeCac
              ? pkg.childProductIds.filter(
                  (cacChild) =>
                    !cacProductsToRemoveFromPackage.includes(cacChild),
                )
              : pkg.childProductIds;

            // Step 3.5: If hubApp is set to true, add to new children for tabletPackage
            if (this.addHubApp) {
              webViewHubApp = await this.productManager.find({
                contains: {
                  document: {
                    meta: {
                      androidClass: 'net.securustech.unity.webapphub',
                    },
                    productTypeId: 'apk',
                  },
                  pageSize: 1,
                },
              });

              if (_.isEmpty(webViewHubApp)) {
                console.log(
                  `------------------------------------------------------------------------`,
                );
                console.log(
                  `addHubApp option is true but Web View hub product not found in db`,
                );
              } else {
                // only add the web view hub app if it's not already there; no dupes
                !newPackageChildProductIds.includes(webViewHubApp[0].productId)
                  ? newPackageChildProductIds.push(webViewHubApp[0].productId)
                  : undefined;
              }
            }

            // Step 4: Call to update each tabletPackage with the webView hub products
            // &&
            // Step 5: If remove is set then remove the existing cac products from the tabletPackage
            try {
              if (this.exec) {
                await this.productDao.update(
                  tabletPackageWithChildren.productId,
                  {
                    ...pkg,
                    webViews: webViewsToBeAddedToTabletPackage,
                    childProductIds: newPackageChildProductIds,
                  },
                  {
                    apiKey: 'Migration replace CACs with webView products',
                  },
                );
              }
              totalTabletPackagesSucceeded++;
              updatedTabletPackages.push(tabletPackageWithChildren.productId);
            } catch (e) {
              failedTabletPackageUpdates.push(pkg);
              console.log(e.message);
            }
            totalTabletPackagesAttempted++;

            console.log(
              `-------------------------TABLET PACKAGE LEVEL INFO---------------------------`,
            );
            console.log(`Processing tabletPackage: ${pkg.meta.name}`);
            console.log(
              `${listOfCACAppsWithNoMatchingWebViewFound.length} CAC apps with no matching webView product found for tabletPackage: ${pkg.meta.name}`,
            );
            console.log(
              `${totalTabletPackagesAttempted} tablet package updates attempted for customer: ${customerId}`,
            );
            console.log(
              `${totalTabletPackagesSucceeded} tablet package updates succeeded for customer: ${customerId}`,
            );
            console.log(
              `These Tablet Package Products: ${updatedTabletPackages.map((x) => x)} updated successfully for customer: ${customerId}`,
            );
            console.log(
              `${failedTabletPackageUpdates.length} tabletPackage updates Failed for customer: ${customerId}`,
            );
            console.log(
              `------------------------------------------------------------------------`,
            );
          },
          { concurrency: 3 },
        );
      },
      { concurrency: 3 },
    );
    console.log(
      `----------------------CUSTOMERS LEVEL INFO---------------------------`,
    );
    console.log(
      `Number of customerIds with no packageIds found: ${customerIdsWithNoPackages}`,
    );
    console.log(
      `CustomerIds with no tabletPackages found: ${listOfCustomerIdsWithNoPackages.map((x) => x)}`,
    );
    console.log(
      `------------------------------------------------------------------------`,
    );
  }
}

export default function main(args: any): Promise<void> {
  console.log('start');
  CatalogService.bindAll();

  return new ReplaceExistingCacAppsWithWebViews(args).execute().then(() => {
    Container.get(Postgres).end();
  });
}

if (require.main === module) {
  const args = yargs
    .option('customers', {
      alias: 'c',
      description: 'Which customers to process',
      type: 'array',
      string: true,
      demandOption: true,
    })
    .option('removeCac', {
      alias: 'r',
      description: 'To remove cac apps or not',
      default: false,
      type: 'boolean',
      demand: false,
    })
    .option('exec', {
      alias: 'ex',
      description: 'To execute against the db or not',
      default: false,
      type: 'boolean',
      demand: false,
    })
    .option('addHubApp', {
      alias: 'hub',
      description: 'To add web view hub or not',
      default: false,
      type: 'boolean',
      demand: false,
    }).argv;

  main(args).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

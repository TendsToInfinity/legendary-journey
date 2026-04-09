/* tslint:disable:no-console */
import { Postgres } from '@securustablets/libraries.postgres';
import { _ } from '@securustablets/libraries.utils';
import * as Bluebird from 'bluebird';
import { Container, Inject } from 'typescript-ioc';
import { CatalogService } from '../../src/CatalogService';
import { ProductStatus } from '../../src/controllers/models/Product';
import { RuleType } from '../../src/controllers/models/Rule';
import { ProductDao } from '../../src/data/PGCatalog/ProductDao';
import { RuleDao } from '../../src/data/PGCatalog/RuleDao';

CatalogService.bindAll();

export class CreateGameRules {
  @Inject
  private productDao!: ProductDao;

  @Inject
  private ruleDao!: RuleDao;

  public async run(): Promise<void> {
    // Get all active tablet packages
    let packageProducts = await this.productDao.find({
      contains: {
        document: {
          status: ProductStatus.Active,
          productTypeId: 'tabletPackage',
        },
      },
      customClauses: [
        { clause: `document->'filter'->'customerId' IS NOT NULL`, params: [] },
      ],
      pageSize: Number.MAX_SAFE_INTEGER,
    });

    // Get jp5 product
    const jp5product = await this.productDao.find({
      contains: {
        document: {
          meta: {
            modelNumber: 'jp5',
          },
          productTypeId: 'device',
        },
      },
      pageSize: 1,
    });

    // Create a list of one package per customer
    packageProducts = _.uniqBy(
      packageProducts,
      (product) => product.filter.customerId[0],
    );

    let rulesCreated = 0;
    let existingRules = 0;
    const failedCustomers = [];

    await Bluebird.map(
      packageProducts,
      async (packageProduct) => {
        // Check to see if a Game Availability rule already exists
        const customerRule = await this.ruleDao.find({
          by: {
            customerId: packageProduct.filter.customerId[0],
            type: RuleType.ProductAvailability,
            productTypeId: 'game',
          },
          pageSize: 1,
        });
        if (!_.isEmpty(customerRule)) {
          existingRules++;
          return;
        }

        // Check to see if this package contains the jp5 productId, assign compatibilityType to jp5 if found, jp6 if not
        const compatibilityType =
          packageProduct.childProductIds.indexOf(jp5product[0].productId) === -1
            ? 'jp6'
            : 'jp5';

        // Create new game rule that requires source.verified to be true and only allows compatible games to be shown based on device type
        const gameRule = {
          customerId: packageProduct.filter.customerId[0],
          siteId: null,
          productTypeId: 'game',
          name: 'Verified Games',
          type: RuleType.ProductAvailability,
          clauses: {
            meta: {
              compatibility: [compatibilityType],
            },
            source: {
              verified: true,
            },
          },
          action: { available: true },
          enabled: true,
        };
        try {
          await this.ruleDao.create(gameRule, {
            apiKey: 'Game Rule Migration',
          });
        } catch (e) {
          failedCustomers.push(packageProduct.filter.customerId[0]);
          console.log(e.message);
        }
        rulesCreated++;
      },
      { concurrency: 3 },
    );

    console.log(
      `------------------------------------------------------------------------`,
    );
    console.log(`Rules created: ${rulesCreated}`);
    console.log(
      `Number of Customers With Existing Rules: ${packageProducts.length}`,
    );
    console.log(`Number of Customers Attempted: ${packageProducts.length}`);
    console.log(
      `------------------------------------------------------------------------`,
    );
  }
}

const gameRuleCreation = new CreateGameRules();
gameRuleCreation.run().then(() => {
  Container.get(Postgres).end();
});

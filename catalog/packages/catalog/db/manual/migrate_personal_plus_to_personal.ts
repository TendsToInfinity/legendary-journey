import { MessagingManager } from '@securustablets/libraries.messaging';
import { Postgres } from '@securustablets/libraries.postgres';
import { Container, Inject } from 'typescript-ioc';
import { CatalogService } from '../../src/CatalogService';
import { PackageType } from '../../src/controllers/models/Package';
import { ProductManager } from '../../src/lib/ProductManager';
import { AuditContext } from '../../src/lib/models/AuditContext';
import { MessagingConfig } from '../../src/messaging/MessagingConfig';

CatalogService.bindAll();

export class MigratePersonalPlusToPersonal {
  @Inject
  private messagingConfig!: MessagingConfig;

  @Inject
  private productMan!: ProductManager;

  public async run(): Promise<void> {
    await this.messagingConfig.registerAndStart();

    console.log(
      'Starting migration of personal+ tablet packages to personal tablet packages',
    );
    const personalPlusTabletPackages = await this.productMan.find({
      contains: {
        document: {
          productTypeId: 'tabletPackage',
          meta: {
            type: 'personal+', // PackageType.PersonalPlus
          },
        },
      },
    });

    const securityContext = {
      reason: 'Migrate tablet packages from personalPlus to personal',
      source: 'MigratePersonalPlusToPersonal',
    } satisfies AuditContext;

    const stats = {
      packagesToUpdate: personalPlusTabletPackages.length,
      packagesUpdated: 0,
      productIdsUpdated: [],
    };

    for (const personalPlusTabletPackage of personalPlusTabletPackages) {
      const personalTabletPackage =
        await this.productMan.findOneByProductIdOrFail(
          personalPlusTabletPackage.productId,
          true,
        );
      personalTabletPackage.meta.type = PackageType.Personal;
      await this.productMan.updateProduct(
        personalTabletPackage,
        securityContext,
      );
      stats.packagesUpdated++;
      stats.productIdsUpdated.push(personalTabletPackage.productId);
    }

    console.log(
      `------------------------------------------------------------------------`,
    );
    console.log(stats);
    console.log(
      `------------------------------------------------------------------------`,
    );
  }
}

const migratePersonalPlusToPersonal = new MigratePersonalPlusToPersonal();
migratePersonalPlusToPersonal.run().then(() => {
  Container.get(Postgres).end();
  Container.get(MessagingManager).shutdown();
});

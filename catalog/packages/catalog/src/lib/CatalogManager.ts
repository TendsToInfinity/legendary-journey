import {
  CacheContainer,
  Csi,
  MethodCache,
} from '@securustablets/libraries.cache';
import { FindOptions } from '@securustablets/libraries.postgres';
import { _ } from '@securustablets/libraries.utils';
import * as Bluebird from 'bluebird';
import { Exception } from 'securus.tablets.libraries.exceptions';
import { Container, Inject, Singleton } from 'typescript-ioc';
import { Launcher } from '../controllers/models/Launcher';
import { LegacyApk } from '../controllers/models/LegacyApk';
import { Package } from '../controllers/models/Package';
import { PricedProduct, Product } from '../controllers/models/Product';
import { ApplicationConfigDao } from '../data/ESCatalog/ApplicationConfigDao';
import { AppConfig } from '../utils/AppConfig';
import { ProductManager } from './ProductManager';

@Singleton
@CacheContainer(Csi.Tier1, {
  secondsToLive: Container.get(AppConfig).cache.ttlShort,
})
@CacheContainer(Csi.Tier3, {
  secondsToLive: Container.get(AppConfig).cache.ttlMedium,
})
export class CatalogManager {
  private static APK_PRODUCT_TYPE_ID = 'apk';
  private static TABLET_PACKAGE_PRODUCT_TYPE_ID = 'tabletPackage';

  @Inject
  private productManager!: ProductManager;
  @Inject
  protected _applicationConfigDao!: ApplicationConfigDao;

  @MethodCache(Csi.Tier1, {
    secondsToLive: Container.get(AppConfig).cache.ttlLong,
  })
  public async getLauncherConfig(
    defaultWorkspace?: boolean,
  ): Promise<Launcher> {
    return this._applicationConfigDao.getLauncherConfig(defaultWorkspace);
  }

  @MethodCache(Csi.Tier1)
  @MethodCache(Csi.Tier3)
  public async findApplicationById(applicationId: string): Promise<LegacyApk> {
    if (_.isNaN(Number(applicationId))) {
      const rawProduct = await this.productManager.findOne({
        customClauses: [
          {
            clause: `document->'meta'->>'androidClass' = $1`,
            params: [applicationId],
          },
          {
            clause: `document->>'productTypeId' = $1`,
            params: [CatalogManager.APK_PRODUCT_TYPE_ID],
          },
        ],
      });
      if (!rawProduct) {
        throw Exception.NotFound({
          errors: `No application exists with application Id = ${applicationId}`,
        });
      }
      applicationId = rawProduct.productId.toString();
    }
    const product = await this.productManager.findOneByProductIdOrFail(
      parseInt(applicationId, 10),
      true,
    );

    return this.productToApk(product);
  }

  @MethodCache(Csi.Tier1)
  @MethodCache(Csi.Tier3)
  public async findAllApplications(): Promise<LegacyApk[]> {
    const options: FindOptions<Product, number> = {
      customClauses: [
        {
          clause: `document->>'productTypeId' = $1`,
          params: [CatalogManager.APK_PRODUCT_TYPE_ID],
        },
      ],
      pageSize: Number.MAX_SAFE_INTEGER,
    };

    const products = await this.productManager.find(options);

    return _.map(products, (product) => this.productToApk(product));
  }

  @MethodCache(Csi.Tier1)
  @MethodCache(Csi.Tier3)
  public async findPackageById(packageId: string): Promise<Package> {
    if (_.isNaN(Number(packageId))) {
      return (
        await this.findPackages({
          customClauses: [
            {
              clause: `document->'source'->>'vendorProductId' = $1`,
              params: [packageId],
            },
          ],
        })
      )[0];
    } else {
      return this.productToPackage(
        await this.productManager.findOneByProductIdOrFail(
          parseInt(packageId, 10),
          true,
        ),
      );
    }
  }

  @MethodCache(Csi.Tier1)
  @MethodCache(Csi.Tier3)
  public async findPackages(
    overrides: Partial<FindOptions<Product, number>>,
  ): Promise<Package[]> {
    const options: FindOptions<Product, number> = _.merge(
      {
        customClauses: [],
        pageSize: Number.MAX_SAFE_INTEGER,
      },
      overrides,
    );
    options.customClauses.push({
      clause: `document->>'productTypeId' = $1`,
      params: [CatalogManager.TABLET_PACKAGE_PRODUCT_TYPE_ID],
    });

    const products = await this.productManager.find(options);
    const packages = await Bluebird.map(products, (product: Product) =>
      this.productManager.findOneByProductIdOrFail(product.productId, true),
    );

    return packages.map((p) => this.productToPackage(p));
  }

  @MethodCache(Csi.Tier1)
  @MethodCache(Csi.Tier3)
  public async findPackageProducts(
    overrides: Partial<FindOptions<Product, number>>,
  ): Promise<Product[]> {
    const options: FindOptions<Product, number> = _.merge(
      {
        customClauses: [],
        pageSize: Number.MAX_SAFE_INTEGER,
      },
      overrides,
    );
    options.customClauses.push({
      clause: `document->>'productTypeId' = $1`,
      params: [CatalogManager.TABLET_PACKAGE_PRODUCT_TYPE_ID],
    });

    return this.productManager.find(options);
  }

  public convertSType(sType: string): string {
    switch (sType) {
      case 'st':
        return `{personal}`;
      case 'ot':
        return `{officer}`;
      case 'ft':
        return `{community}`;
      default:
        return undefined;
    }
  }

  private productToPackage(product: PricedProduct): Package {
    const device = _.find(
      product.childProducts,
      (childProduct) => childProduct.fulfillmentType === 'physical',
    );
    const deviceFeatures = _.isNil(device.meta.features)
      ? []
      : _.map(
          Object.entries(device.meta.features).filter((feature) => feature[1]),
          (feature) => feature[0],
        );

    return {
      name: product.meta.name,
      id: product.productId.toString(),
      price: product.purchaseOptions[0].totalPrice,
      description: product.meta.description,
      applications: this.productToApks(product),
      demo: product.meta.demo,
      modelNumber: device.meta.modelNumber,
      type: product.meta.type,
      deviceFeatures,
      filters: product.filter,
    } as Package;
  }

  private productToApks(product: PricedProduct): LegacyApk[] {
    if (product.productTypeId === CatalogManager.APK_PRODUCT_TYPE_ID) {
      return [this.productToApk(product)];
    } else {
      return _.uniqBy(
        _.flatMap(product.childProducts, (cp) => this.productToApks(cp)),
        'id',
      );
    }
  }

  private productToApk(product: Product): LegacyApk {
    return {
      id: product.meta.androidClass,
      packageName: product.meta.androidClass,
      category: product.meta.category,
      name: product.meta.name,
      description: product.meta.description,
      isSystemApp: product.meta.systemApp,
      isPrivileged: product.meta.privilegedApp,
      postInstallCommand: product.postInstallCommand,
      allowAppManagement: product.meta.appManagementAllowed,
    } as LegacyApk;
  }
}

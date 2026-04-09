import { _ } from '@securustablets/libraries.utils';
import {
  Get,
  Hidden,
  Path,
  Post,
  Query,
  Response,
  Route,
  Security,
  SuccessResponse,
  Tags,
} from 'securus.tablets.external.tsoa';
import { Exception } from 'securus.tablets.libraries.exceptions';
import { Inject, Singleton } from 'typescript-ioc';
import { CatalogManager } from '../lib/CatalogManager';
import { Launcher } from './models/Launcher';
import { LegacyApk } from './models/LegacyApk';
import { Package } from './models/Package';
import { Product, ProductStatus } from './models/Product';

@Singleton
@Route('catalog')
@Tags('Catalog')
export class CatalogController {
  @Inject
  private catalogManager!: CatalogManager;

  /**
   * Returns all packages available for this customer
   *
   * @param {string} customerId The customerId of the customer
   * @returns {Promise<Package[]>}
   */
  @SuccessResponse('200', 'OK')
  @Response('404', 'Packages Not Found For Customer', {
    errors: ['No packages exist for customer with customer Id = custId'],
  })
  @Response('500', 'Internal Server Error', {
    errors: ['Internal Server Error'],
  })
  @Hidden
  @Get('packages/customers/{customerId}')
  public getPackagesByCustomer(@Path customerId: string): Promise<Package[]> {
    return this.catalogManager.findPackages({
      customClauses: [
        {
          clause: `document->'filter'->'customerId' IS NULL OR document->'filter'->'customerId' ? $1`,
          params: [customerId],
        },
        { clause: `document->>'status' = $1`, params: [ProductStatus.Active] },
      ],
    });
  }

  /**
   * Returns all tablet packages available for this customer
   * Temporary solution until opensearch api is updated to support empty filters.
   * Example: I need all packages filtered by customerId AND packages with no customerID (typically officer)
   *
   * @param {string} customerId The customerId of the customer
   * @returns {Promise<Package[]>}
   */
  @SuccessResponse('200', 'OK')
  @Response('404', 'Packages Not Found For Customer', {
    errors: ['No packages exist for customer with customer Id = custId'],
  })
  @Response('500', 'Internal Server Error', {
    errors: ['Internal Server Error'],
  })
  @Security('apiKey')
  @Security('corpJwt')
  @Get('packages/customers/{customerId}/products')
  public getPackageProductsByCustomer(
    @Path customerId: string,
  ): Promise<Product[]> {
    return this.catalogManager.findPackageProducts({
      customClauses: [
        {
          clause: `
          document->'filter'->'customerId' IS NULL 
            OR document->'filter'->'customerId' = '[]'::jsonb 
            OR document->'filter'->'customerId' ? $1`,
          params: [customerId],
        },
        { clause: `document->>'status' = $1`, params: [ProductStatus.Active] },
      ],
    });
  }

  /**
   * Gets a package with the provided Id
   *
   * @param {string} packageId The id of the package
   * @returns {Promise<Package>}
   */
  @SuccessResponse('200', 'OK')
  @Response('404', 'Package Not Found', {
    errors: ['No package exists with package Id = pkgId'],
  })
  @Response('500', 'Internal Server Error', {
    errors: ['Internal Server Error'],
  })
  @Hidden
  @Get('packages/{packageId}')
  public async getPackageById(@Path packageId: string): Promise<Package> {
    const result = await this.catalogManager.findPackageById(packageId);
    if (_.isUndefined(result)) {
      throw Exception.NotFound({
        errors: `No package exists with package Id = ${packageId}`,
      });
    }

    return result;
  }

  /**
   * Returns all applications available for customer provided as a query string
   * If no customer Id is provided, get all applications
   *
   * @param {string} customerId The customerId of the customer
   * @returns {Promise<LegacyApk[]>}
   */
  @SuccessResponse('200', 'OK')
  @Response('500', 'Internal Server Error', {
    errors: ['Internal Server Error'],
  })
  @Hidden
  @Get('applications')
  public async getApplicationsByFilter(
    @Query customerId?: string,
    @Query siteId?: string,
    @Query('stype') sType?: string,
    @Query channel?: string,
    @Query hardwareType?: string,
  ): Promise<LegacyApk[]> {
    let applications: LegacyApk[];
    if (customerId) {
      const packages = await this.catalogManager.findPackages({
        customClauses: [
          {
            clause: `document->>'status' = $1`,
            params: [ProductStatus.Active],
          },
          {
            clause: `document->'filter'->'customerId' IS NULL OR document->'filter'->'customerId' ? $1`,
            params: [customerId],
          },
          ...(siteId
            ? [
                {
                  clause: `document->'filter'->'siteId' IS NULL OR document->'filter'->'siteId' ? $1`,
                  params: [siteId],
                },
              ]
            : []),
          ...(channel
            ? [
                {
                  clause: `document->'filter'->'channel' IS NULL OR document->'filter'->'channel' ? $1`,
                  params: [channel],
                },
              ]
            : []),
          ...(sType
            ? [
                {
                  clause: `document->'meta'->'type' IS NULL OR document->'meta'->>'type' = ANY ($1)`,
                  params: [this.catalogManager.convertSType(sType)],
                },
              ]
            : []),
        ],
      });
      applications = _.uniqBy(_.flatMap(packages, 'applications'), 'id');
    } else {
      applications = await this.catalogManager.findAllApplications();
    }

    return applications;
  }

  /**
   * Gets an application with the provided Id
   *
   * @param {string} applicationId - The id of the application
   * @returns {Promise<LegacyApk>}
   */
  @SuccessResponse('200', 'OK')
  @Response('404', 'Application Not Found', {
    errors: ['No application exists with application Id = appId'],
  })
  @Response('500', 'Internal Server Error', {
    errors: ['Internal Server Error'],
  })
  @Hidden
  @Get('applications/{applicationId}')
  public getApplicationsById(@Path applicationId: string): Promise<LegacyApk> {
    return this.catalogManager.findApplicationById(applicationId);
  }

  /**
   * Gets the current application launcher config
   *
   * @returns {Promise<Launcher>}
   */
  @SuccessResponse('200', 'OK')
  @Hidden
  @Post('launcher')
  public postLauncherConfig(
    @Query defaultWorkspace?: boolean,
  ): Promise<Launcher> {
    return this.catalogManager.getLauncherConfig(defaultWorkspace);
  }

  /**
   * Gets the current application launcher config
   *
   * @returns {Promise<Launcher>}
   */
  @SuccessResponse('200', 'OK')
  @Hidden
  @Get('launcher')
  public getLauncherConfig(): Promise<Launcher> {
    return this.catalogManager.getLauncherConfig();
  }
}

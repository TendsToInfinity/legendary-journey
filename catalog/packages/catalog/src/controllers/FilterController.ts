import { Valid } from 'securus.libraries.expressApi';
import {
  Body,
  Hidden,
  Post,
  Response,
  Route,
  SuccessResponse,
  Tags,
} from 'securus.tablets.external.tsoa';
import { Exception } from 'securus.tablets.libraries.exceptions';
import { Inject, Singleton } from 'typescript-ioc';
import { CatalogManager } from '../lib/CatalogManager';
import { Filter } from './models/Filter';
import { Package } from './models/Package';
import { ProductStatus } from './models/Product';

@Singleton
@Route('catalog')
@Tags('Filter')
export class FilterController {
  @Inject
  private catalogManager!: CatalogManager;

  /**
   * Gets all packages from catalog by filter
   *
   * @returns {Bluebird<Package[]>}
   */
  @SuccessResponse('200', 'OK')
  @Response('400', 'Invalid Filter', {
    errors: [
      {
        property: 'filter',
        message: 'requires property "customerId"',
        schema: '/Filter',
        instance: {},
        name: 'required',
        argument: 'customerId',
        stack: 'filter requires property "customerId"',
      },
    ],
  })
  @Hidden
  @Post('packages/filter')
  public async getPackagesByFilter(
    @Body @Valid('Filter') filter: Filter,
  ): Promise<Package[]> {
    if (!filter.customerId) {
      throw Exception.InvalidData({
        errors: 'Invalid Filter! Filter must contain a customerId',
      });
    }

    return this.catalogManager.findPackages({
      customClauses: [
        { clause: `document->>'status' = $1`, params: [ProductStatus.Active] },
        {
          clause: `document->'filter'->'customerId' IS NULL OR document->'filter'->'customerId' ? $1`,
          params: [filter.customerId],
        },
        ...(filter.siteId
          ? [
              {
                clause: `document->'filter'->'siteId' IS NULL OR document->'filter'->'siteId' ? $1`,
                params: [filter.siteId],
              },
            ]
          : []),
        ...(filter.channel
          ? [
              {
                clause: `document->'filter'->'channel' IS NULL OR document->'filter'->'channel' ? $1`,
                params: [filter.channel],
              },
            ]
          : []),
        ...(filter.stype
          ? [
              {
                clause: `document->'meta'->'type' IS NULL OR document->'meta'->>'type' = ANY ($1)`,
                params: [this.catalogManager.convertSType(filter.stype)],
              },
            ]
          : []),
      ],
    });
  }
}

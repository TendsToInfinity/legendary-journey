import { Csi, MethodCache } from '@securustablets/libraries.cache';
import { SvSecurityContext } from '@securustablets/libraries.httpsecurity';
import * as express from 'express';
import { Valid } from 'securus.libraries.expressApi';
import {
  Body,
  Delete,
  Get,
  Path,
  Post,
  Put,
  Request,
  Response,
  Route,
  Security,
  SecurityContext,
  SuccessResponse,
  Tags,
} from 'securus.tablets.external.tsoa';
import { Exception } from 'securus.tablets.libraries.exceptions';
import { Container, Inject, Singleton } from 'typescript-ioc';
import { HomepageDao } from '../data/PGCatalog/HomepageDao';
import { ExplicitSearchHelper } from '../lib/ExplicitSearchHelper';
import { ProductManager } from '../lib/ProductManager';
import { Paginated } from '../lib/models/Paginated';
import { AppConfig } from '../utils/AppConfig';
import { Homepage } from './models/Homepage';
import { Product } from './models/Product';

@Singleton
@Route('homepage')
@Tags('Homepage')
export class HomepageController {
  @Inject
  private productMan!: ProductManager;
  @Inject
  private homepageDao!: HomepageDao;

  /**
   * Returns homepage search specified by homepageId
   *
   * @param {string} homepageId The ID of the homepage
   * @returns {Homepage}
   */
  @SuccessResponse('200', 'OK')
  @Response('404', 'Homepage Not Found', {
    errors: ['No homepage was found with ID = $homepageId'],
  })
  @Response('500', 'Internal Server Error', {
    errors: ['Internal Server Error'],
  })
  @Security('apiKey')
  @Security('corpJwt')
  @Security('inmateJwt')
  @Get('{homepageId}')
  public findHomepage(@Path homepageId: string): Promise<Homepage> {
    return this.homepageDao.findOneOrFail(parseInt(homepageId, 10));
  }

  /**
   * Returns products for the homepage search specified by homepageId
   *
   * @param {string} homepageId The ID of the homepage
   * @returns {Homepage}
   */
  @SuccessResponse('200', 'OK')
  @Response('404', 'Homepage Not Found', {
    errors: ['No homepage was found with ID = $homepageId'],
  })
  @Response('500', 'Internal Server Error', {
    errors: ['Internal Server Error'],
  })
  @Security('apiKey')
  @Security('corpJwt')
  @Security('inmateJwt')
  @Get('{homepageId}/products')
  public async findHomepageProducts(
    @Request request: express.Request,
    @Path homepageId: string,
    @SecurityContext securityContext: SvSecurityContext,
  ): Promise<Paginated<Product>> {
    const search = (await this.findHomepageOrFail(parseInt(homepageId, 10)))
      .search;
    return this.productMan.search(
      this.productMan.enforceSearchSecurityContext(search, securityContext),
    );
  }

  @MethodCache(Csi.Tier1, {
    secondsToLive: Container.get(AppConfig).cache.ttlShort,
  })
  @MethodCache(Csi.Tier3, {
    secondsToLive: Container.get(AppConfig).cache.ttlMedium,
  })
  private async findHomepageOrFail(homepageId: number) {
    return this.homepageDao.findOneOrFail(homepageId);
  }

  /**
   * Returns homepage searches for the specified productTypeId
   *
   * @param {string} productTypeId The product type to find homepages for
   * @returns {Homepage[]}
   */
  @SuccessResponse('200', 'OK')
  @Response('500', 'Internal Server Error', {
    errors: ['Internal Server Error'],
  })
  @Security('apiKey')
  @Security('corpJwt')
  @Security('inmateJwt')
  @Get('productType/{productTypeId}')
  public findHomepagesByProductType(
    @Path productTypeId: string,
  ): Promise<Homepage[]> {
    return this.homepageDao.find({
      by: { productTypeId },
      orderBy: [{ rank: 'ASC' }, { displayName: 'ASC' }],
    });
  }

  /**
   * Creates a homepage
   *
   * @param homepage
   * @returns {Homepage}
   */
  @SuccessResponse('200', 'OK')
  @Response('500', 'Internal Server Error', {
    errors: ['Internal Server Error'],
  })
  @Security('corpJwt', ['catalogAdmin'])
  @Post('')
  public async createHomepage(
    @Body @Valid('Homepage') homepage: Homepage,
    @SecurityContext securityContext: SvSecurityContext,
  ): Promise<{ homepageId: number }> {
    ExplicitSearchHelper.checkExplicitField(homepage.search);
    return {
      homepageId: await this.homepageDao.create(homepage, securityContext),
    };
  }

  /**
   * Updates homepage specified by homepageId
   *
   * @param {string} homepageId The ID of the homepage
   * @param homepage
   * @returns {Homepage}
   */
  @SuccessResponse('204', 'No Content')
  @Response('400', 'HomepageID mismatch', {
    errors: [
      'Update homepageId $homepageId does not equal homepage payload id $homepage.homepageId',
    ],
  })
  @Response('404', 'Homepage Not Found', {
    errors: ['homepage with ID of $homepageId was not found'],
  })
  @Response('500', 'Internal Server Error', {
    errors: ['Internal Server Error'],
  })
  @Security('corpJwt', ['catalogAdmin'])
  @Put('{homepageId}')
  public async updateHomepage(
    @Path homepageId: string,
    @Body @Valid('Homepage') homepage: Homepage,
    @SecurityContext securityContext: SvSecurityContext,
  ): Promise<void> {
    if (
      !homepage.homepageId ||
      parseInt(homepageId, 10) !== homepage.homepageId
    ) {
      throw Exception.InvalidData({
        errors: `Update homepageId ${homepageId} does not equal homepage payload id ${homepage.homepageId}`,
      });
    }
    ExplicitSearchHelper.checkExplicitField(homepage.search);
    return this.homepageDao.update(
      homepage.homepageId,
      homepage,
      securityContext,
    );
  }

  /**
   * Deletes homepage specified by homepageId
   *
   * @param {string} homepageId The ID of the homepage
   * @returns {Homepage}
   */
  @SuccessResponse('204', 'No Content')
  @Response('500', 'Internal Server Error', {
    errors: ['Internal Server Error'],
  })
  @Security('corpJwt', ['catalogAdmin'])
  @Delete('{homepageId}')
  public deleteHomepage(
    @Path homepageId: string,
    @SecurityContext securityContext: SvSecurityContext,
  ): Promise<void> {
    return this.homepageDao.delete(parseInt(homepageId, 10), securityContext);
  }
}

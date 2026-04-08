import { SvSecurityContext } from '@securustablets/libraries.httpsecurity';
import { _ } from '@securustablets/libraries.utils';
import { Valid } from 'securus.libraries.expressApi';
import {
  Body,
  Get,
  Path,
  Put,
  Query,
  Response,
  Route,
  Security,
  SecurityContext,
  SuccessResponse,
  Tags,
} from 'securus.tablets.external.tsoa';
import { Exception } from 'securus.tablets.libraries.exceptions';
import { Inject, Singleton } from 'typescript-ioc';
import { ProductTypeManager } from '../lib/ProductTypeManager';
import { ProductType } from '../lib/models/ProductType';
import { ProductAggFields } from './models/ProductAggFields';
import { Context } from './models/Search';

@Singleton
@Route('productTypes')
@Tags('ProductTypes')
export class ProductTypeController {
  @Inject
  private productTypeMan!: ProductTypeManager;

  /**
   * Returns productType specified by productTypeId
   *
   * @param {string} productTypeId The ID of the productTypeId
   * @returns {Schema}
   */
  @SuccessResponse('200', 'OK')
  @Response('404', 'ProductType Not Found', {
    errors: ['No product_type was found with ID = $productTypeId'],
  })
  @Response('500', 'Internal Server Error', {
    errors: ['Internal Server Error'],
  })
  @Security('apiKey')
  @Security('corpJwt')
  @Security('inmateJwt')
  @Get('{productTypeId}')
  public async getProductType(
    @Path productTypeId: string,
    @SecurityContext securityContext: SvSecurityContext,
    @Query customerId?: string,
    @Query siteId?: string,
  ): Promise<ProductType> {
    return this.productTypeMan.getProductType(
      productTypeId,
      this.enforceSecurityContext({ customerId, siteId }, securityContext),
    );
  }

  /**
   * Update productType specified by productTypeId
   * Note: Only ProductType.meta is allowed to be updated
   *
   * @param {string} productTypeId The ID of the productTypeId
   * @param {ProductType} productType The new productType that replaces the old one
   * @returns {void}
   */
  @SuccessResponse('204', 'OK')
  @Response('404', 'ProductType Not Found', {
    errors: ['No product_type was found with ID = $productTypeId'],
  })
  @Response('400')
  @Response('500', 'Internal Server Error', {
    errors: ['Internal Server Error'],
  })
  @Security('corpJwt', ['catalogAdmin'])
  @Put('{productTypeId}')
  public async update(
    @Path productTypeId: string,
    @Body @Valid('ProductType') productType: ProductType,
    @SecurityContext securityContext: SvSecurityContext,
  ): Promise<void> {
    const existingProductType = await this.productTypeMan.getProductType(
      productType.productTypeId,
    );
    // if other props are preserved
    const propsToOmit = ['meta', 'version', 'cdate', 'udate'];
    if (
      _.isEqual(
        _.omit(existingProductType, propsToOmit),
        _.omit(productType, propsToOmit),
      )
    ) {
      return this.productTypeMan.update(
        productType.productTypeId,
        { meta: productType.meta },
        securityContext,
      );
    } else {
      throw Exception.InvalidData({
        errors: ['Only updates to "meta" are allowed'],
      });
    }
  }

  /**
   * Returns all productType schemas
   *
   * @returns {Schema[]}
   */
  @SuccessResponse('200', 'OK')
  @Response('500', 'Internal Server Error', {
    errors: ['Internal Server Error'],
  })
  @Security('apiKey')
  @Security('corpJwt')
  @Security('inmateJwt')
  @Get('')
  public async getProductTypes(
    @SecurityContext securityContext: SvSecurityContext,
    @Query customerId?: string,
    @Query siteId?: string,
  ): Promise<ProductType[]> {
    return this.productTypeMan.getProductTypes(
      this.enforceSecurityContext({ customerId, siteId }, securityContext),
    );
  }

  /**
   * Returns productType aggregations for autoComplete fields
   * - ProductTypes have fields that can be marked as autoComplete. These fields will have values based on ProductData and must be queried real time.
   * - Example fields: movie.genre, movie.rating, product.category`
   *
   * @param {string} productTypeId The ID of the productType
   * @returns {ProductAggFields}
   */
  @SuccessResponse('200', 'OK')
  @Response('404', 'ProductType Not Found', {
    errors: ['No product_type was found with ID = $productTypeId'],
  })
  @Response('500', 'Internal Server Error', {
    errors: ['Internal Server Error'],
  })
  @Security('apiKey')
  @Security('corpJwt')
  @Security('inmateJwt')
  @Get('{productTypeId}/aggregations')
  public async getProductTypeAggregations(
    @Path productTypeId: string,
  ): Promise<ProductAggFields> {
    return this.productTypeMan.getProductTypeAggregations(productTypeId);
  }

  private enforceSecurityContext(
    context: Context,
    { inmateJwt }: SvSecurityContext,
  ): Context {
    if (!inmateJwt) {
      return context;
    }

    return _.merge({}, context, {
      enforce: true,
      customerId: inmateJwt.customerId,
      siteId: inmateJwt.siteId,
    });
  }
}

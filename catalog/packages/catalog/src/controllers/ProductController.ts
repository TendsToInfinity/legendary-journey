import {
  InmateJwt,
  SvSecurityContext,
} from '@securustablets/libraries.httpsecurity';
import { JsonSchemaParser } from '@securustablets/libraries.json-schema/dist/src/JsonSchemaParser';
import { Logger } from '@securustablets/libraries.logging';
import { SearchParameters } from '@securustablets/libraries.postgres/dist/src/models/SearchParameters';
import { _ } from '@securustablets/libraries.utils';
import * as Bluebird from 'bluebird';
import * as express from 'express';
import { Response as ApiResponse } from 'express';
import { Valid } from 'securus.libraries.expressApi';
import {
  Body,
  Get,
  HttpResponse,
  Path,
  Post,
  Put,
  Query,
  Request,
  Response,
  Route,
  Security,
  SecurityContext,
  SuccessResponse,
  Tags,
} from 'securus.tablets.external.tsoa';
import { Exception } from 'securus.tablets.libraries.exceptions';
import { Inject, Singleton } from 'typescript-ioc';
import { CloudDistributionManager } from '../lib/CloudDistributionManager';
import { ManualBlocklistManager } from '../lib/ManualBlocklistManager';
import { ProductManager } from '../lib/ProductManager';
import { ProductTypeManager } from '../lib/ProductTypeManager';
import { TokenManager } from '../lib/TokenManager';
import { Paginated } from '../lib/models/Paginated';
import { PurchaseToken } from '../lib/models/PurchaseToken';
import { ProductPublishManager } from '../lib/product/ProductPublishManager';
import { ManualBlockListRequestBody } from './models/BlockAction';
import {
  PricedProduct,
  Product,
  ThumbnailApprovedStatus,
} from './models/Product';
import { Context, Search } from './models/Search';

@Singleton
@Route('products')
@Tags('Products')
export class ProductController {
  @Inject
  private productMan!: ProductManager;

  @Inject
  private productTypeMan!: ProductTypeManager;

  @Inject
  private productPubMan!: ProductPublishManager;

  @Inject
  private tokenMan!: TokenManager;

  @Inject
  private cloudMan!: CloudDistributionManager;

  @Inject
  private logger!: Logger;

  @Inject
  private manualBlocklistManager!: ManualBlocklistManager;

  /**
   * Performs a search of Products.
   * Always better to provide ProductTypeId/ProductId in the post body request.
   * Involving total=true in the request might see a delay in the response than with total=false
   * Order by should be part of the requests, with combination of productTypeId or productId
   * @param search - Standard Catalog Search
   * @param securityContext - One of corpJwt, apiKey, or inmateJwt
   */
  @Security('apiKey')
  @Security('corpJwt')
  @Security('inmateJwt')
  @Security('facilityJwt')
  @Security('facilityJwt:beta')
  @Post('search')
  public searchProducts(
    @Body @Valid('Search') search: Search,
    @SecurityContext securityContext: SvSecurityContext,
  ): Promise<Paginated<Product>> {
    return this.productMan.search(
      this.productMan.enforceSearchSecurityContext(search, securityContext),
    );
  }

  /**
   * Performs a search of Products.
   * Always better to provide ProductTypeId/ProductId in the post body request.
   * Involving total=true in the request might see a delay in the response than with total=false
   * Order by should be part of the requests, with combination of productTypeId or productId
   * @param search - Standard Catalog Search
   * @param productId - The ID of the product subscription
   * @param securityContext - One of corpJwt, apiKey, or inmateJwt
   */
  @SuccessResponse('200', 'OK')
  @Response('404', 'Product Not Found', {
    errors: ['No product was found with ID = $productId'],
  })
  @Response('500', 'Internal Server Error', {
    errors: ['Internal Server Error'],
  })
  @Security('apiKey')
  @Security('corpJwt')
  @Security('inmateJwt')
  @Post('{productId}/search')
  public searchProductsBySubscription(
    @Body @Valid('Search') search: Search,
    @Path productId: string,
    @SecurityContext securityContext: SvSecurityContext,
  ): Promise<Paginated<Product>> {
    return this.productMan.searchProductsBySubscription(
      this.productMan.enforceSearchSecurityContext(search, securityContext),
      productId,
    );
  }

  @SuccessResponse('204', 'No Content')
  @Response('404', 'Product Not Found', {
    errors: ['No product was found with ID = $productId'],
  })
  @Response('500', 'Internal Server Error', {
    errors: ['Internal Server Error'],
  })
  @Security('apiKey')
  @Security('corpJwt', ['catalogAdmin'])
  @Post('{productId}/manualBlock')
  public async blockProduct(
    @Path productId: string,
    @Body body: ManualBlockListRequestBody,
    @SecurityContext securityContext: SvSecurityContext,
  ): Promise<void> {
    const product = await this.productMan.findOneByProductIdOrFail(
      parseInt(productId, 10),
      false,
      securityContext,
    );
    return this.manualBlocklistManager.manualBlocklistProduct(
      product,
      true,
      securityContext,
      body.manuallyBlockedReason,
    );
  }

  @SuccessResponse('204', 'No Content')
  @Response('404', 'Product Not Found', {
    errors: ['No product was found with ID = $productId'],
  })
  @Response('500', 'Internal Server Error', {
    errors: ['Internal Server Error'],
  })
  @Security('apiKey')
  @Security('corpJwt', ['catalogAdmin'])
  @Post('{productId}/manualUnblock')
  public async unblockProduct(
    @Path productId: string,
    @SecurityContext securityContext: SvSecurityContext,
  ): Promise<void> {
    const product = await this.productMan.findOneByProductIdOrFail(
      parseInt(productId, 10),
      false,
      securityContext,
    );
    return this.manualBlocklistManager.manualBlocklistProduct(
      product,
      false,
      securityContext,
    );
  }

  /**
   * Performs a search of Products by vendor data.
   * Required field on a Product can be used as a query term, e.g. ?vendorProductId=1357
   * @param vendorName The Name of Vendor
   * @param vendorProductId The ID of the Vendor Product
   * @param productTypeId The ID of the Product Type
   */
  @SuccessResponse('200', 'OK')
  @Response('404', 'Product Not Found', {
    errors: ['No product was found with Vendor Product ID = $vendorProductId'],
  })
  @Response('500', 'Internal Server Error', {
    errors: ['Internal Server Error'],
  })
  @Security('corpJwt')
  @Security('apiKey')
  @Get('vendor')
  public async getProductByVendor(
    @Query('vendorName') vendorName: string,
    @Query('vendorProductId') vendorProductId: string,
    @Query('productTypeId') productTypeId: string,
  ): Promise<Product> {
    const product = await this.productMan.findOneByVendorProductId(
      vendorProductId,
      vendorName,
      productTypeId,
    );
    if (!product) {
      throw Exception.NotFound({
        errors: [
          `No product was found with Vendor Product ID = ${vendorProductId}`,
        ],
      });
    }
    return product;
  }

  /**
   * Performs a search of Products.
   * Any field on a Product can be used as a query term, e.g. ?productId=1357
   * Including either ProductTypeId or ProductId is always recommended.
   * Order By should only be used along with either "productTypeId" or "productId" in the request
   * total=true, would be tad slower when compared to total=false, so avoid passing true unless necessary.
   * @param request
   * @param pageNumber number [Optional] PageNumber to pull from results, default 0
   * @param pageSize number [Optional] Number of results to pull per page, default 25
   * @param total boolean [Optional] Return a total result count, default false
   * @param orderBy "$field:[asc|desc]" [Optional] An Order field and sortOrder in string format
   * @param productId number [Optional] The Id of the product
   * @param enforce string[true|false] [Optional] Enforce security context, default false
   */
  @SuccessResponse('200', 'OK')
  @Response('500', 'Internal Server Error', {
    errors: ['Internal Server Error'],
  })
  @Security('corpJwt')
  @Security('apiKey')
  @Get()
  public async getProducts(
    @Request request: express.Request,
    @Query('pageNumber') pageNumber?: number,
    @Query('pageSize') pageSize?: number,
    @Query('total') total?: boolean,
    @Query('orderBy') orderBy?: any,
    @Query('productId') productId?: string,
    @Query('enforce') enforce: string = 'false',
  ): Promise<Paginated<Product>> {
    return this.productMan.searchByQueryString(
      request.query as SearchParameters,
    );
  }

  /**
   * Returns product specified by productId
   *
   * @param {string} productId The ID of the product
   * @param {SvSecurityContext} securityContext - One of corpJwt, apiKey, or inmateJwt
   * @param {boolean} resolve - If true return an expanded tree of childProducts for the product, default false
   * @param {boolean} includeSignedUrl - If true return a signedUrl for content retrieval from CDN
   * @param {boolean} enforce - If true enforce product availability rules
   * @param {string} customerId - Optionally restrict to a customer context
   * @param {string} siteId - Optionally restrict to a site context
   * @returns {Product}
   */
  @SuccessResponse('200', 'OK')
  @Response('404', 'Product Not Found', {
    errors: ['No product was found with ID = $productId'],
  })
  @Response('500', 'Internal Server Error', {
    errors: ['Internal Server Error'],
  })
  @Security('apiKey')
  @Security('corpJwt')
  @Security('inmateJwt')
  @Security('facilityJwt')
  @Security('facilityJwt:beta')
  @Get('{productId}(\\d+)')
  public async findProduct(
    @Path productId: string,
    @SecurityContext securityContext: SvSecurityContext,
    @Query resolve?: string,
    @Query includeSignedUrl?: string,
    @Query enforce?: string,
    @Query customerId?: string,
    @Query siteId?: string,
  ): Promise<Product> {
    const searchContext: Context =
      enforce?.toUpperCase() === 'TRUE'
        ? {
            enforce: true,
            customerId,
            siteId,
          }
        : ({} as Context);
    const product = await this.productMan.findOneByProductIdOrFail(
      parseInt(productId, 10),
      resolve?.toUpperCase() === 'TRUE',
      securityContext,
      searchContext,
    );

    if (!(includeSignedUrl?.toUpperCase() === 'TRUE')) {
      return product;
    }

    // failed request if product url is not accessible yet, and includeSignedUrl set to true
    if (!product.source.s3Path) {
      throw Exception.MethodNotAllowed(`Product wasn't downloaded to s3 yet`);
    }

    try {
      product.source.signedUrl = await this.cloudMan.signPathForCloudFront(
        product.source.s3Path,
        product.productTypeId,
      );
    } catch (error) {
      throw Exception.InternalError(
        `Cannot return sign URL. Error: ${error.message}`,
      );
    }
    return product;
  }

  /**
   * Gets webViews for the provided tablet package Id
   *
   * @param {string} packageId The id of the package
   * @returns {Promise<Package>}
   */
  @SuccessResponse('200', 'OK')
  @Response('404', 'WebViews for Package Not Found', {
    errors: ['No web views for package exist with package Id = pkgId'],
  })
  @Response('500', 'Internal Server Error', {
    errors: ['Internal Server Error'],
  })
  @Security('apiKey')
  @Security('corpJwt')
  @Security('inmateJwt')
  @Get('webView/packages/{packageId}')
  public async getWebViewsByPackageId(
    @Path packageId: string,
    @SecurityContext securityContext: SvSecurityContext,
  ): Promise<Product[]> {
    const result = await this.productMan.findWebViewsByPackageId(
      parseInt(packageId, 10),
      securityContext,
    );
    if (_.isEmpty(result)) {
      throw Exception.NotFound({
        errors: `No webViews for package exists with package Id = ${packageId}`,
      });
    }

    return result;
  }

  /**
   * Returns a signed product package for ordering
   *
   * @param {string} productId The ID of the product
   * @param {string} purchaseType The purchase type to have signed
   * @param securityContext - One of corpJwt, apiKey, or inmateJwt
   * @param {ApiResponse} response - The express HTTP Response object
   * @returns {Product}
   */
  @SuccessResponse('200', 'OK')
  @Response('400', 'PurchaseType is invalid', { errors: [] })
  @Response('404', 'Product Not Found', {
    errors: ['No product was found with ID = $productId'],
  })
  @Response('500', 'Internal Server Error', {
    errors: ['Internal Server Error'],
  })
  @Security('inmateJwt')
  @Get('{productId}/{purchaseType}')
  public async getPurchaseToken(
    @Path('productId') productId: string,
    @Path('purchaseType') purchaseType: string,
    @SecurityContext { inmateJwt }: SvSecurityContext,
    @HttpResponse response: ApiResponse,
  ): Promise<void> {
    const product = await this.productMan.findOneByProductIdOrFail(
      parseInt(productId, 10),
      true,
      { inmateJwt },
    );
    const purchaseToken = await this.tokenMan.generateJwt(
      this.buildPurchaseToken(product, purchaseType, inmateJwt),
    );
    this.logger.debug(
      `getPurchaseToken: customerId: ${inmateJwt.customerId}, custodyAccount: ${inmateJwt.custodyAccount}, productId: ${productId}`,
    );
    response.contentType('application/jwt').send(purchaseToken);
  }

  /**
   * Returns a signed subscription product for ordering
   *
   * @param {string} productId The ID of the product subscription
   * @param {string} memberProductId The ID of the subscription product
   * @param {string} purchaseType The purchase type to have signed
   * @param securityContext - One of corpJwt, apiKey, or inmateJwt
   * @param {ApiResponse} response - The express HTTP Response object
   * @returns {Product}
   */
  @SuccessResponse('200', 'OK')
  @Response('400', 'PurchaseType is invalid', { errors: [] })
  @Response('404', 'Product Not Found', {
    errors: ['No product was found with ID = $productId'],
  })
  @Response('500', 'Internal Server Error', {
    errors: ['Internal Server Error'],
  })
  @Security('inmateJwt')
  @Get('{productId}/{memberProductId}/{purchaseType}')
  public async getMemberPurchaseToken(
    @Path productId: string,
    @Path memberProductId: string,
    @Path purchaseType: string,
    @SecurityContext securityContext: SvSecurityContext,
    @HttpResponse response: ApiResponse,
  ): Promise<void> {
    const memberProduct = await this.productMan.findOneByProductIdOrFail(
      parseInt(memberProductId, 10),
      false,
      securityContext,
    );
    if (!_.includes(memberProduct.subscriptionIds, parseInt(productId, 10))) {
      throw Exception.NotFound({
        errors: `The memberProduct: ${memberProductId} does not exist or is not in the subscription: ${productId}`,
      });
    }
    memberProduct.parentProductId = parseInt(productId, 10);
    const purchaseToken = await this.tokenMan.generateJwt(
      this.buildPurchaseToken(
        memberProduct,
        purchaseType,
        securityContext.inmateJwt,
      ),
    );
    response.contentType('application/jwt').send(purchaseToken);
  }

  /**
   * Creates a product
   *
   * @param product
   * @param securityContext - One of corpJwt, apiKey, or inmateJwt
   * @returns {Product}
   */
  @SuccessResponse('200', 'OK')
  @Response('400', 'Product is invalid', { errors: [] })
  @Response('404', 'ProductType Not Found', {
    errors: ['No product_type was found with ID = $productTypeId'],
  })
  @Response('500', 'Internal Server Error', {
    errors: ['Internal Server Error'],
  })
  @Security('apiKey')
  @Security('corpJwt', ['catalogAdmin'])
  @Post('')
  public async createProduct(
    @Body product: Product,
    @SecurityContext securityContext: SvSecurityContext,
  ): Promise<{ productId: number }> {
    const productId = await this.productMan.createProduct(
      product,
      securityContext,
    );
    return { productId };
  }

  /**
   * Updates product specified by productId
   *
   * @param productId
   * @param product
   * @param securityContext - One of corpJwt, apiKey, or inmateJwt
   * @returns {Product}
   */
  @SuccessResponse('204', 'No Content')
  @Response('400', 'Product is invalid', { errors: [] })
  @Response('400', 'ProductID mismatch', {
    errors: [
      'Update productId $productId does not equal product payload id $product.productId',
    ],
  })
  @Response('404', 'ProductType Not Found', {
    errors: ['No product_type was found with ID = $productTypeId'],
  })
  @Response('404', 'Product Not Found', {
    errors: ['Product with ID of $productId was not found'],
  })
  @Response('500', 'Internal Server Error', {
    errors: ['Internal Server Error'],
  })
  @Security('apiKey')
  @Security('corpJwt', ['catalogAdmin'])
  @Put('{productId}')
  public async updateProduct(
    @Path productId: string,
    @Body product: Product,
    @SecurityContext securityContext: SvSecurityContext,
  ): Promise<void> {
    if (
      product.productId &&
      parseInt(productId as any, 10) !== product.productId
    ) {
      throw Exception.InvalidData({
        errors: `Update productId ${productId} does not equal product payload id ${product.productId}`,
      });
    }
    await this.productMan.updateProduct(product, securityContext);
  }

  /**
   * Update thumbnail status specified by productId and approval status
   *
   * @param {string} productId The ID of the product
   * @param status: An object with the single field 'approvalStatus'
   * @param securityContext - One of corpJwt, apiKey, or inmateJwt
   * @returns {Product}
   */
  @SuccessResponse('200', 'OK')
  @Response('404', 'Product Not Found', {
    errors: ['No product was found with ID = $productId'],
  })
  @Response('500', 'Internal Server Error', {
    errors: ['Internal Server Error'],
  })
  @Security('apiKey')
  @Security('corpJwt')
  @Post('{productId}/updateThumbnailStatus')
  public async updateThumbnailStatus(
    @Path productId: string,
    @Body status: { approvalStatus: ThumbnailApprovedStatus },
    @SecurityContext securityContext: SvSecurityContext,
  ): Promise<void> {
    const product = await this.productMan.findOneByProductIdOrFail(
      parseInt(productId, 10),
      true,
      securityContext,
    );

    const thumbnailApprovedStatus: ThumbnailApprovedStatus =
      status.approvalStatus;
    if (
      !_.includes(_.values(ThumbnailApprovedStatus), thumbnailApprovedStatus)
    ) {
      throw Exception.InvalidData({
        errors: [`approvalStatus [${thumbnailApprovedStatus}] is not allowed`],
      });
    }

    try {
      const { jsonSchema } = await this.productTypeMan.getProductType(
        _.get(product, 'productTypeId'),
      );
      new JsonSchemaParser(jsonSchema).getSchema('meta.thumbnailApproved');
    } catch (error) {
      throw Exception.InvalidData({
        errors: [
          `productId [${product.productId}] is not allowed for thumbnail approval`,
        ],
      });
    }
    await this.productMan.updateProductThumbnailStatus(
      product,
      thumbnailApprovedStatus,
      securityContext,
    );

    return;
  }

  /**
   * Update thumbnail status specified by productId and approval status
   *
   * @param {string} productId The ID of the product
   * @param status: An object with the single field 'approvalStatus'
   * @param securityContext - One of corpJwt, apiKey, or inmateJwt
   * @returns {Product}
   */
  @SuccessResponse('204')
  @Response('500', 'Internal Server Error', {
    errors: ['Internal Server Error'],
  })
  @Security('apiKey')
  @Security('corpJwt')
  @Post('updateThumbnailStatusBulk')
  public async updateThumbnailStatusBulk(
    @Body
    body: { approvalStatus: ThumbnailApprovedStatus; productIds: number[] },
    @SecurityContext securityContext: SvSecurityContext,
  ): Promise<void> {
    // verify that the approvalStatus is valid
    const thumbnailApprovedStatus: ThumbnailApprovedStatus =
      body.approvalStatus;
    if (
      !_.includes(_.values(ThumbnailApprovedStatus), thumbnailApprovedStatus)
    ) {
      throw Exception.InvalidData({
        errors: [`approvalStatus [${thumbnailApprovedStatus}] is not allowed`],
      });
    }

    await this.productMan.updateProductThumbnailStatusBulk(
      body.productIds,
      thumbnailApprovedStatus,
      securityContext,
    );

    return;
  }

  /**
   * Manually download a song sample
   *
   * @param {string} productId The ID of the product
   * @param securityContext - One of corpJwt, apiKey
   */
  @SuccessResponse('204')
  @Response('404', 'Product Not Found', {
    errors: ['No product was found with ID = $productId'],
  })
  @Response('500', 'Internal Server Error', {
    errors: ['Internal Server Error'],
  })
  @Security('apiKey')
  @Security('corpJwt')
  @Post('{productId}/downloadSongSample')
  public async downloadSongSample(
    @Path productId: string,
    @SecurityContext securityContext: SvSecurityContext,
  ): Promise<void> {
    const product = await this.productMan.findOneByProductIdOrFail(
      parseInt(productId, 10),
      true,
      securityContext,
    );

    // enqueue product for download
    await this.productPubMan.publishSongSampleDownloadRequest(product);
    return;
  }

  @SuccessResponse('200', 'OK')
  @Response('401', 'Unauthorized')
  @Security('apiKey')
  @Security('corpJwt', ['catalogAdmin'])
  @Get('republish')
  public async republish(
    @Request request: express.Request,
    @SecurityContext context: SvSecurityContext,
  ): Promise<{
    success: Array<Partial<Product>>;
    failure: Array<Partial<Product>>;
  }> {
    request.query.enforce = 'false';

    if (_.get(request, 'query.pageSize') > 5000) {
      throw Exception.InvalidData({
        errors: [
          `PageSize ${request.query.pageSize} is larger than the limit of 5000`,
        ],
      });
    }
    const partialProductFields = [
      'productId',
      'productTypeId',
      'productTypeGroupId',
    ];

    const republishedProductItems: {
      success: Array<Partial<Product>>;
      failure: Array<Partial<Product>>;
    } = {
      success: [],
      failure: [],
    };
    const newData = await this.productMan.searchByQueryString(
      request.query as SearchParameters,
    );

    await Bluebird.map(
      newData.data,
      async (product) => {
        try {
          await this.productPubMan.publishProductMessage(product);
          republishedProductItems.success.push(
            _.pick(product, partialProductFields),
          );
        } catch (error) {
          this.logger.error(
            `Unable to send republish message for ${product.productId}`,
            error,
          );
          republishedProductItems.failure.push(
            _.pick(product, partialProductFields),
          );
        }
      },
      { concurrency: 100 },
    );
    return republishedProductItems;
  }

  private buildPurchaseToken(
    product: PricedProduct,
    purchaseType: string,
    inmateJwt: InmateJwt,
  ): PurchaseToken {
    const purchaseOption = _.find(product.purchaseOptions, {
      type: purchaseType,
    });
    this.logger.debug(
      `buildPurchaseToken: customerId: ${inmateJwt.customerId}, custodyAccount: ${inmateJwt.custodyAccount}, productId: ${product.productId}, purchaseOption: ${purchaseOption}`,
    );
    if (!purchaseOption) {
      throw Exception.InvalidData({
        errors: [
          `purchaseType [${purchaseType}] is not valid for product [${product.productId}]`,
        ],
      });
    }
    const includedProductIds =
      product.childProducts && !_.isEmpty(product.childProducts)
        ? _.map(product.childProducts, (childProduct) => childProduct.productId)
        : undefined;

    if (
      !includedProductIds &&
      product.childProducts &&
      !_.isEmpty(product.childProductIds)
    ) {
      throw Exception.InvalidData({
        errors: [
          `Purchase not available for [${product.productId}] no included products available for parent product`,
        ],
      });
    }

    const purchaseTokenObj = {
      customerId: inmateJwt.customerId,
      siteId: inmateJwt.siteId,
      inmateId: inmateJwt.custodyAccount,
      custodyAccount: inmateJwt.custodyAccount,
      callPartyId: inmateJwt.callPartyId,
      purchaseType: purchaseType,
      purchaseCode: product.purchaseCode,
      product: {
        productId: product.productId,
        productTypeGroupId: product.productTypeGroupId,
        price: purchaseOption.totalPrice,
        name: product.meta.name,
        description: product.meta.description,
        thumbnail: product.meta.thumbnail,
        productType: product.productTypeId,
        priceDetail: purchaseOption.priceDetails,
        version: product.version,
        ...(product.fulfillmentType && {
          fulfillmentType: product.fulfillmentType,
        }),
        ...(product.parentProductId && {
          parentProductId: product.parentProductId,
        }),
        ...(includedProductIds && { includedProductIds }),
        ...(product.meta.type && { type: product.meta.type }),
        ...(product.meta.multipleSubscription && {
          multipleSubscription: product.meta.multipleSubscription,
        }),
      },
    } as PurchaseToken;
    if (purchaseType === 'subscription') {
      purchaseTokenObj.product.billingInterval = product.meta.billingInterval;
    }
    return purchaseTokenObj;
  }
}

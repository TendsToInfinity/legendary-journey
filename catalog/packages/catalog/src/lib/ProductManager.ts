import { SvSecurityContext } from '@securustablets/libraries.httpsecurity';
import {
  JsonSchemaParser,
  SpAttributes,
  SpLite,
} from '@securustablets/libraries.json-schema';
import { Logger } from '@securustablets/libraries.logging';
import { SearchParameters } from '@securustablets/libraries.postgres/dist/src/models/SearchParameters';
import { _ } from '@securustablets/libraries.utils';
import Axios, { AxiosResponse } from 'axios';
import * as Bluebird from 'bluebird';
import { Exception } from 'securus.tablets.libraries.exceptions';
import { Inject, Singleton } from 'typescript-ioc';
import * as util from 'util';
import { DistinctProductValue } from '../controllers/models/DistinctProductValue';
import {
  DistinctProductFieldPath,
  PricedProduct,
  Product,
  ProductTypeIds,
  ThumbnailApprovalApiBody,
  ThumbnailApprovedStatus,
} from '../controllers/models/Product';
import { RuleType } from '../controllers/models/Rule';
import { Context, OrderBy, Search } from '../controllers/models/Search';
import { ProductDao } from '../data/PGCatalog/ProductDao';
import { BlocklistLie } from '../messaging/lie/BlocklistLie';
import { AwsUtils } from '../services/AwsUtils';
import { AppConfig } from '../utils/AppConfig';
import { DigestHelper } from './DigestHelper';
import { DigestManager } from './DigestManager';
import { DistinctProductValueManager } from './DistinctProductValueManager';
import { ExplicitSearchHelper } from './ExplicitSearchHelper';
import { OpenSearchManager } from './OpenSearchManager';
import { ProductDecoratorManager } from './ProductDecoratorManager';
import { ProductTypeManager } from './ProductTypeManager';
import { ProductValidator } from './ProductValidator';
import { DigestDecorator } from './decorators/product/DigestDecorator';
import { PriceDecorator } from './decorators/product/PriceDecorator';
import { RuleDecorator } from './decorators/product/RuleDecorator';
import { ThumbnailDecorator } from './decorators/product/ThumbnailDecorator';
import { WebViewDecorator } from './decorators/product/WebViewDecorator';
import { AuditContext } from './models/AuditContext';
import { Paginated } from './models/Paginated';
import { ProductType } from './models/ProductType';
import { ParentProductManager } from './product/ParentProductManager';
import { ProductPublishManager } from './product/ProductPublishManager';

@Singleton
export class ProductManager {
  @Inject
  private productDao!: ProductDao;

  @Inject
  private config!: AppConfig;

  @Inject
  private productTypeManager!: ProductTypeManager;

  @Inject
  private productValidator!: ProductValidator;

  @Inject
  private decorator!: ProductDecoratorManager;

  @Inject
  private ruleDecorator!: RuleDecorator;

  @Inject
  private priceDecorator!: PriceDecorator;

  @Inject
  private webViewDecorator!: WebViewDecorator;

  @Inject
  private thumbnailDecorator!: ThumbnailDecorator;

  @Inject
  private digestDecorator!: DigestDecorator;

  @Inject
  private distinctProductValueManager!: DistinctProductValueManager;

  @Inject
  private awsUtils!: AwsUtils;

  @Inject
  private blocklistLie!: BlocklistLie;

  @Inject
  public parentProductManager!: ParentProductManager;

  @Inject
  private digestManager!: DigestManager;

  @Inject
  private openSearchManager!: OpenSearchManager;

  @Inject
  private productPublishManager!: ProductPublishManager;

  @Inject
  private logger!: Logger;

  private readonly axios = Axios;

  private get cidnArtApprovalEndpoint() {
    return this.config.cidnArtApprovalEndpoint;
  }

  public find = this.productDao.find.bind(this.productDao);
  public findOne = this.productDao.findOne.bind(this.productDao);
  public findOneOrFail = this.productDao.findOneOrFail.bind(this.productDao);
  public findByQueryString = this.productDao.findByQueryString.bind(
    this.productDao,
  );
  public findOneByVendorProductId =
    this.productDao.findOneByVendorProductId.bind(this.productDao);

  public async findOneByProductIdOrFail(
    productId: number,
    resolve: boolean,
    securityContext: SvSecurityContext = {},
    searchContext?: Context,
  ): Promise<PricedProduct> {
    let product: PricedProduct;
    const searchRequest: Search = this.enforceSearchSecurityContext(
      {
        match: { productId },
        context: { ...searchContext },
      },
      securityContext,
    );
    let productIds = [productId];

    const enforce: boolean = _.get(searchRequest, 'context.enforce', false);

    if (resolve) {
      // gather child IDs and add them to the products to be digested
      productIds = await this.productDao.findDescendantProductIds(productId);
    }

    if (!_.isEmpty(productIds)) {
      let products = await this.productDao.find({ ids: productIds });
      // Find the parent product definition for productTypeAvailability checking, note there may be no products in this array
      const productTypeId = _.get(
        _.find(products, { productId }),
        'productTypeId',
      );

      const productTypeAvailable =
        await this.productTypeManager.isProductTypeAvailableForContext(
          productTypeId,
          searchRequest.context,
        );
      if (!enforce || productTypeAvailable) {
        const rules = await this.digestManager.getDigestRulesByContext(
          searchRequest.context,
        );
        const digests = products.map((p) =>
          this.digestManager.getProductDigest(rules, p),
        );
        // TODO we can remove subscriptionProductIds if the context doesn't allow them
        products.map((p) => {
          const productDigest = _.find(digests, { productId: p.productId });
          // Set the products subscriptionIds
          p.subscriptionIds = productDigest.subscriptionProductIds;
          // Set the product's available flag
          p.available = DigestHelper.isProductAvailableForContext(
            p,
            searchRequest.context,
            productDigest,
          );
        });

        // strip enforce/available
        if (enforce) {
          products = products.filter((p) => p.available === true);
        }
        // nest children
        product = this.populateChildProducts(
          _.keyBy(products as PricedProduct[], 'productId'),
          productId,
        );

        const decorators = [
          this.priceDecorator.decorator,
          this.webViewDecorator.decorator,
          this.thumbnailDecorator.decorator,
        ];
        await this.decorator.apply(products, decorators, searchRequest.context);
      }
    }

    if (!product) {
      throw Exception.NotFound({
        errors: `No Product found for productId: ${productId}`,
      });
    }

    return product;
  }

  public async searchOneOrFail(search: Search): Promise<PricedProduct> {
    const product = (await this.search(search)).data[0];
    if (!product) {
      throw Exception.NotFound({
        errors: `No Product found matching ${util.inspect(search, { breakLength: Infinity })}`,
      });
    }
    return product;
  }

  public async searchByQueryString(
    query: SearchParameters,
  ): Promise<Paginated<PricedProduct>> {
    const search = await this.productDao.getSearchFromQueryString(query);
    if (query.productTypeId !== undefined && query.orderBy) {
      // searches with productTypeId defined will go to opensearch, need to alter orderBy to match
      search.orderBy = _.map(query.orderBy.split(','), (i) => {
        const [field, direction] = i.split(':');
        return { [field]: direction.toUpperCase() } as OrderBy;
      });
    }
    return this.search(search);
  }

  /**
   * Perform a Catalog Product Search with Rules applied
   * Handles all multiple product searches
   * Notes:
   *  1. OpenSearch will be used if a productTypeId is specified in the search
   *      a. The Search contains a Query, note: Search.Query requires a productTypeId
   *      b. The Search contains a Match or Match[].length === 1 and the one Match has a productTypeId specified
   *  2. Postgres will be used if the Search is cross productTypeId
   *      a. The Search does not contain a Query
   *      b. The Search contains multiple Matches
   *      c. The Search contains a Match without a productTypeId
   * @param search
   */
  public async search(search: Search): Promise<Paginated<PricedProduct>> {
    const orderByExplicit = ExplicitSearchHelper.checkExplicitField(search);
    if (search.query) {
      if (!orderByExplicit) {
        return await this.openSearchManager.search(
          search.query.productTypeId,
          search,
        );
      }
      const pageSize = search.pageSize;
      const pageNumber = search.pageNumber;
      const results = await this.openSearchManager.search(
        search.query.productTypeId,
        ExplicitSearchHelper.mutateExplicitSearchQuery(search, orderByExplicit),
      );
      return ExplicitSearchHelper.mutateExplicitSearchReturn(
        search,
        orderByExplicit,
        results,
        pageSize,
        pageNumber,
      );
    }
    if (search.match) {
      const matchProductTypeIds: string[] = _.chain(_.castArray(search.match))
        .map((el) => (el as any).productTypeId)
        .filter((el) => !!el)
        .uniqBy((el) => el)
        .value();
      if (
        matchProductTypeIds.length === 1 &&
        _.castArray(search.match).length === 1
      ) {
        return this.openSearchManager.search(matchProductTypeIds[0], {
          ...search,
          match: _.castArray(search.match)[0],
        });
      }
    }
    this.logger.info(`Not using OpenSearch: ${JSON.stringify(search)}`);
    const paginated = await this.productDao.search(search);
    const decorators = [
      // Not adding digest decorator here, subscriptionIds are added in price decorator, digest isn't added at all
      this.priceDecorator.decorator,
      this.webViewDecorator.decorator,
      this.ruleDecorator.forBoolean(RuleType.ProductCache),
      this.thumbnailDecorator.decorator,
    ];

    await this.decorator.apply(paginated.data, decorators, search.context);

    return {
      ...paginated,
      data: paginated.data as PricedProduct[],
    };
  }

  public async createProduct(
    product: Product,
    context: AuditContext,
  ): Promise<number> {
    const productType = await this.productTypeManager.getProductType(
      _.get(product, 'productTypeId'),
    );

    await this.setProductDefaults(product, productType, context);

    this.productValidator.validate(product, productType.jsonSchema);

    let parentProduct: Product;
    if (product.source?.vendorParentProductId) {
      parentProduct = await this.parentProductManager.getParentProduct(
        product,
        productType,
      );
      if (!parentProduct) {
        throw Exception.UnprocessableEntity({
          errors:
            `Can not create product for vendorProductId: ${product.source.vendorProductId} ` +
            `and vendor name: ${product.source.vendorName} because parent product with vendorProductId: ` +
            `${product.source.vendorParentProductId} does not yet exist.`,
        });
      }

      if (product.productTypeId === ProductTypeIds.Track) {
        product.parentProductId = parentProduct.productId;
        product.meta.albumName = parentProduct.meta.name;
        product.meta.thumbnail = parentProduct.meta.thumbnail;
        product.meta.thumbnailApproved = parentProduct.meta.thumbnailApproved;
        product.meta.releaseYear = parentProduct.meta.releaseYear;
      }
    }

    // check the filters and save the new product for the first time
    const createdProduct = await this.autoReviewAndSaveProduct(
      product,
      context,
      true,
      parentProduct,
    );

    try {
      if (parentProduct) {
        await this.parentProductManager.addChildToParent(
          createdProduct.productId,
          parentProduct.productId,
          context,
        );
        parentProduct =
          await this.parentProductManager.setParentSubscriptionAvailability(
            createdProduct,
            parentProduct,
            context,
          );
        parentProduct.childProductIds = _.union(parentProduct.childProductIds, [
          createdProduct.productId,
        ]);
        await this.productPublishManager.publishProductMessage(parentProduct);
      }
    } catch (err) {
      await this.productDao.delete(product.productId, context);
      throw err;
    }

    await this.productPublishManager.publishProductMessage(createdProduct);
    return createdProduct.productId;
  }

  public async updateProduct(
    product: Product,
    context: AuditContext,
  ): Promise<void> {
    const productType = await this.productTypeManager.getProductType(
      _.get(product, 'productTypeId'),
    );
    await this.setProductDefaults(product, productType, context);
    this.productValidator.validate(product, productType.jsonSchema);

    const updatedProduct = await this.autoReviewAndSaveProduct(
      product,
      context,
    );

    if (product.source?.vendorParentProductId) {
      const parentProduct = await this.parentProductManager.getParentProduct(
        updatedProduct,
        productType,
      );
      await this.parentProductManager.setParentSubscriptionAvailability(
        updatedProduct,
        parentProduct,
        context,
      );
    }

    await this.productPublishManager.publishProductMessage(updatedProduct);
  }

  public getDecoratorFields(): string[] {
    return [
      ...this.ruleDecorator.getDecoratorFields(),
      ...this.webViewDecorator.getDecoratorFields(),
      ...this.priceDecorator.getDecoratorFields(),
      ...this.thumbnailDecorator.getDecoratorFields(),
      ...this.digestDecorator.getDecoratorFields(),
    ];
  }

  private async setProductDefaults(
    product: Product,
    productType: ProductType,
    context: AuditContext,
  ): Promise<void> {
    product.purchaseCode = _.defaultTo(productType.purchaseCode, undefined);
    product.purchaseTypes = productType.purchaseTypes;
    product.productTypeGroupId = productType.productTypeGroupId;
    product.subscribable = productType.subscribable;
    if (productType.fulfillmentType) {
      product.fulfillmentType = productType.fulfillmentType;
    }
    if (
      product.source &&
      product.source.vendorName &&
      product.source.vendorProductId
    ) {
      product.source.productTypeId = product.productTypeId;
    }
    await this.setArtApprovalDefaults(product, productType);
    // Used only for the backward compatibility where the vendors are still sending the products with meta.genres.
    await this.setGenresForBackwardCompatibility(product, productType);

    const jsp = new JsonSchemaParser(productType.jsonSchema);
    const schemas = jsp.getSchemasWithField(SpAttributes.DistinctValue);

    // Set or get the distinct values into the distinctProductValue table for a given product.
    const distinctValues = await this.setDistinctValueTableRecords(
      product,
      schemas,
      context,
    );
    if (
      !_.isNull(distinctValues) &&
      !_.isEmpty(distinctValues) &&
      distinctValues.length > 0
    ) {
      // Used to set the defaults for the distinct values,
      // e.g - such as genres - source.genres are set to meta.genres based on the distinct values - displayName
      this.setDistinctDefaults(product, distinctValues);
    }
  }

  /**
   * product with a thumbnail but not yet approved, assigning the status to pending
   * @param product
   * @param productType
   * @see https://confluence.dal.securustech.net/x/8wC9Bw
   */
  private async setArtApprovalDefaults(
    product: Product,
    productType: ProductType,
  ): Promise<void> {
    const thumbnailApproved = await this.productTypeManager.isFieldPartOfSchema(
      productType,
      'meta.thumbnailApproved',
    );
    if (
      thumbnailApproved &&
      product.meta.thumbnail &&
      !product.meta.thumbnailApproved
    ) {
      product.meta.thumbnailApproved = ThumbnailApprovedStatus.Pending;
    }
  }

  public enforceSearchSecurityContext(
    search: Search,
    {
      inmateJwt,
      'facilityJwt:beta': facilityJwtBeta,
      facilityJwt,
    }: SvSecurityContext,
  ): Search {
    if (inmateJwt) {
      return _.merge({}, search, {
        context: {
          enforce: true,
          customerId: inmateJwt.customerId,
          siteId: inmateJwt.siteId,
        },
      });
    } else if (facilityJwtBeta) {
      return _.merge({}, search, {
        context: {
          enforce: true,
          customerId: facilityJwtBeta.customerId,
        },
      });
    } else if (facilityJwt) {
      return _.merge({}, search, {
        context: {
          enforce: true,
          customerId: facilityJwt.customerId,
        },
      });
    }
    return search;
  }

  private populateChildProducts(
    products: { [key: number]: PricedProduct },
    productId: number,
  ): PricedProduct {
    const product = products[productId];

    if (product) {
      const childProducts = _.filter(
        _.map(product.childProductIds, (childProductId) =>
          this.populateChildProducts(products, childProductId),
        ),
        (p) => !_.isUndefined(p),
      );

      if (!_.isEmpty(childProducts)) {
        product.childProducts = childProducts;
      }
    }

    return product;
  }

  public async searchProductsBySubscription(
    searchRequest: Search,
    productId: string,
  ): Promise<Paginated<PricedProduct>> {
    /*
     * Below is the explanation for what is being done as it is little complicated to create the match object.
     * lets say productId belongs productTypeId->musicSubscription -> and corresponding productTypeId for the productTypeGroupId (music) will be album, track.
     * if the input request contains match as (examples below)
     * {} -> Add all productTypeIds from productTypeGroupId where subscribable is false--> [{productTypeId: album},{productTypeId: track}]
     * {'genre: HipHop} -> Apply all productTypeIds to this match->> [{genre: Hiphop, productTypeId: album}, {genre: Hiphop, productTypeId: track}]
     * {genre: Jazz, productTypeId: track} -> productTypeId already exists so do not alter the object further, leave it as it is --> [{genre: Jazz, productTypeId: track}]
     * [{genre: Jazz, productTypeId: track}, {fulfillment: digital}] --> [{genre: Jazz, productTypeId: track},
     *                                                                    {fulfillment: digital, productTypeId: track},
     *                                                                    {fulfillment: digital, productTypeId: album}]
     */
    const product = await this.findOneByProductIdOrFail(
      parseInt(productId, 10),
      false,
    );

    const productTypes = (
      await this.productTypeManager.getProductTypes(searchRequest.context)
    )
      .filter(
        (pType) =>
          pType.productTypeGroupId === product.productTypeGroupId &&
          pType.subscribable === false,
      )
      .map(({ productTypeId }) => ({ productTypeId }));

    if (!searchRequest.query) {
      searchRequest.match = _.flatMap(
        _.castArray(searchRequest.match || {}),
        (searchMatch) =>
          // eslint-disable-next-line no-prototype-builtins
          searchMatch.hasOwnProperty('productTypeId')
            ? searchMatch
            : productTypes.map(({ productTypeId }) => ({
                ...searchMatch,
                productTypeId,
              })),
      );
    }
    searchRequest = _.merge(
      {
        context: { productId: productId },
      },
      searchRequest,
    );

    return await this.search(searchRequest);
  }

  /**
   *
   * @param product Notify Legacy (Chris' system) about the product art status change
   * @param context
   */
  public async publishLegacyMessage(
    product: Product,
    status: ThumbnailApprovedStatus,
  ): Promise<void> {
    await this.productPublishManager.publishLegacyMessage({
      vendor: product.source.vendorName,
      media: {
        vendorProductId: product.source.vendorProductId,
        thumbnailApproved:
          status === ThumbnailApprovedStatus.Approved
            ? ThumbnailApprovedStatus.Approved
            : ThumbnailApprovedStatus.Blocked, // for legacy either approved or blocked
      },
    });
  }

  public async updateProductThumbnailStatusBulk(
    productIds: number[],
    status: ThumbnailApprovedStatus,
    securityContext: AuditContext,
  ) {
    // check the limit of the artApproval API
    if (
      productIds.length > this.cidnArtApprovalEndpoint.batchArtApprovalLimit
    ) {
      throw Exception.InvalidData({
        errors: `The number of products to update exceeds the limit of ${this.cidnArtApprovalEndpoint.batchArtApprovalLimit}`,
      });
    }

    // get all ALBUMS with provided ids
    const albums = await this.productDao.find({
      ids: productIds,
      customClauses: [
        {
          clause: `document->>'productTypeId' = $1`,
          params: [ProductTypeIds.Album],
        },
      ],
    });

    // update all products in PG and publish internally and to the legacy system
    const updatedProducts: { albums: Product[]; tracks: Product[] } = {
      albums: [],
      tracks: [],
    };
    await Bluebird.map(albums, async (product) => {
      const allProductIds = [product.productId, ...product.childProductIds];
      const products = await this.productDao.updateProductThumbnailStatus(
        allProductIds,
        status,
        securityContext,
        product.meta.thumbnail,
      );
      const updatedAlbums = products.filter(
        (p) => p.productTypeId === ProductTypeIds.Album,
      );
      const updatedTracks = products.filter(
        (p) => p.productTypeId === ProductTypeIds.Track,
      );

      // publish parent product
      await this.productPublishManager.publishProductMessageWithoutDigest(
        updatedAlbums[0],
      );

      await Bluebird.map(updatedTracks, async (updatedTrack) => {
        await this.productPublishManager.publishProductMessageWithoutDigest(
          updatedTrack,
        );
      });

      await this.publishLegacyMessage(product, status);

      updatedProducts.albums.push(...updatedAlbums);
      updatedProducts.tracks.push(...updatedTracks);
    });

    // get all distinct vendor names for the tracks (it should never happened now, since we have only active AM products, but just for generic support)
    const vendorNames = _.uniq(
      updatedProducts.tracks.map((track) => track.source.vendorName),
    );
    // publish to CDN to update mp3 files
    const artApprovalList: ThumbnailApprovalApiBody[] = [];
    vendorNames.forEach((vendorName) => {
      const vendorTracks = updatedProducts.tracks.filter(
        (track) => track.source.vendorName === vendorName,
      );
      const artApprovalParams: ThumbnailApprovalApiBody = {
        vendor: vendorName,
        artApproval: vendorTracks.map((track) => {
          return {
            vendorProductId: track.source.vendorProductId,
            thumbnailApproved: status,
            genres: track.meta.genres,
          };
        }),
      };
      artApprovalList.push(artApprovalParams);
    });
    await Bluebird.map(artApprovalList, async (artApprovalParams) => {
      await this.publishMessageToArtApprovalEndpoint(artApprovalParams);
    });

    // now digest all products at once (split by productTypeId)
    try {
      await this.openSearchManager.digestProductsIntoOpenSearch(
        updatedProducts.albums,
      );
      if (updatedProducts.tracks.length > 0)
        await this.openSearchManager.digestProductsIntoOpenSearch(
          updatedProducts.tracks,
        );
    } catch (error) {
      throw Exception.InternalError({
        errors: `Error trying to digest into openSearch: ${error}`,
      });
    }
  }

  public async updateProductThumbnailStatus(
    product: Product,
    status: ThumbnailApprovedStatus,
    securityContext: AuditContext,
    notifyLegacySystem = true,
  ): Promise<void> {
    if (!this.cidnArtApprovalEndpoint.enabled) {
      throw Exception.InternalError({
        errors: 'artApproval api service is not enabled',
      });
    }

    // for music we only update actual meta in mp3 files - so only send info about tracks
    const artApprovalParams: ThumbnailApprovalApiBody = {
      vendor: product.source.vendorName,
      artApproval: product.childProducts?.map((childProduct) => {
        return {
          vendorProductId: childProduct.source.vendorProductId,
          thumbnailApproved: status,
          genres: childProduct.meta.genres,
        };
      }),
    };
    const productIds = [product.productId, ...(product.childProductIds || [])];

    await this.productDao.updateProductThumbnailStatus(
      productIds,
      status,
      securityContext,
      product.meta.thumbnail,
    );

    // publish an updated message for thumbnail updated products, update the status to reflect the new status
    await Bluebird.map(
      [product, ...(product.childProducts || [])],
      async (currentProduct) => {
        currentProduct.meta.thumbnailApproved = status;
        await this.productPublishManager.publishProductMessage(currentProduct);
      },
    );

    if (artApprovalParams.artApproval) {
      await this.publishMessageToArtApprovalEndpoint(artApprovalParams);
    }

    if (notifyLegacySystem) {
      await this.publishLegacyMessage(product, status);
    }
  }

  public async publishMessageToArtApprovalEndpoint(
    data: ThumbnailApprovalApiBody,
  ): Promise<AxiosResponse> {
    const { artApprovalEndpoint, baseUrl } = this.cidnArtApprovalEndpoint;
    const apiUrl = `${baseUrl}/${artApprovalEndpoint}`;
    const request = this.awsUtils.adjustAxiosPostForAWS(data, apiUrl);
    const signedRequest = await this.awsUtils.awsSignedRequest(request);
    return this.axios(signedRequest as any); // little hack - mismatch in method types
  }

  /**
   * @param product
   * @param schemas
   * @param context
   * @returns an array of objects
   * [{ "purchase": { "1.5": {"distinctProductValueId": 10,"fieldPath": "purchase","productTypeGroupId": "music","sourceValueName": "1.5",
   * "displayName": "1.5", "cdate": "2022-04-21T17:04:49.602Z","udate": "2022-04-21T17:04:49.602Z" }}}
   * ,{ "categories": { "Books": {"distinctProductValueId": 8,"fieldPath": "categories","productTypeGroupId": "music","sourceValueName": "Books",
   * "displayName": "Books","cdate": "2022-04-21T17:04:49.604Z","udate": "2022-04-21T17:04:49.604Z"}}}]
   */
  private async setDistinctValueTableRecords(
    product: Product,
    schemas: SpLite[],
    context: AuditContext,
  ): Promise<
    Array<{
      [fieldPath: string]: { [sourceValueName: string]: DistinctProductValue };
    }>
  > {
    return Bluebird.map(
      schemas,
      async (schema) =>
        await this.distinctProductValueManager.getOrCreateValueTableRecordsForField(
          schema,
          product,
          context,
        ),
      { concurrency: 5 },
    );
  }

  private setNormalizedGenres(
    product: Product,
    distinctGenreValues: { [sourceValueName: string]: DistinctProductValue },
  ) {
    if (
      product.source?.genres &&
      !_.isNull(distinctGenreValues) &&
      Object.keys(distinctGenreValues).length > 0
    ) {
      let updatedGenres: string[] = [];
      product.source.genres.forEach((genre) => {
        const distinctGenre = distinctGenreValues[genre.toLowerCase()];
        if (distinctGenre) {
          updatedGenres.push(distinctGenre.displayName);
        }
      });
      updatedGenres = [...new Set(updatedGenres)];
      product.meta.genres =
        updatedGenres.length > 0 ? updatedGenres : product.source.genres;
    }
  }

  private setDistinctDefaults(
    product: Product,
    distinctProductValues: Array<{
      [fieldPath: string]: { [sourceValueName: string]: DistinctProductValue };
    }>,
  ) {
    distinctProductValues.forEach((distinctProductValue) => {
      if (distinctProductValue && !_.isEmpty(distinctProductValue)) {
        switch (Object.keys(distinctProductValue)[0]) {
          case DistinctProductFieldPath.Genres:
            this.setNormalizedGenres(
              product,
              distinctProductValue[DistinctProductFieldPath.Genres],
            );
            break;
        }
      }
    });
  }

  private async setGenresForBackwardCompatibility(
    product: Product,
    productType: ProductType,
  ): Promise<void> {
    const genresExists = await this.productTypeManager.isFieldPartOfSchema(
      productType,
      'meta.genres',
    );
    if (genresExists && product.meta.genres && !product.source?.genres) {
      _.set(product, 'source.genres', product.meta.genres);
    }
  }

  /**
   * this method perform inline review and save the product
   * For new ingestion product is not saved to DB at the time of review
   * @param product
   * @param context
   * @returns
   */
  private async autoReviewAndSaveProduct(
    product: Product,
    context: AuditContext,
    newProduct = false,
    parentProduct?: Product,
  ): Promise<Product> {
    const autoReviewResults = await this.blocklistLie.blockAutoReviewHandler(
      product,
      parentProduct,
    );

    let isBlockStatusChanged = false;
    if (newProduct) {
      isBlockStatusChanged = autoReviewResults.blocked;
    } else if (!newProduct && !_.isUndefined(product.isBlocked)) {
      isBlockStatusChanged = product.isBlocked !== autoReviewResults.blocked;
    } else {
      // if isBlocked is undefined - it's a legacy record before autoreview v2.
      // Mark it as not changed and let legacy LIE create necessary reasons if blocked
      isBlockStatusChanged = false;
    }
    product.isBlocked = autoReviewResults.blocked;

    // check if the product is already in the DB
    let updatedProduct;
    newProduct
      ? (updatedProduct = await this.productDao.createAndRetrieve(
          _.omit(
            product,
            'childProducts',
            this.getDecoratorFields(),
          ) as Product,
          context,
        ))
      : (updatedProduct = await this.productDao.updateAndRetrieve(
          product.productId,
          _.omit(product, 'childProducts', this.getDecoratorFields()),
          context,
        ));

    // create or update all the reasons if the product block status is changed
    await this.blocklistLie.addDirectBlockReasons(
      updatedProduct,
      autoReviewResults,
      isBlockStatusChanged,
      context,
    );
    return updatedProduct;
  }

  public async findWebViewsByPackageId(
    packageId: number,
    securityContext: SvSecurityContext,
  ): Promise<Product[] | undefined> {
    const packageProduct = await this.findOneByProductIdOrFail(
      packageId,
      false,
      securityContext,
    );

    if (!packageProduct.webViews) {
      this.logger.info(`No webViews found for this tablet package.`);
      return undefined;
    }

    const webViewProducts = await this.retrieveWebViews(
      packageProduct.webViews,
      securityContext,
    );

    return webViewProducts;
  }

  public async retrieveWebViews(
    webViews: number[],
    securityContext: SvSecurityContext,
  ): Promise<Product[]> {
    const webViewsProducts: Product[] = [];

    for (const webView of webViews) {
      try {
        const webViewProduct: Product = await this.findOneByProductIdOrFail(
          webView,
          false,
          securityContext,
        );

        webViewsProducts.push(webViewProduct);
      } catch (err) {
        this.logger.info(
          `Webview ${webView} was not found. Possibly due to availability rules ${err.message}`,
        );
      }
    }
    return webViewsProducts;
  }
}

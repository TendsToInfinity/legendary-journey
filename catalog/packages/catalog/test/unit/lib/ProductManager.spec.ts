import {
  JsonSchemaParser,
  SpAttributes,
  SpLite,
} from '@securustablets/libraries.json-schema';
import { _ } from '@securustablets/libraries.utils';
import { SecurityFactory } from '@securustablets/libraries.utils-test';
import * as aws4 from 'aws4';
import { assert, expect } from 'chai';
import * as faker from 'faker';
import { Exception } from 'securus.tablets.libraries.exceptions';
import * as sinon from 'sinon';
import { Container } from 'typescript-ioc';
import {
  DistinctProductFieldPath,
  PricedProduct,
  Product,
  ProductTypeIds,
  ThumbnailApprovalApiBody,
  ThumbnailApprovedStatus,
  VendorNames,
} from '../../../src/controllers/models/Product';
import { Context, Search } from '../../../src/controllers/models/Search';
import { ProductManager } from '../../../src/lib/ProductManager';
import { Paginated } from '../../../src/lib/models/Paginated';
import { AppConfig } from '../../../src/utils/AppConfig';
import { fakeGetSchemaForInterface } from '../../utils/FakeGetSchemaForInterface';
import { ModelFactory } from '../../utils/ModelFactory';

describe('ProductManager - Unit', () => {
  let manager: ProductManager;
  let mockPtMan: sinon.SinonMock;
  let mockDao: sinon.SinonMock;
  let mockProductPublishManager: sinon.SinonMock;
  let decorator: sinon.SinonMock;
  let mockProductManager: sinon.SinonMock;
  let mockDistinctProductValueManager: sinon.SinonMock;
  let mockAws4: sinon.SinonMock;
  let mockAWSUtils: sinon.SinonMock;
  let appConfig: AppConfig;
  let mockAppConfig: sinon.SinonMock;
  let mockBlocklistLie: sinon.SinonMock;
  let mockParentProductManager: sinon.SinonMock;
  let mockDigestManager: sinon.SinonMock;
  let mockOpenSearchManager: sinon.SinonMock;

  const context = { apiKey: 'test' };

  beforeEach(() => {
    const stubGetSchemaForInterface = sinon.stub(
      JsonSchemaParser,
      'getSchemaForInterface',
    );
    stubGetSchemaForInterface.callsFake(fakeGetSchemaForInterface);
    manager = new ProductManager();
    mockPtMan = sinon.mock((manager as any).productTypeManager);
    mockDao = sinon.mock((manager as any).productDao);
    mockProductPublishManager = sinon.mock(
      (manager as any).productPublishManager,
    );
    decorator = sinon.mock((manager as any).decorator);
    mockAWSUtils = sinon.mock((manager as any).awsUtils);
    mockProductManager = sinon.mock(manager);
    mockAws4 = sinon.mock(aws4);
    appConfig = Container.get(AppConfig);
    mockAppConfig = sinon.mock(appConfig);
    mockDistinctProductValueManager = sinon.mock(
      (manager as any).distinctProductValueManager,
    );
    mockBlocklistLie = sinon.mock((manager as any).blocklistLie);
    mockParentProductManager = sinon.mock(
      (manager as any).parentProductManager,
    );
    mockDigestManager = sinon.mock((manager as any).digestManager);
    mockOpenSearchManager = sinon.mock((manager as any).openSearchManager);
  });

  afterEach(() => {
    sinon.restore();
    // (manager as any).axios = () => {
    //   return;
    // };
  });

  const addAutoReviewExpectations = (
    product: Product,
    newProduct = true,
    parentProduct?: Product,
    initialProduct?: Product, // to test legacy exceptions, like products that doesn't have isBlock field
  ) => {
    const autoReviewResult = {
      blocked: false,
      blocklistTerms: [],
      parents: [],
    };

    if (!initialProduct) {
      initialProduct = { ...product };
    }

    mockBlocklistLie
      .expects('blockAutoReviewHandler')
      .withArgs(sinon.match(initialProduct), sinon.match(parentProduct))
      .resolves(autoReviewResult);

    if (newProduct) {
      mockDao
        .expects('createAndRetrieve')
        .withArgs(
          sinon.match(
            _.omit(product, 'childProducts', manager.getDecoratorFields()),
          ),
        )
        .resolves(product);
    } else {
      mockDao
        .expects('updateAndRetrieve')
        .withArgs(
          product.productId,
          sinon.match(
            _.omit(product, 'childProducts', manager.getDecoratorFields()),
          ),
          context,
        )
        .resolves(product);
    }

    mockBlocklistLie
      .expects('addDirectBlockReasons')
      .withArgs(product, autoReviewResult, false, context)
      .resolves();
  };

  describe('search', () => {
    it('calls the productDao for search', async () => {
      const expectedResults: Paginated<Product> = {
        data: [ModelFactory.product()],
        total: 1,
        pageNumber: 0,
        pageSize: 25,
      };
      mockDao
        .expects('search')
        .withArgs({ term: 'foo' })
        .returns(expectedResults);
      decorator
        .expects('apply')
        .withArgs(sinon.match.array, [
          sinon.match.func,
          sinon.match.func,
          sinon.match.func,
          sinon.match.func,
        ])
        .resolves();

      const actualResults = await manager.search({ term: 'foo' });
      sinon.verify();
      const testResults = {
        ...actualResults,
        data: _.map(actualResults.data, (ar) => _.omit(ar, 'purchaseOptions')),
      };
      assert.deepEqual(testResults, expectedResults);
    });
    it('throws 400 if a query and match are sent in the same search', async () => {
      try {
        await manager.search({
          query: { productTypeId: 'ferrari', clauses: { clause: ['foo'] } },
          match: { foo: 'bar' },
        });
        assert.fail();
      } catch (err) {
        assert.equal(err.code, 400);
      }
    });
    it('converts a query to clauses', async () => {
      const search: Search = {
        query: {
          productTypeId: 'spandex',
          clauses: {
            foo: ['bar'],
          },
        },
        orderBy: { 'meta.year': 'DESC' },
      };
      const expectedResults: Paginated<Product> = {
        data: [ModelFactory.product()],
        total: 1,
        pageNumber: 0,
        pageSize: 25,
      };
      mockOpenSearchManager
        .expects('search')
        .withArgs('spandex', search)
        .resolves(expectedResults);
      mockDao.expects('search').never();

      await manager.search(search);
      sinon.verify();
    });
    it('handles EXPLICIT orderBy', async () => {
      const search: Search = {
        query: {
          productTypeId: 'oregano',
          clauses: {
            productId: [1, 2, 3, 4, 5],
          },
        },
        orderBy: { productId: 'EXPLICIT' },
        pageSize: 3,
        pageNumber: 1,
      };
      const expectedResults: Paginated<Product> = {
        data: [1, 2, 3, 4, 5].map((productId) =>
          ModelFactory.product({ productId: productId }),
        ),
        total: 5,
        pageNumber: 1,
        pageSize: 3,
      };
      // With explicit orderBy the search should fetch without paginating, orderBy should also be stripped
      mockOpenSearchManager
        .expects('search')
        .withExactArgs('oregano', {
          ...search,
          pageSize: 5,
          pageNumber: 0,
          orderBy: {},
        })
        // Clone and shuffle the data to verify the sort works
        .resolves({
          ...expectedResults,
          data: _.shuffle(expectedResults.data.slice()),
        });
      mockDao.expects('search').never();

      const result = await manager.search(search);
      // Verify the pagination details are restored after the search
      expect(result.pageNumber).to.equal(1);
      expect(result.pageSize).to.equal(3);
      // Verify the search returned only the data from the page requested, verify the data came back in the correct order
      expect(result.data).to.deep.equal(expectedResults.data.slice(3));
      sinon.verify();
    });
    it('handles invalid orderBy', async () => {
      const search: Search = {
        query: {
          productTypeId: 'lemon',
          clauses: {
            productId: [2342, 23],
          },
        },
        orderBy: [{ productId: 'EXPLICIT' }, { 'meta.year': 'DESC' }],
      };
      mockOpenSearchManager.expects('search').never();
      mockDao.expects('search').never();

      try {
        await manager.search(search);
        assert.fail();
      } catch (err) {
        assert.equal(err.code, 400);
        assert.equal(err.message, 'EXPLICIT OrderBy only supports one OrderBy');
      }
      sinon.verify();
    });
  });

  describe('findOneByProductIdOrFail', () => {
    it('executes search and returns the first result when resolve flag is false', async () => {
      const customerId = 'I-003320';
      const siteId = '09340';
      const expectedProduct = ModelFactory.product();
      const search = {
        match: { productId: expectedProduct.productId },
        context: { enforce: true, customerId, siteId },
      };
      const securityContext = {
        inmateJwt: SecurityFactory.inmateJwt({ customerId, siteId }),
      };

      mockDao.expects('findDescendantProductIds').never();
      mockDao
        .expects('find')
        .withExactArgs({ ids: [expectedProduct.productId] })
        .resolves([expectedProduct]);
      mockDigestManager
        .expects('getDigestRulesByContext')
        .withExactArgs(search.context)
        .resolves([]);
      mockPtMan
        .expects('isProductTypeAvailableForContext')
        .withExactArgs(expectedProduct.productTypeId, search.context)
        .resolves(true);

      decorator
        .expects('apply')
        .withExactArgs(
          sinon.match.array,
          [sinon.match.func, sinon.match.func, sinon.match.func],
          search.context,
        )
        .resolves();

      const product = await manager.findOneByProductIdOrFail(
        expectedProduct.productId,
        false,
        securityContext,
      );

      assert.deepEqual(product, expectedProduct);
      sinon.verify();
    });
    it('looks up all descendants and build the product tree when resolve flag is true', async () => {
      const grandchild = ModelFactory.product();
      const child1 = ModelFactory.product({
        childProductIds: [grandchild.productId],
        childProducts: [grandchild],
      });
      const child2 = ModelFactory.product();
      // -1 to test when a child product isn't returned from search
      // object literal for children to model the decoration now done outside of decorators
      const expectedProduct = ModelFactory.pricedProduct({
        childProductIds: [child1.productId, child2.productId, -1],
        childProducts: [
          {
            ...child1,
            available: true,
            subscriptionIds: [],
            childProducts: [
              { ...grandchild, available: true, subscriptionIds: [] },
            ],
          },
          { ...child2, available: true, subscriptionIds: [] },
        ],
        available: true,
        subscriptionIds: [],
      } as any as PricedProduct);
      const productIds = [
        expectedProduct.productId,
        child1.productId,
        child2.productId,
        grandchild.productId,
      ];
      const searchResults: Product[] = [
        _.omit(expectedProduct, 'childProducts') as PricedProduct,
        _.omit(child1, 'childProducts') as PricedProduct,
        child2,
        grandchild,
      ];

      mockDao
        .expects('findDescendantProductIds')
        .withExactArgs(expectedProduct.productId)
        .returns(productIds);
      mockDao
        .expects('find')
        .withExactArgs({ ids: productIds })
        .resolves(searchResults);
      mockDigestManager
        .expects('getDigestRulesByContext')
        .withExactArgs({})
        .resolves([]);
      mockPtMan
        .expects('isProductTypeAvailableForContext')
        .withExactArgs(expectedProduct.productTypeId, {})
        .resolves(true);

      decorator
        .expects('apply')
        .withExactArgs(
          sinon.match.array,
          [sinon.match.func, sinon.match.func, sinon.match.func],
          {},
        )
        .resolves();

      const product = await manager.findOneByProductIdOrFail(
        expectedProduct.productId,
        true,
      );
      assert.deepEqual(product, expectedProduct);
      sinon.verify();
    });
    it('blows up if no product is found', async () => {
      const productId = 1;
      mockDao
        .expects('findDescendantProductIds')
        .withExactArgs(productId)
        .returns([]);

      try {
        await manager.findOneByProductIdOrFail(productId, true, {});
        assert.fail();
      } catch (err) {
        assert.equal(err.name, Exception.NotFound.name, err);
        assert.deepEqual(err.errors, [
          `No Product found for productId: ${productId}`,
        ]);
      }
      sinon.verify();
    });
    it('executes search and use the customer and site being passed with no inmateJWT and returns the result when enforce flag is true', async () => {
      const customerId = 'I-003320';
      const siteId = '09340';
      const expectedProduct = ModelFactory.product();
      const searchContext: Context = {
        enforce: true,
        customerId,
        siteId,
      };
      const searchResults = [expectedProduct];

      mockDao.expects('findDescendantProductIds').never();
      mockDao
        .expects('find')
        .withExactArgs({ ids: [expectedProduct.productId] })
        .returns(searchResults);
      mockDigestManager
        .expects('getDigestRulesByContext')
        .withExactArgs(searchContext)
        .resolves([]);
      mockPtMan
        .expects('isProductTypeAvailableForContext')
        .withExactArgs(expectedProduct.productTypeId, searchContext)
        .resolves(true);
      decorator
        .expects('apply')
        .withExactArgs(
          sinon.match.array,
          [sinon.match.func, sinon.match.func, sinon.match.func],
          searchContext,
        )
        .resolves();

      const product = await manager.findOneByProductIdOrFail(
        expectedProduct.productId,
        false,
        {},
        searchContext,
      );

      assert.deepEqual(product, expectedProduct);
      sinon.verify();
    });
    it('executes search and the context is overridden with the inmateJWT rather than the passed customer and site id', async () => {
      const customerId = 'I-003320';
      const siteId = '09340';
      const expectedProduct = ModelFactory.product();
      const inmateJwt = SecurityFactory.inmateJwt();
      const search = {
        match: { productId: expectedProduct.productId },
        context: {
          enforce: true,
          customerId: inmateJwt.customerId,
          siteId: inmateJwt.siteId,
        },
      };
      const searchResults = [expectedProduct];

      mockDao.expects('findDescendantProductIds').never();
      mockDao
        .expects('find')
        .withExactArgs({ ids: [expectedProduct.productId] })
        .returns(searchResults);
      const searchContext: Context = {
        enforce: true,
        customerId,
        siteId,
      };
      mockDigestManager
        .expects('getDigestRulesByContext')
        .withExactArgs(search.context)
        .resolves([]);
      mockPtMan
        .expects('isProductTypeAvailableForContext')
        .withExactArgs(expectedProduct.productTypeId, search.context)
        .resolves(true);
      decorator
        .expects('apply')
        .withExactArgs(
          sinon.match.array,
          [sinon.match.func, sinon.match.func, sinon.match.func],
          search.context,
        )
        .resolves();
      const product = await manager.findOneByProductIdOrFail(
        expectedProduct.productId,
        false,
        { inmateJwt },
        searchContext,
      );

      assert.deepEqual(product, expectedProduct);
      sinon.verify();
    });
    it('should throw an 404 if the productType is not available and enforce = true', async () => {
      const expectedProduct = ModelFactory.product();
      const searchContext: Context = { enforce: true };
      const searchResults = [expectedProduct];

      mockDao.expects('findDescendantProductIds').never();
      mockDao
        .expects('find')
        .withExactArgs({ ids: [expectedProduct.productId] })
        .returns(searchResults);
      mockDigestManager.expects('getDigestRulesByContext').never();
      mockPtMan
        .expects('isProductTypeAvailableForContext')
        .withExactArgs(expectedProduct.productTypeId, searchContext)
        .resolves(false);
      decorator.expects('apply').never();

      try {
        await manager.findOneByProductIdOrFail(
          expectedProduct.productId,
          false,
          {},
          searchContext,
        );
        assert.fail();
      } catch (error) {
        assert.equal(error.name, Exception.NotFound.name, error);
        assert.deepEqual(error.errors, [
          `No Product found for productId: ${expectedProduct.productId}`,
        ]);
        sinon.verify();
      }
    });
  });
  describe('searchOneOrFail', () => {
    it('executes search and returns the first result', async () => {
      const expectedProduct = ModelFactory.product();
      const expectedResults: Paginated<Product> = {
        data: [expectedProduct],
        total: 1,
        pageNumber: 0,
        pageSize: 25,
      };
      mockDao
        .expects('search')
        .withArgs({
          match: { productId: 1 },
          context: { customerId: '1' },
        })
        .returns(expectedResults);
      decorator
        .expects('apply')
        .withArgs(sinon.match.array, [
          sinon.match.func,
          sinon.match.func,
          sinon.match.func,
          sinon.match.func,
        ])
        .resolves();

      const product = await manager.searchOneOrFail({
        match: { productId: 1 },
        context: { customerId: '1' },
      });
      assert.deepEqual(product, expectedProduct);
      sinon.verify();
    });
    it('blows up if no product is found', async () => {
      const expectedResults: Paginated<Product> = {
        data: [],
        total: 0,
        pageNumber: 0,
        pageSize: 25,
      };
      mockDao
        .expects('search')
        .withArgs({
          match: { productId: 1 },
          context: { customerId: '1', siteId: '2' },
        })
        .returns(expectedResults);
      decorator
        .expects('apply')
        .withArgs(sinon.match.array, [
          sinon.match.func,
          sinon.match.func,
          sinon.match.func,
          sinon.match.func,
        ])
        .resolves();

      try {
        await manager.searchOneOrFail({
          match: { productId: 1 },
          context: { customerId: '1', siteId: '2' },
        });
        assert.fail();
      } catch (err) {
        assert.equal(err.name, Exception.NotFound.name, err);
        assert.deepEqual(err.errors, [
          `No Product found matching { match: { productId: 1 }, context: { customerId: '1', siteId: '2' } }`,
        ]);
      }
      sinon.verify();
    });
  });
  describe('searchByQueryString', () => {
    it('should call the dao to get search then call search', async () => {
      mockDao
        .expects('getSearchFromQueryString')
        .withExactArgs({ foo: 'bar' })
        .resolves({ foo: 'bar' });
      const searchStub = sinon
        .stub(manager, 'search')
        .withArgs({ foo: 'bar' })
        .resolves();
      await manager.searchByQueryString({ foo: 'bar' });
      expect(searchStub.calledOnce).to.equal(true);
      mockDao.verify();
    });
    it('should transcode the orderBy in raw fashion if productTypeId is specified in the query', async () => {
      mockDao
        .expects('getSearchFromQueryString')
        .withExactArgs({ productTypeId: 'bar', orderBy: 'meta.genres:desc' })
        .resolves({
          productTypeId: 'bar',
          orderBy: [{ [`document->'meta'->>'rating'`]: 'DESC' }],
        });
      const searchStub = sinon
        .stub(manager, 'search')
        .withArgs({
          productTypeId: 'bar',
          orderBy: [{ 'meta.genres': 'DESC' }],
        })
        .resolves();
      await manager.searchByQueryString({
        productTypeId: 'bar',
        orderBy: 'meta.genres:desc',
      });
      expect(searchStub.calledOnce).to.equal(true);
      mockDao.verify();
    });
    it('should ignore order by if productTypeId is provide but orderBy is not', async () => {
      mockDao
        .expects('getSearchFromQueryString')
        .withExactArgs({ productTypeId: 'bar' })
        .resolves({ productTypeId: 'bar' });
      const searchStub = sinon
        .stub(manager, 'search')
        .withArgs({ productTypeId: 'bar' })
        .resolves();
      await manager.searchByQueryString({ productTypeId: 'bar' });
      expect(searchStub.calledOnce).to.equal(true);
      mockDao.verify();
    });
  });
  describe('createProduct', () => {
    it('sets product defaults from productType and calls the productDao for create', async () => {
      const jsonSchema = await ModelFactory.testMovieSchema();
      const product = _.omit(
        ModelFactory.productFromSchema(jsonSchema, {
          meta: { effectivePrice: { rental: 1.5 } },
          isBlocked: false,
        }),
        'purchaseCode',
      ) as Product;
      delete product.source; // code coverage
      const productType = {
        purchaseCode: 'VIDEO',
        purchaseTypes: ['rental'],
        productTypeGroupId: 'movie',
        subscribable: false,
        fulfillmentType: 'digital',
        jsonSchema,
      };
      const resultProduct = {
        ...product,
        purchaseCode: 'VIDEO',
        purchaseTypes: ['rental'],
        subscribable: false,
        fulfillmentType: 'digital',
      };

      mockPtMan
        .expects('getProductType')
        .withArgs('movie')
        .resolves(productType);

      addAutoReviewExpectations(resultProduct, true);

      mockProductPublishManager
        .expects('publishProductMessage')
        .withExactArgs(resultProduct)
        .resolves();

      mockPtMan
        .expects('isFieldPartOfSchema')
        .withExactArgs(productType, 'meta.thumbnailApproved')
        .resolves(false);
      mockPtMan
        .expects('isFieldPartOfSchema')
        .withExactArgs(productType, 'meta.genres')
        .resolves(false);

      await manager.createProduct(_.cloneDeep(product), context);
      sinon.verify();
    });
    it('sets product defaults from productType, handles missing productTypeGroupId', async () => {
      const jsonSchema = await ModelFactory.testMovieSchema();
      const createdProduct = _.omit(
        ModelFactory.productFromSchema(jsonSchema, {
          productTypeGroupId: 'movie',
          isBlocked: false,
        }),
        'purchaseCode',
      ) as Product;
      delete createdProduct.source; // code coverage
      const sentProduct = _.omit(
        createdProduct,
        'productTypeGroupId',
      ) as Product;
      const productType = {
        purchaseCode: 'VIDEO',
        purchaseTypes: ['rental'],
        productTypeGroupId: 'movie',
        subscribable: false,
        fulfillmentType: 'digital',
        jsonSchema,
      };
      const resultProduct = {
        ...createdProduct,
        purchaseCode: 'VIDEO',
        purchaseTypes: ['rental'],
        subscribable: false,
        fulfillmentType: 'digital',
      };
      mockPtMan
        .expects('getProductType')
        .withArgs('movie')
        .resolves(productType);

      addAutoReviewExpectations(resultProduct, true);

      mockProductPublishManager
        .expects('publishProductMessage')
        .withExactArgs(resultProduct)
        .resolves();

      mockPtMan
        .expects('isFieldPartOfSchema')
        .withExactArgs(productType, 'meta.thumbnailApproved')
        .resolves(false);
      mockPtMan
        .expects('isFieldPartOfSchema')
        .withExactArgs(productType, 'meta.genres')
        .resolves(false);

      await manager.createProduct(_.cloneDeep(sentProduct), { apiKey: 'test' });
      sinon.verify();
    });
    it('omits purchaseOptions and childProducts from the call to the productDao for create', async () => {
      const jsonSchema = await ModelFactory.testMovieSchema();
      const product = _.omit(
        ModelFactory.productFromSchema(jsonSchema, { isBlocked: false }),
        'purchaseCode',
      ) as Product;
      const pricedProduct = ModelFactory.pricedProduct();
      product.purchaseOptions = pricedProduct.purchaseOptions;
      product.childProducts = [];
      const productType = {
        purchaseCode: 'VIDEO',
        purchaseTypes: ['rental'],
        productTypeGroupId: 'movie',
        subscribable: false,
        jsonSchema,
      };
      const resultProduct = {
        ...product,
        purchaseCode: 'VIDEO',
        purchaseTypes: ['rental'],
        productTypeGroupId: 'movie',
        subscribable: false,
      };

      mockPtMan
        .expects('getProductType')
        .withArgs('movie')
        .resolves(productType);

      addAutoReviewExpectations(resultProduct, true);

      mockProductPublishManager
        .expects('publishProductMessage')
        .withExactArgs(resultProduct)
        .resolves();
      mockPtMan
        .expects('isFieldPartOfSchema')
        .withExactArgs(productType, 'meta.thumbnailApproved')
        .resolves(false);
      mockPtMan
        .expects('isFieldPartOfSchema')
        .withExactArgs(productType, 'meta.genres')
        .resolves(false);

      await manager.createProduct(_.cloneDeep(product), { apiKey: 'test' });
      sinon.verify();
    });
    it("adds the product to it's parent's childProductIds array", async () => {
      const vendorParentProductId = '253262';
      const purchaseCode = 'VIDEO';
      const purchaseTypes = ['rental'];
      const subscribable = false;
      const product = ModelFactory.product({
        source: { vendorParentProductId, productTypeId: 'movie' },
        purchaseTypes,
        purchaseCode,
        subscribable,
        isBlocked: false,
      });
      const productType = {
        purchaseCode,
        purchaseTypes,
        productTypeGroupId: 'movie',
        subscribable,
        jsonSchema: {},
      };
      const parentProduct = ModelFactory.product({
        source: {
          vendorProductId: vendorParentProductId,
          vendorName: product.source.vendorName,
        },
        purchaseTypes,
      });
      mockPtMan
        .expects('getProductType')
        .withArgs(product.productTypeId)
        .resolves(productType);
      mockParentProductManager
        .expects('getParentProduct')
        .withExactArgs(
          {
            ...product,
            subscribable,
          },
          productType,
        )
        .resolves(parentProduct);
      mockPtMan
        .expects('isFieldPartOfSchema')
        .withExactArgs(productType, 'meta.thumbnailApproved')
        .resolves(false);
      mockPtMan
        .expects('isFieldPartOfSchema')
        .withExactArgs(productType, 'meta.genres')
        .resolves(false);

      addAutoReviewExpectations(product, true, parentProduct);

      mockParentProductManager
        .expects('addChildToParent')
        .withExactArgs(product.productId, parentProduct.productId, context)
        .resolves();
      mockParentProductManager
        .expects('setParentSubscriptionAvailability')
        .withExactArgs(product, parentProduct, context)
        .resolves(parentProduct);
      mockProductPublishManager
        .expects('publishProductMessage')
        .withExactArgs(product)
        .resolves();
      mockProductPublishManager
        .expects('publishProductMessage')
        .withExactArgs(parentProduct)
        .resolves();

      await manager.createProduct(_.cloneDeep(product), context);
      sinon.verify();
    });
    it('"rollsback" the create if updating the parent fails', async () => {
      const vendorParentProductId = '253262';
      const purchaseCode = 'VIDEO';
      const purchaseTypes = ['rental'];
      const subscribable = false;
      const product = ModelFactory.product({
        source: { vendorParentProductId, productTypeId: 'movie' },
        purchaseTypes,
        purchaseCode,
        isBlocked: false,
      });
      const parentProduct = ModelFactory.product({
        source: {
          vendorProductId: vendorParentProductId,
          vendorName: product.source.vendorName,
        },
        isBlocked: false,
      });
      const exception = Exception.InternalError('This is an error');
      const productType = {
        purchaseCode,
        purchaseTypes,
        productTypeGroupId: 'movie',
        subscribable,
        jsonSchema: {},
      };
      mockPtMan
        .expects('getProductType')
        .withArgs(product.productTypeId)
        .resolves(productType);
      mockParentProductManager
        .expects('getParentProduct')
        .withExactArgs(
          {
            ...product,
            subscribable,
          },
          productType,
        )
        .resolves(parentProduct);
      mockPtMan
        .expects('isFieldPartOfSchema')
        .withExactArgs(productType, 'meta.thumbnailApproved')
        .resolves(false);
      mockPtMan
        .expects('isFieldPartOfSchema')
        .withExactArgs(productType, 'meta.genres')
        .resolves(false);

      addAutoReviewExpectations(
        { ...product, subscribable },
        true,
        parentProduct,
      );
      mockParentProductManager
        .expects('addChildToParent')
        .withExactArgs(product.productId, parentProduct.productId, context)
        .rejects(exception);
      mockParentProductManager
        .expects('setParentSubscriptionAvailability')
        .never();
      mockDao.expects('delete').withExactArgs(product.productId, context);
      mockProductPublishManager.expects('publishProductMessage').never();

      try {
        await manager.createProduct(_.cloneDeep(product), context);
        expect.fail();
      } catch (err) {
        expect(err).to.deep.equal(exception);
      }
      sinon.verify();
    });
    it("prevents you from adding a product if it's parent isn't created yet", async () => {
      const vendorParentProductId = '253262';
      const purchaseCode = 'VIDEO';
      const purchaseTypes = ['rental'];
      const subscribable = false;
      const product = ModelFactory.product({
        source: { vendorParentProductId, productTypeId: 'movie' },
        purchaseTypes,
        purchaseCode,
        subscribable,
        isBlocked: false,
      });
      const productType = {
        purchaseCode,
        purchaseTypes,
        subscribable,
        jsonSchema: {},
        productTypeGroupId: 'movie',
      };
      mockPtMan
        .expects('getProductType')
        .withArgs(product.productTypeId)
        .resolves(productType);
      mockParentProductManager
        .expects('getParentProduct')
        .withExactArgs(product, productType)
        .resolves(undefined);
      mockPtMan
        .expects('isFieldPartOfSchema')
        .withExactArgs(productType, 'meta.thumbnailApproved')
        .resolves(false);
      mockPtMan
        .expects('isFieldPartOfSchema')
        .withExactArgs(productType, 'meta.genres')
        .resolves(false);

      mockDao.expects('create').never();
      mockParentProductManager.expects('addChildToParent').never();
      mockParentProductManager
        .expects('setParentSubscriptionAvailability')
        .never();
      mockProductPublishManager.expects('publishProductMessage').never();

      try {
        await manager.createProduct(_.cloneDeep(product), context);
        expect.fail();
      } catch (err) {
        expect(err.name).to.equal(Exception.UnprocessableEntity.name);
        expect(err.errors).to.deep.equal([
          `Can not create product for vendorProductId: ${product.source.vendorProductId} ` +
            `and vendor name: ${product.source.vendorName} because parent product with vendorProductId: ` +
            `${product.source.vendorParentProductId} does not yet exist.`,
        ]);
      }

      sinon.verify();
    });
    it('adds the parentProduct values to the child product', async () => {
      const vendorParentProductId = '253262';
      const purchaseCode = 'MUSIC';
      const purchaseTypes = ['purchase'];
      const subscribable = false;
      const releaseYear = 3022;
      const product = ModelFactory.product({
        productTypeId: 'track',
        productTypeGroupId: 'music',
        purchaseCode: purchaseCode,
        purchaseTypes: purchaseTypes,
        source: { vendorParentProductId, productTypeId: 'track' },
        meta: { thumbnailApproved: ThumbnailApprovedStatus.Pending },
        subscribable,
        isBlocked: false,
      });

      const parentProduct = ModelFactory.product({
        productTypeId: 'album',
        productTypeGroupId: 'music',
        purchaseCode: purchaseCode,
        purchaseTypes: purchaseTypes,
        meta: {
          thumbnail: 'album image',
          thumbnailApproved: ThumbnailApprovedStatus.Pending,
          releaseYear: releaseYear,
        },
        source: {
          vendorProductId: vendorParentProductId,
          vendorName: product.source.vendorName,
          productTypeId: 'album',
        },
      } as any);
      const productType = {
        purchaseCode,
        purchaseTypes,
        productTypeGroupId: 'music',
        subscribable,
        jsonSchema: {},
      };

      mockPtMan
        .expects('getProductType')
        .withArgs(product.productTypeId)
        .resolves(productType);
      // omit parent productValues from lookup as it won't be there at lookup time
      mockParentProductManager
        .expects('getParentProduct')
        .withExactArgs(
          _.omit(product, 'parentProductId', 'meta.releaseYear'),
          productType,
        )
        .resolves(parentProduct);
      mockPtMan
        .expects('isFieldPartOfSchema')
        .withExactArgs(productType, 'meta.thumbnailApproved')
        .resolves(true);
      mockPtMan
        .expects('isFieldPartOfSchema')
        .withExactArgs(productType, 'meta.genres')
        .resolves(true);

      const expectedProduct = {
        ...product,
        subscribable,
        parentProductId: parentProduct.productId,
        meta: {
          ...product.meta,
          albumName: parentProduct.meta.name,
          thumbnailApproved: ThumbnailApprovedStatus.Pending,
          thumbnail: 'album image',
          releaseYear: releaseYear,
        },
      };
      addAutoReviewExpectations(expectedProduct, true, parentProduct);

      mockParentProductManager
        .expects('addChildToParent')
        .withExactArgs(product.productId, parentProduct.productId, context)
        .resolves();
      mockParentProductManager
        .expects('setParentSubscriptionAvailability')
        .withExactArgs(expectedProduct, parentProduct, context)
        .resolves(parentProduct);
      mockProductPublishManager
        .expects('publishProductMessage')
        .withExactArgs(expectedProduct)
        .resolves();
      mockProductPublishManager
        .expects('publishProductMessage')
        .withExactArgs(parentProduct)
        .resolves();

      await manager.createProduct(_.cloneDeep(product), context);
      sinon.verify();
    });
    it("prevents you from adding a product if it's parent product Type id isn't available", async () => {
      const vendorParentProductId = '253262';
      const purchaseCode = 'VIDEO';
      const purchaseTypes = ['rental'];
      const subscribable = false;
      const product = ModelFactory.product({
        source: { vendorParentProductId, productTypeId: 'movie' },
      });
      const productType = {
        purchaseCode,
        purchaseTypes,
        subscribable,
        jsonSchema: {},
        productTypeId: 'movie',
      };
      mockPtMan
        .expects('getProductType')
        .withArgs(product.productTypeId)
        .resolves(productType);
      mockPtMan
        .expects('getValueFromJsonSchemaByFieldName')
        .withArgs(productType, 'parentProductTypeId')
        .resolves([]);
      mockPtMan
        .expects('isFieldPartOfSchema')
        .withExactArgs(productType, 'meta.thumbnailApproved')
        .resolves(false);
      mockPtMan
        .expects('isFieldPartOfSchema')
        .withExactArgs(productType, 'meta.genres')
        .resolves(false);

      mockDao.expects('findOne').never();
      mockDao.expects('create').never();
      mockParentProductManager.expects('addChildToParent').never();
      mockParentProductManager
        .expects('setParentSubscriptionAvailability')
        .never();
      mockProductPublishManager.expects('publishProductMessage').never();

      try {
        await manager.createProduct(_.cloneDeep(product), context);
        expect.fail();
      } catch (err) {
        expect(err.name).to.equal(Exception.UnprocessableEntity.name);
        expect(err.errors).to.deep.equal([
          `Can not create product for vendorProductId: ${product.source.vendorProductId} ` +
            `and vendor name: ${product.source.vendorName} because parent product type for the productType: ` +
            `${productType.productTypeId} does not yet exist.`,
        ]);
      }

      sinon.verify();
    });
    it('defaults the thumbnailApproved to pending for productTypeId album', async () => {
      const purchaseCode = 'MUSIC';
      const purchaseTypes = ['purchase'];
      const subscribable = false;
      const product = ModelFactory.product({
        productTypeId: 'album',
        productTypeGroupId: 'music',
        purchaseCode: purchaseCode,
        purchaseTypes: purchaseTypes,
        source: { productTypeId: 'album' },
        isBlocked: false,
      });

      const productType = {
        purchaseCode,
        purchaseTypes,
        productTypeGroupId: 'music',
        subscribable,
        jsonSchema: {},
      };

      mockPtMan
        .expects('getProductType')
        .withArgs(product.productTypeId)
        .resolves(productType);
      mockPtMan
        .expects('isFieldPartOfSchema')
        .withArgs(productType, 'meta.thumbnailApproved')
        .resolves(true);
      mockPtMan
        .expects('isFieldPartOfSchema')
        .withExactArgs(productType, 'meta.genres')
        .resolves(true);

      const resultProduct = {
        ...product,
        subscribable,
        meta: {
          ...product.meta,
          thumbnailApproved: ThumbnailApprovedStatus.Pending,
        },
      };
      addAutoReviewExpectations(resultProduct, true);

      mockProductPublishManager
        .expects('publishProductMessage')
        .withExactArgs(resultProduct)
        .resolves();

      await manager.createProduct(_.cloneDeep(product), context);
      sinon.verify();
    });
    it('defaults the genre from meta to source productTypeId, album.', async () => {
      const purchaseCode = 'MUSIC';
      const purchaseTypes = ['purchase'];
      const subscribable = false;
      const genres: string[] = [
        faker.random.arrayElement([
          'pop',
          'rock',
          'latin',
          'latin/rock',
          'latin/pop',
        ]),
      ];
      const product = ModelFactory.product({
        productTypeId: 'album',
        productTypeGroupId: 'music',
        purchaseCode: purchaseCode,
        purchaseTypes: purchaseTypes,
        source: { productTypeId: 'album' },
        meta: { genres: genres },
        isBlocked: false,
      });

      const productType = {
        purchaseCode,
        purchaseTypes,
        productTypeGroupId: 'music',
        subscribable,
        jsonSchema: {},
      };

      const resultProduct = {
        ...product,
        subscribable,
        source: { ...product.source, genres: genres },
        meta: {
          ...product.meta,
          thumbnailApproved: ThumbnailApprovedStatus.Pending,
        },
      };

      mockPtMan
        .expects('getProductType')
        .withArgs(product.productTypeId)
        .resolves(productType);
      mockPtMan
        .expects('isFieldPartOfSchema')
        .withArgs(productType, 'meta.thumbnailApproved')
        .resolves(true);
      mockPtMan
        .expects('isFieldPartOfSchema')
        .withExactArgs(productType, 'meta.genres')
        .resolves(true);

      addAutoReviewExpectations(resultProduct, true);

      mockProductPublishManager
        .expects('publishProductMessage')
        .withExactArgs(resultProduct)
        .resolves();

      await manager.createProduct(_.cloneDeep(product), context);
      sinon.verify();
    });
    it('defaults the genre from source to meta productTypeId, album.', async () => {
      const purchaseCode = 'MUSIC';
      const purchaseTypes = ['purchase'];
      const subscribable = false;
      const genres: string[] = [
        faker.random.arrayElement([
          'pop',
          'rock',
          'latin',
          'latin/rock',
          'latin/pop',
        ]),
      ];
      const productType = {
        productTypeId: 'album',
        purchaseCode,
        purchaseTypes,
        productTypeGroupId: 'music',
        subscribable,
        jsonSchema: ModelFactory.testAlbumSchema(),
      };
      const product = ModelFactory.productFromSchema(productType.jsonSchema, {
        source: {
          vendorName: VendorNames.AudibleMagic,
          genres: genres,
          productTypeId: 'album',
        },
        meta: {
          basePrice: { purchase: 1.5 },
          thumbnail: faker.random.word(),
          genres: ['random'],
          thumbnailApproved: ThumbnailApprovedStatus.Pending,
        },
        subscribable: false,
        isBlocked: false,
      });

      mockPtMan
        .expects('getProductType')
        .withArgs(product.productTypeId)
        .resolves(productType);
      mockPtMan
        .expects('isFieldPartOfSchema')
        .withArgs(productType, 'meta.thumbnailApproved')
        .resolves(true);
      mockPtMan
        .expects('isFieldPartOfSchema')
        .withExactArgs(productType, 'meta.genres')
        .resolves(true);

      const distinctGenreValueGenre = {
        [DistinctProductFieldPath.Genres]: {
          [product.source.genres[0]]: ModelFactory.distinctProductValue({
            sourceValueName: product.source.genres[0],
            fieldPath: DistinctProductFieldPath.Genres,
            productTypeGroupId: product.productTypeGroupId,
          }),
        },
      };

      const distinctValuePurchase = {
        'meta.basePrice.purchase': {
          [product.meta.basePrice.purchase.toString()]:
            ModelFactory.distinctProductValue({
              sourceValueName: product.meta.basePrice.purchase.toString(),
              fieldPath: 'meta.basePrice.purchase',
              productTypeGroupId: product.productTypeGroupId,
            }),
        },
      };

      const jsp = new JsonSchemaParser(productType.jsonSchema);
      const schemas = jsp.getSchemasWithField(SpAttributes.DistinctValue);

      mockDistinctProductValueManager
        .expects('getOrCreateValueTableRecordsForField')
        .withExactArgs(
          _.find(schemas, { distinctValue: DistinctProductFieldPath.Genres }),
          product,
          context,
        )
        .once()
        .resolves(distinctGenreValueGenre);
      mockDistinctProductValueManager
        .expects('getOrCreateValueTableRecordsForField')
        .withExactArgs(
          _.find(schemas, { distinctValue: 'meta.categories' }),
          product,
          context,
        )
        .once()
        .resolves();
      mockDistinctProductValueManager
        .expects('getOrCreateValueTableRecordsForField')
        .withExactArgs(
          _.find(schemas, { distinctValue: 'meta.basePrice.purchase' }),
          product,
          context,
        )
        .once()
        .resolves(distinctValuePurchase);

      const resultProduct = {
        ...product,
        subscribable,
        meta: {
          ...product.meta,
          genres: [
            distinctGenreValueGenre[DistinctProductFieldPath.Genres][
              product.source.genres[0]
            ].displayName,
          ],
          thumbnailApproved: ThumbnailApprovedStatus.Pending,
        },
      };

      addAutoReviewExpectations(resultProduct, true);

      mockProductPublishManager
        .expects('publishProductMessage')
        .withExactArgs(resultProduct)
        .resolves();

      await manager.createProduct(_.cloneDeep(product), context);
      sinon.verify();
    });
    it('defaults multiple genres from source to meta for productTypeId, album.', async () => {
      const purchaseCode = 'MUSIC';
      const purchaseTypes = ['purchase'];
      const subscribable = false;
      const productType = {
        productTypeId: 'album',
        purchaseCode,
        purchaseTypes,
        productTypeGroupId: 'music',
        subscribable,
        jsonSchema: ModelFactory.testAlbumSchema(),
      };
      const product = ModelFactory.productFromSchema(productType.jsonSchema, {
        source: {
          vendorName: VendorNames.AudibleMagic,
          genres: ['pop', 'rock', 'pop1', 'hip', 'hop'],
          productTypeId: 'album',
        },
        meta: {
          basePrice: { purchase: 1.5 },
          thumbnail: faker.random.word(),
          genres: ['random'],
          thumbnailApproved: ThumbnailApprovedStatus.Pending,
        },
        subscribable: false,
        isBlocked: false,
      });

      mockPtMan
        .expects('getProductType')
        .withArgs(product.productTypeId)
        .resolves(productType);
      mockPtMan
        .expects('isFieldPartOfSchema')
        .withArgs(productType, 'meta.thumbnailApproved')
        .resolves(true);
      mockPtMan
        .expects('isFieldPartOfSchema')
        .withExactArgs(productType, 'meta.genres')
        .resolves(true);

      const distinctProduct = ModelFactory.distinctProductValue({
        sourceValueName: product.source.genres[0],
        displayName: product.source.genres[0],
        fieldPath: DistinctProductFieldPath.Genres,
        productTypeGroupId: product.productTypeGroupId,
      });

      const distinctGenreValue = {
        [DistinctProductFieldPath.Genres]: {
          [product.source.genres[0]]: distinctProduct, // pop
          [product.source.genres[1]]: ModelFactory.distinctProductValue({
            // rock
            sourceValueName: product.source.genres[1], // rock
            displayName: product.source.genres[1], // rock
            fieldPath: DistinctProductFieldPath.Genres,
            productTypeGroupId: product.productTypeGroupId,
          }),
          [product.source.genres[2]]: ModelFactory.distinctProductValue({
            // pop1
            sourceValueName: product.source.genres[2], // pop1
            displayName: product.source.genres[0], // pop
            fieldPath: DistinctProductFieldPath.Genres,
            productTypeGroupId: product.productTypeGroupId,
          }),
          [product.source.genres[3]]: ModelFactory.distinctProductValue({
            // hip
            sourceValueName: product.source.genres[1], // rock
            displayName: product.source.genres[1], // rock
            fieldPath: DistinctProductFieldPath.Genres,
            productTypeGroupId: product.productTypeGroupId,
          }),
          [product.source.genres[4]]: ModelFactory.distinctProductValue({
            // hop
            sourceValueName: product.source.genres[1], // rock
            displayName: product.source.genres[1], // rock
            fieldPath: DistinctProductFieldPath.Genres,
            productTypeGroupId: product.productTypeGroupId,
          }),
        },
      };

      const updatedGenres = [
        distinctGenreValue[DistinctProductFieldPath.Genres][
          product.source.genres[0]
        ].displayName,
        product.source.genres[1],
      ];

      const distinctGenreValuePurchase = {
        'meta.basePrice.purchase': {
          [product.meta.basePrice.purchase.toString()]:
            ModelFactory.distinctProductValue({
              sourceValueName: product.meta.basePrice.purchase.toString(),
              fieldPath: 'meta.basePrice.purchase',
              productTypeGroupId: product.productTypeGroupId,
            }),
        },
      };

      const jsp = new JsonSchemaParser(productType.jsonSchema);
      const schemas = jsp.getSchemasWithField(SpAttributes.DistinctValue);

      mockDistinctProductValueManager
        .expects('getOrCreateValueTableRecordsForField')
        .withExactArgs(
          _.find(schemas, { distinctValue: DistinctProductFieldPath.Genres }),
          product,
          context,
        )
        .resolves(distinctGenreValue);
      mockDistinctProductValueManager
        .expects('getOrCreateValueTableRecordsForField')
        .withExactArgs(
          _.find(schemas, { distinctValue: 'meta.categories' }),
          product,
          context,
        )
        .once()
        .resolves();
      mockDistinctProductValueManager
        .expects('getOrCreateValueTableRecordsForField')
        .withExactArgs(
          _.find(schemas, { distinctValue: 'meta.basePrice.purchase' }),
          product,
          context,
        )
        .once()
        .resolves(distinctGenreValuePurchase);

      const resultProduct = {
        ...product,
        subscribable,
        meta: {
          ...product.meta,
          genres: updatedGenres,
          thumbnailApproved: ThumbnailApprovedStatus.Pending,
        },
      };

      addAutoReviewExpectations(resultProduct, true);

      mockProductPublishManager
        .expects('publishProductMessage')
        .withExactArgs(resultProduct)
        .resolves();

      await manager.createProduct(_.cloneDeep(product), context);
      sinon.verify();
    });
  });

  describe('updateProduct', () => {
    it('sets product defaults from productType and calls the productDao for update', async () => {
      const jsonSchema = await ModelFactory.testMovieSchema();
      // Don't require these things to be set.
      _.pull(jsonSchema.required, 'purchaseCode');
      _.set(jsonSchema, 'properties.purchaseTypes.minItems', 0);
      const subscribable = false;

      const product = _.omit(
        ModelFactory.productFromSchema(jsonSchema, { isBlocked: false }),
        'purchaseCode',
      ) as Product;
      mockPtMan
        .expects('getProductType')
        .withArgs('movie')
        .resolves({
          purchaseCode: null,
          purchaseTypes: ['rental'],
          productTypeGroupId: 'movie',
          subscribable,
          jsonSchema,
        });

      const resultProduct = _.omit(
        {
          ...product,
          purchaseCode: undefined,
          purchaseTypes: ['rental'],
          subscribable,
          available: true,
          isBlocked: false,
          meta: { ...product.meta, effectivePrice: { rental: 1.5 } },
        },
        manager.getDecoratorFields(),
      );

      addAutoReviewExpectations(
        { ...product, subscribable, purchaseCode: undefined },
        false,
      );

      mockProductPublishManager
        .expects('publishProductMessage')
        .withExactArgs(resultProduct)
        .resolves();

      await manager.updateProduct(_.cloneDeep(product), context);
      sinon.verify();
    });
    it('should call to lookup parent product and set the subscription availability', async () => {
      const jsonSchema = await ModelFactory.testMovieSchema();
      const productType = {
        purchaseCode: 'VIDEO',
        purchaseTypes: ['rental'],
        productTypeGroupId: 'movie',
        subscribable: false,
        jsonSchema,
      };

      const product = ModelFactory.productFromSchema(jsonSchema, {
        source: { vendorParentProductId: '123' },
        isBlocked: false,
        ..._.omit(productType, 'jsonSchema'),
      });
      const parent = ModelFactory.productFromSchema(
        jsonSchema,
        _.omit(productType, 'jsonSchema'),
      );
      mockPtMan
        .expects('getProductType')
        .withArgs('movie')
        .resolves(productType);

      mockParentProductManager
        .expects('getParentProduct')
        .withExactArgs(product, productType)
        .resolves(parent);
      mockParentProductManager
        .expects('setParentSubscriptionAvailability')
        .withExactArgs(product, parent, { apiKey: 'test' })
        .resolves(parent);

      const resultProduct = _.omit(
        {
          ...product,
          ..._.omit(productType, 'jsonSchema'),
          available: true,
          isBlocked: false,
          meta: { ...product.meta, effectivePrice: { rental: 1.5 } },
        },
        manager.getDecoratorFields(),
      );
      addAutoReviewExpectations(product, false);
      mockProductPublishManager
        .expects('publishProductMessage')
        .withExactArgs(resultProduct)
        .resolves();

      await manager.updateProduct(product, context);
      sinon.verify();
    });
    it('should properly handle a productType that does not have "source" or parents', async () => {
      const jsonSchema = await ModelFactory.testSchema({
        required: [],
      } as SpLite);
      const typeProperties = {
        purchaseCode: 'DEVICE',
        purchaseTypes: ['purchase'],
        productTypeGroupId: 'device',
        subscribable: false,
      };
      const productType = {
        jsonSchema,
        ...typeProperties,
      };

      const product = ModelFactory.product({
        productTypeId: 'device',
        isBlocked: false,
      });
      delete product.source;
      mockPtMan
        .expects('getProductType')
        .withArgs('device')
        .resolves(productType);

      mockParentProductManager.expects('getParentProduct').never();
      mockParentProductManager
        .expects('setParentSubscriptionAvailability')
        .never();

      const resultProduct = _.omit(
        {
          ...product,
          ..._.omit(productType, 'jsonSchema'),
          available: true,
          isBlocked: false,
          meta: { ...product.meta, effectivePrice: { rental: 1.5 } },
        },
        manager.getDecoratorFields(),
      );
      addAutoReviewExpectations(
        { ...product, ...typeProperties },
        false,
        undefined,
        { ...product, ...typeProperties, isBlocked: undefined },
      );
      mockProductPublishManager
        .expects('publishProductMessage')
        .withExactArgs(resultProduct)
        .resolves();

      await manager.updateProduct(
        { ...product, isBlocked: undefined },
        context,
      );
      sinon.verify();
    });
  });
  describe('enforceSearchSecurityContext', () => {
    it('adds search context when an inmateJwt is provided', async () => {
      const search: Search = { match: { bob: 'bob' } };
      const inmateJwt = SecurityFactory.inmateJwt();
      const expectedResult: Search = {
        match: { bob: 'bob' },
        context: {
          enforce: true,
          customerId: inmateJwt.customerId,
          siteId: inmateJwt.siteId,
        },
      };

      const result = manager.enforceSearchSecurityContext(search, {
        inmateJwt,
      });

      assert.deepEqual(expectedResult, result);
    });
    it('adds search context when a facilityJwt:beta is provided', () => {
      const search: Search = { match: { bob: 'bob' } };
      const facilityJwtBeta = SecurityFactory.facilityJwtBeta();
      const expectedResult: Search = {
        match: { bob: 'bob' },
        context: {
          enforce: true,
          customerId: facilityJwtBeta.customerId,
        },
      };

      const result = manager.enforceSearchSecurityContext(search, {
        'facilityJwt:beta': facilityJwtBeta,
      });

      assert.deepEqual(expectedResult, result);
    });
    it('adds search context when a facilityJwt is provided', () => {
      const search: Search = { match: { bob: 'bob' } };
      const facilityJwt = SecurityFactory.facilityJwt();
      const expectedResult: Search = {
        match: { bob: 'bob' },
        context: {
          enforce: true,
          customerId: facilityJwt.customerId,
        },
      };

      const result = manager.enforceSearchSecurityContext(search, {
        facilityJwt,
      });

      assert.deepEqual(expectedResult, result);
    });
    it('does nothing when no relevant Jwt is provided', async () => {
      const search: Search = { match: { bob: 'bob' } };

      const result = manager.enforceSearchSecurityContext(search, {});

      assert.equal(search, result);
    });
  });
  describe('getDecoratorFields', () => {
    it('returns fields that have been added to products by decorators', async () => {
      const decoratorFields = manager.getDecoratorFields();
      expect(decoratorFields).to.deep.equal([
        'cache',
        'available',
        'meta.effectivePrice',
        'purchaseOptions',
        'subscriptionIds',
        'digest',
        'subscriptionIds',
      ]);
    });
  });
  describe('updateProductThumbnailStatus', () => {
    it('should fail if artApproval api service disabled', async () => {
      mockAppConfig
        .expects('get')
        .withExactArgs('cidnArtApprovalEndpoint')
        .returns({ enabled: false });
      try {
        const product = ModelFactory.product({ productTypeId: 'album' });
        await manager.updateProductThumbnailStatus(
          product,
          ThumbnailApprovedStatus.Approved,
          {},
        );
        assert.fail();
      } catch (err) {
        expect(err.name).to.equal(Exception.InternalError.name);
      }
      sinon.verify();
    });
    it('should update thumbnail status and call only legacy if there is no childProducts', async () => {
      const product = ModelFactory.product({ productTypeId: 'album' });
      delete product.childProductIds;
      mockAppConfig
        .expects('get')
        .withExactArgs('cidnArtApprovalEndpoint')
        .returns({ enabled: true });
      mockDao
        .expects('updateProductThumbnailStatus')
        .withArgs([product.productId], ThumbnailApprovedStatus.Blocked, {})
        .returns(1);

      // no childProducts - no call to CDN
      mockProductManager.expects('publishMessageToArtApprovalEndpoint').never();

      // legacy call
      const legacyMessage = {
        vendor: product.source.vendorName,
        media: {
          vendorProductId: product.source.vendorProductId,
          thumbnailApproved: ThumbnailApprovedStatus.Blocked,
        },
      };
      mockProductPublishManager
        .expects('publishProductMessage')
        .withExactArgs(product)
        .resolves();
      mockProductPublishManager
        .expects('publishLegacyMessage')
        .withExactArgs(legacyMessage)
        .resolves();

      await manager.updateProductThumbnailStatus(
        product,
        ThumbnailApprovedStatus.Blocked,
        {},
      );
      sinon.verify();
    });
    it('should update thumbnail status and call cdn with child elements and legacy with parent id', async () => {
      const status = ThumbnailApprovedStatus.Approved;
      const childProduct = ModelFactory.product({
        productId: 2,
        productTypeId: 'track',
      });
      const product = ModelFactory.product({
        productId: 1,
        productTypeId: 'album',
        childProducts: [childProduct],
        childProductIds: [childProduct.productId],
        meta: {
          genres: ['genre1', 'genre2'],
        },
      });
      mockAppConfig
        .expects('get')
        .withExactArgs('cidnArtApprovalEndpoint')
        .returns({ enabled: true });
      mockDao
        .expects('updateProductThumbnailStatus')
        .withArgs([1, 2], status, {})
        .returns(2);

      // cdn call
      const artApprovalParams: ThumbnailApprovalApiBody = {
        vendor: product.source.vendorName,
        artApproval: [
          {
            vendorProductId: childProduct.source.vendorProductId,
            thumbnailApproved: status,
            genres: childProduct.meta.genres,
          },
        ],
      };
      mockProductManager
        .expects('publishMessageToArtApprovalEndpoint')
        .withExactArgs(artApprovalParams);

      // legacy call
      const legacyMessage = {
        vendor: product.source.vendorName,
        media: {
          vendorProductId: product.source.vendorProductId,
          thumbnailApproved: ThumbnailApprovedStatus.Approved,
        },
      };
      mockProductPublishManager
        .expects('publishProductMessage')
        .once()
        .withExactArgs(product)
        .resolves();
      mockProductPublishManager
        .expects('publishLegacyMessage')
        .withExactArgs(legacyMessage)
        .resolves();

      const approvedChildMessage = { ...childProduct };
      approvedChildMessage.meta.thumbnailApproved = status;
      mockProductPublishManager
        .expects('publishProductMessage')
        .once()
        .withExactArgs(approvedChildMessage)
        .resolves();

      await manager.updateProductThumbnailStatus(
        product,
        ThumbnailApprovedStatus.Approved,
        {},
      );
      sinon.verify();
    });
    it('should update thumbnail status and call cdn with child elements and not alert the legacy system if that parameter is set to false', async () => {
      const status = ThumbnailApprovedStatus.Approved;
      const childProduct = ModelFactory.product({
        productId: 2,
        productTypeId: 'track',
      });
      const product = ModelFactory.product({
        productId: 1,
        productTypeId: 'album',
        childProducts: [childProduct],
        childProductIds: [childProduct.productId],
        meta: {
          genres: ['genre1', 'genre2'],
        },
      });
      mockAppConfig
        .expects('get')
        .withExactArgs('cidnArtApprovalEndpoint')
        .returns({ enabled: true });
      mockDao
        .expects('updateProductThumbnailStatus')
        .withArgs([1, 2], status, {})
        .returns([product, childProduct]);

      // cdn call
      const artApprovalParams: ThumbnailApprovalApiBody = {
        vendor: product.source.vendorName,
        artApproval: [
          {
            vendorProductId: childProduct.source.vendorProductId,
            thumbnailApproved: status,
            genres: childProduct.meta.genres,
          },
        ],
      };
      mockProductManager
        .expects('publishMessageToArtApprovalEndpoint')
        .withExactArgs(artApprovalParams);
      mockProductPublishManager
        .expects('publishProductMessage')
        .once()
        .withExactArgs(product)
        .resolves();

      const approvedChildMessage = { ...childProduct };
      approvedChildMessage.meta.thumbnailApproved = status;
      mockProductPublishManager
        .expects('publishProductMessage')
        .once()
        .withExactArgs(approvedChildMessage)
        .resolves();

      await manager.updateProductThumbnailStatus(
        product,
        ThumbnailApprovedStatus.Approved,
        {},
        false,
      );
      sinon.verify();
    });
    it('should call art approval API with provided baseUrl and artApprovalEndpoint', async () => {
      const cidnArtApprovalEndpoint = {
        enabled: true,
        baseUrl: 'https://artapproval-api',
        artApprovalEndpoint: 'prod/art-approval',
      };
      mockAppConfig
        .expects('get')
        .withExactArgs('cidnArtApprovalEndpoint')
        .returns(cidnArtApprovalEndpoint);

      const data: ThumbnailApprovalApiBody = {
        vendor: 'vendor',
        artApproval: [
          {
            vendorProductId: '123',
            thumbnailApproved: ThumbnailApprovedStatus.Approved,
            genres: ['genre1', 'genre2'],
          },
        ],
      };

      const url = new URL(
        `${cidnArtApprovalEndpoint.baseUrl}/${cidnArtApprovalEndpoint.artApprovalEndpoint}`,
      );

      const request = {
        url: url.toString(),
        responseType: 'json',
        method: 'POST',
        data,
        host: url.host,
        body: JSON.stringify(data),
        path: url.pathname,
        headers: {
          'content-type': 'application/json',
        },
      };

      const awsIamConfig = {
        accessKeyId: 'accessKeyId',
        secretAccessKey: 'secretAccessKey',
        sessionToken: undefined,
      };
      mockAWSUtils.expects('getAWSCredentials').resolves(awsIamConfig);

      mockAws4.expects('sign').withArgs(request, awsIamConfig).returns(request);
      mockProductManager
        .expects('axios')
        .withArgs(request)
        .returns(Promise.resolve());
      await manager.publishMessageToArtApprovalEndpoint(data);
      sinon.verify();
    });
    it('should failed if no aws credentials found', async () => {
      const cidnArtApprovalEndpoint = {
        enabled: true,
        baseUrl: 'https://artapproval-api',
        artApprovalEndpoint: 'prod/art-approval',
      };
      const data: ThumbnailApprovalApiBody = {
        vendor: 'Audible',
        artApproval: [
          {
            vendorProductId: '123',
            thumbnailApproved: ThumbnailApprovedStatus.Approved,
            genres: ['genre1', 'genre2'],
          },
        ],
      };
      try {
        mockAppConfig
          .expects('get')
          .withExactArgs('cidnArtApprovalEndpoint')
          .returns(cidnArtApprovalEndpoint);
        mockAWSUtils
          .expects('getAWSCredentials')
          .rejects(
            new Error('No IAM credentials provided for ART Approval API'),
          );
        await manager.publishMessageToArtApprovalEndpoint(data);
        assert.fail();
      } catch (err) {
        expect(err.message).to.equal(
          'No IAM credentials provided for ART Approval API',
        );
      }
    });
  });

  describe('updateProductThumbnailStatusBulk', () => {
    it('should update thumbnail status and call only legacy if there is no childProducts', async () => {
      const productIds = [1];
      const status = ThumbnailApprovedStatus.Blocked;
      const products = productIds.map((id) =>
        ModelFactory.product({ productId: id, productTypeId: 'album' }),
      );
      products[0].childProducts = [];
      products[0].childProductIds = [];
      // get albums
      mockDao
        .expects('find')
        .withArgs({
          ids: productIds,
          customClauses: [
            {
              clause: `document->>'productTypeId' = $1`,
              params: [ProductTypeIds.Album],
            },
          ],
        })
        .returns(products);

      mockDao
        .expects('updateProductThumbnailStatus')
        .withArgs(productIds, status, {})
        .returns(products);

      mockProductPublishManager
        .expects('publishProductMessageWithoutDigest')
        .withExactArgs(products[0])
        .resolves();

      // legacy call
      const legacyMessage = {
        vendor: products[0].source.vendorName,
        media: {
          vendorProductId: products[0].source.vendorProductId,
          thumbnailApproved: ThumbnailApprovedStatus.Blocked,
        },
      };
      mockProductPublishManager
        .expects('publishLegacyMessage')
        .withExactArgs(legacyMessage)
        .resolves();

      // no tracks - no call to CDN
      mockProductManager.expects('publishMessageToArtApprovalEndpoint').never();

      mockOpenSearchManager
        .expects('digestProductsIntoOpenSearch')
        .withExactArgs(products)
        .resolves();

      await manager.updateProductThumbnailStatusBulk(productIds, status, {});
      sinon.verify();
    });

    it('should throw an error in to many ids were added to the endpoint call', async () => {
      const productIds = _.range(101);
      const status = ThumbnailApprovedStatus.Blocked;

      try {
        await manager.updateProductThumbnailStatusBulk(productIds, status, {});
        assert.fail();
      } catch (err) {
        expect(err.name).to.equal(Exception.InvalidData.name);
      }
      sinon.verify();
    });

    it('should update thumbnail status and call cdn with child elements and legacy with parent id', async () => {
      const productIds = [1];
      const status = ThumbnailApprovedStatus.Approved;
      const vendorName = 'vendor';
      const albums = productIds.map((id) =>
        ModelFactory.product({
          productId: id,
          productTypeId: 'album',
          source: { vendorName },
          meta: { genres: ['genre1', 'genre2'] },
          childProductIds: [2],
        }),
      );
      const track = ModelFactory.product({
        productId: 2,
        productTypeId: 'track',
        parentProductId: 1,
        source: { vendorName },
        meta: { genres: ['genre1', 'genre2'] },
        childProductIds: [],
        childProducts: [],
      });
      const tracks = [track];

      // get albums
      mockDao
        .expects('find')
        .withArgs({
          ids: productIds,
          customClauses: [
            {
              clause: `document->>'productTypeId' = $1`,
              params: [ProductTypeIds.Album],
            },
          ],
        })
        .returns(albums);

      mockDao
        .expects('updateProductThumbnailStatus')
        .withArgs(
          [albums[0].productId, ...albums[0].childProductIds],
          status,
          {},
        )
        .returns([...albums, ...tracks]);

      mockProductPublishManager
        .expects('publishProductMessageWithoutDigest')
        .withExactArgs(albums[0])
        .resolves();

      mockProductPublishManager
        .expects('publishProductMessageWithoutDigest')
        .withExactArgs(tracks[0])
        .resolves();

      // legacy call
      const legacyMessage = {
        vendor: albums[0].source.vendorName,
        media: {
          vendorProductId: albums[0].source.vendorProductId,
          thumbnailApproved: ThumbnailApprovedStatus.Approved,
        },
      };
      mockProductPublishManager
        .expects('publishLegacyMessage')
        .withExactArgs(legacyMessage)
        .resolves();

      // cdn call
      const artApprovalParams: ThumbnailApprovalApiBody = {
        vendor: track.source.vendorName,
        artApproval: [
          {
            vendorProductId: track.source.vendorProductId,
            thumbnailApproved: status,
            genres: track.meta.genres,
          },
        ],
      };
      mockProductManager
        .expects('publishMessageToArtApprovalEndpoint')
        .withExactArgs(artApprovalParams);

      mockOpenSearchManager
        .expects('digestProductsIntoOpenSearch')
        .withExactArgs(albums)
        .resolves();
      mockOpenSearchManager
        .expects('digestProductsIntoOpenSearch')
        .withExactArgs(tracks)
        .resolves();

      await manager.updateProductThumbnailStatusBulk(productIds, status, {});
      sinon.verify();
    });
    it('should throw an error if digest to OS failed', async () => {
      const productIds = [1];
      const status = ThumbnailApprovedStatus.Approved;
      const vendorName = 'vendor';
      const albums = productIds.map((id) =>
        ModelFactory.product({
          productId: id,
          productTypeId: 'album',
          source: { vendorName },
          meta: { genres: ['genre1', 'genre2'] },
          childProductIds: [2],
        }),
      );
      const track = ModelFactory.product({
        productId: 2,
        productTypeId: 'track',
        parentProductId: 1,
        source: { vendorName },
        meta: { genres: ['genre1', 'genre2'] },
        childProductIds: [],
        childProducts: [],
      });
      const tracks = [track];

      // get albums
      mockDao
        .expects('find')
        .withArgs({
          ids: productIds,
          customClauses: [
            {
              clause: `document->>'productTypeId' = $1`,
              params: [ProductTypeIds.Album],
            },
          ],
        })
        .returns(albums);

      mockDao
        .expects('updateProductThumbnailStatus')
        .withArgs(
          [albums[0].productId, ...albums[0].childProductIds],
          status,
          {},
        )
        .returns([...albums, ...tracks]);

      mockProductPublishManager
        .expects('publishProductMessageWithoutDigest')
        .withExactArgs(albums[0])
        .resolves();

      mockProductPublishManager
        .expects('publishProductMessageWithoutDigest')
        .withExactArgs(tracks[0])
        .resolves();

      // legacy call
      const legacyMessage = {
        vendor: albums[0].source.vendorName,
        media: {
          vendorProductId: albums[0].source.vendorProductId,
          thumbnailApproved: ThumbnailApprovedStatus.Approved,
        },
      };
      mockProductPublishManager
        .expects('publishLegacyMessage')
        .withExactArgs(legacyMessage)
        .resolves();

      // cdn call
      const artApprovalParams: ThumbnailApprovalApiBody = {
        vendor: track.source.vendorName,
        artApproval: [
          {
            vendorProductId: track.source.vendorProductId,
            thumbnailApproved: status,
            genres: track.meta.genres,
          },
        ],
      };
      mockProductManager
        .expects('publishMessageToArtApprovalEndpoint')
        .withExactArgs(artApprovalParams);

      mockOpenSearchManager
        .expects('digestProductsIntoOpenSearch')
        .withExactArgs(albums)
        .throws(Exception.InternalError({ errors: `FooBoo` }));

      try {
        await manager.updateProductThumbnailStatusBulk(productIds, status, {});
        assert.fail();
      } catch (err) {
        expect(err.name).to.equal(Exception.InternalError.name);
      }
      sinon.verify();
    });
  });

  describe('searchProductsBySubscription', () => {
    it('throws 404 if productId is not found', async () => {
      const findOneStub = sinon
        .stub(manager, 'findOneByProductIdOrFail')
        .withArgs(123, false)
        .throws(
          Exception.NotFound({ errors: `No Product found matching 123` }),
        );
      try {
        const search: Search = {
          query: {
            productTypeId: 'spandex',
            clauses: {
              foo: ['bar'],
            },
          },
        };

        await manager.searchProductsBySubscription(search, '123');
        sinon.verify();
        assert.fail();
      } catch (err) {
        assert.equal(err.code, 404);
        assert.equal(findOneStub.calledOnce, true);
      }
    });
    it('calls the search for searchProductsBySubscription with query clauses', async () => {
      const search: Search = {
        query: {
          productTypeId: 'spandex',
          clauses: {
            foo: ['bar'],
          },
        },
      };
      const expectedResults: Paginated<Product> = {
        data: [ModelFactory.product()],
        total: 1,
        pageNumber: 0,
        pageSize: 25,
      };
      const findOneStub = sinon
        .stub(manager, 'findOneByProductIdOrFail')
        .withArgs(123, false)
        .resolves(ModelFactory.productSubscription());

      mockPtMan
        .expects('getProductTypes')
        .withArgs()
        .resolves(_.range(2).map(() => ModelFactory.productType()));
      mockOpenSearchManager
        .expects('search')
        .once()
        .withArgs('spandex', {
          ...search,
          context: { productId: '123' },
        })
        .returns(expectedResults);
      mockDao.expects('search').never();

      const actualResults = await manager.searchProductsBySubscription(
        search,
        '123',
      );
      sinon.verify();
      const testResults = {
        ...actualResults,
        data: _.map(actualResults.data, (ar) => _.omit(ar, 'purchaseOptions')),
      };
      assert.deepEqual(testResults, expectedResults);
      assert.equal(findOneStub.calledOnce, true);
    });
    it('calls the search for searchProductsBySubscription with empty match', async () => {
      const search: Search = {
        match: {},
      };
      const expectedResults: Paginated<Product> = {
        data: [ModelFactory.product()],
        total: 1,
        pageNumber: 0,
        pageSize: 25,
      };
      const findOneStub = sinon
        .stub(manager, 'findOneByProductIdOrFail')
        .withArgs(123, false)
        .resolves(ModelFactory.productSubscription());
      mockPtMan
        .expects('getProductTypes')
        .resolves(_.range(1).map(() => ModelFactory.productType()));
      mockDao.expects('search').never();
      mockOpenSearchManager
        .expects('search')
        .once()
        .withArgs('movie', {
          match: { productTypeId: 'movie' },
          context: { productId: '123' },
        })
        .returns(expectedResults);
      decorator.expects('apply').never();

      const actualResults = await manager.searchProductsBySubscription(
        search,
        '123',
      );
      sinon.verify();
      const testResults = {
        ...actualResults,
        data: _.map(actualResults.data, (ar) => _.omit(ar, 'purchaseOptions')),
      };
      assert.deepEqual(testResults, expectedResults);
      assert.equal(findOneStub.calledOnce, true);
    });
    it('calls the search for searchProductsBySubscription with match being single object', async () => {
      const search: Search = {
        match: { productId: 567 },
      };
      const expectedResults: Paginated<Product> = {
        data: [ModelFactory.product()],
        total: 1,
        pageNumber: 0,
        pageSize: 25,
      };

      const findOneStub = sinon
        .stub(manager, 'findOneByProductIdOrFail')
        .withArgs(123, false)
        .resolves(ModelFactory.productSubscription());
      mockPtMan
        .expects('getProductTypes')
        .resolves(_.range(1).map(() => ModelFactory.productType()));
      mockDao.expects('search').never();
      mockOpenSearchManager
        .expects('search')
        .once()
        .withArgs('movie', {
          match: { productId: 567, productTypeId: 'movie' },
          context: { productId: '123' },
        })
        .returns(expectedResults);
      decorator.expects('apply').never();

      const actualResults = await manager.searchProductsBySubscription(
        search,
        '123',
      );
      sinon.verify();
      const testResults = {
        ...actualResults,
        data: _.map(actualResults.data, (ar) => _.omit(ar, 'purchaseOptions')),
      };
      assert.deepEqual(testResults, expectedResults);
      assert.equal(findOneStub.calledOnce, true);
    });
    it('calls the search for searchProductsBySubscription with match being an array of objects', async () => {
      const search: Search = {
        match: [{ productId: 567 }, { productTypeId: 'game' }],
      };
      const expectedResults: Paginated<Product> = {
        data: [ModelFactory.product()],
        total: 1,
        pageNumber: 0,
        pageSize: 25,
      };
      const findOneStub = sinon
        .stub(manager, 'findOneByProductIdOrFail')
        .withArgs(123, false)
        .resolves(ModelFactory.productSubscription());
      mockPtMan
        .expects('getProductTypes')
        .resolves(_.range(1).map(() => ModelFactory.productType()));
      mockDao
        .expects('search')
        .once()
        .withArgs({
          match: [
            { productId: 567, productTypeId: 'movie' },
            { productTypeId: 'game' },
          ],
          context: { productId: '123' },
        })
        .returns(expectedResults);
      decorator.expects('apply').once().resolves();

      const actualResults = await manager.searchProductsBySubscription(
        search,
        '123',
      );
      sinon.verify();
      const testResults = {
        ...actualResults,
        data: _.map(actualResults.data, (ar) => _.omit(ar, 'purchaseOptions')),
      };
      assert.deepEqual(testResults, expectedResults);
      assert.equal(findOneStub.calledOnce, true);
    });
    it('calls the search for searchProductsBySubscription with no match and query', async () => {
      const expectedResults: Paginated<Product> = {
        data: [ModelFactory.product()],
        total: 1,
        pageNumber: 0,
        pageSize: 25,
      };
      const findOneStub = sinon
        .stub(manager, 'findOneByProductIdOrFail')
        .withArgs(123, false)
        .resolves(ModelFactory.productSubscription());
      mockPtMan
        .expects('getProductTypes')
        .resolves(_.range(1).map(() => ModelFactory.productType()));
      mockOpenSearchManager
        .expects('search')
        .once()
        .withArgs('movie', {
          match: { productTypeId: 'movie' },
          context: { productId: '123' },
        })
        .returns(expectedResults);
      decorator.expects('apply').never();

      const actualResults = await manager.searchProductsBySubscription(
        {},
        '123',
      );
      sinon.verify();
      const testResults = {
        ...actualResults,
        data: _.map(actualResults.data, (ar) => _.omit(ar, 'purchaseOptions')),
      };
      assert.deepEqual(testResults, expectedResults);
      assert.equal(findOneStub.calledOnce, true);
    });
  });

  describe('tricky private methods not covered -- DO NOT ADD TO THESE!!!', () => {
    describe('setNormalizedGenres', () => {
      it('should not mutate a product that does not match', () => {
        const product = ModelFactory.product();
        delete product.source;
        const original = _.cloneDeep(product);
        (manager as any).setNormalizedGenres(product, {});
        expect(product).to.deep.equal(original);
      });
      it('should fall back to source.genres if no dpvs', () => {
        const product = ModelFactory.product({
          source: { genres: ['a', 'bc', 'def'] },
        });
        (manager as any).setNormalizedGenres(product, {
          rabbit: ModelFactory.distinctProductValue(),
        });
        expect(product.meta.genres).to.deep.equal(product.source.genres);
      });
    });
    describe('setGenresForBackwardCompatibility', () => {
      it('should add source.genres even if source does not exist', async () => {
        const product = ModelFactory.product({
          meta: { genres: ['a', 'bc', 'def'] },
        });
        delete product.source;
        mockPtMan
          .expects('isFieldPartOfSchema')
          .withExactArgs('productType', 'meta.genres')
          .resolves(true);
        await (manager as any).setGenresForBackwardCompatibility(
          product,
          'productType',
        );
        expect(product.source.genres).to.deep.equal(product.meta.genres);
        mockPtMan.verify();
      });
    });
  });

  describe('findWebViewsByPackageId', () => {
    it('should find tabletPackage and invoke retrieveWebViews', async () => {
      const packageId = 1;
      const customerId = 'I-003320';
      const siteId = '09340';
      const pricedProduct = ModelFactory.pricedPackageWithChildren();
      const securityContext = {
        inmateJwt: SecurityFactory.inmateJwt({ customerId, siteId }),
      };
      pricedProduct.webViews = [1, 2, 3];
      const [webViewProduct, webViewProduct2, webViewProduct3] = _.map(
        pricedProduct.webViews,
        (x) => ModelFactory.WebViewProduct({ productId: x }),
      );

      mockProductManager
        .expects('findOneByProductIdOrFail')
        .withExactArgs(packageId, false, securityContext)
        .resolves(pricedProduct);
      mockProductManager
        .expects('retrieveWebViews')
        .withExactArgs(pricedProduct.webViews, securityContext)
        .resolves([webViewProduct, webViewProduct2, webViewProduct3]);

      const result: Product[] = await manager.findWebViewsByPackageId(
        packageId,
        securityContext,
      );

      expect(result).to.deep.equal([
        webViewProduct,
        webViewProduct2,
        webViewProduct3,
      ]);

      mockProductManager.verify();
    });
    it('should find a tabletPackage with no webViews', async () => {
      const packageId = 1;
      const customerId = 'I-003320';
      const siteId = '09340';
      const pricedProduct = ModelFactory.pricedPackageWithChildren();
      const securityContext = {
        inmateJwt: SecurityFactory.inmateJwt({ customerId, siteId }),
      };

      mockProductManager
        .expects('findOneByProductIdOrFail')
        .withExactArgs(packageId, false, securityContext)
        .resolves(pricedProduct);
      mockProductManager
        .expects('retrieveWebViews')
        .withExactArgs(pricedProduct.webViews, securityContext)
        .never();

      const result: Product[] = await manager.findWebViewsByPackageId(
        packageId,
        securityContext,
      );

      expect(result).to.deep.equal(undefined);

      mockProductManager.verify();
    });
    it('should find webViews for a package by productId', async () => {
      const customerId = 'I-003320';
      const siteId = '09340';
      const pricedProduct = ModelFactory.pricedPackageWithChildren();
      const securityContext = {
        inmateJwt: SecurityFactory.inmateJwt({ customerId, siteId }),
      };
      pricedProduct.webViews = [1, 2, 3];
      const [webViewProduct, webViewProduct2, webViewProduct3] = _.map(
        pricedProduct.webViews,
        (x) => ModelFactory.WebViewProduct({ productId: x }),
      );

      mockProductManager
        .expects('findOneByProductIdOrFail')
        .withExactArgs(pricedProduct.webViews[0], false, securityContext)
        .resolves(webViewProduct);
      mockProductManager
        .expects('findOneByProductIdOrFail')
        .withExactArgs(pricedProduct.webViews[1], false, securityContext)
        .resolves(webViewProduct2);
      mockProductManager
        .expects('findOneByProductIdOrFail')
        .withExactArgs(pricedProduct.webViews[2], false, securityContext)
        .resolves(webViewProduct3);

      const result: Product[] = await manager.retrieveWebViews(
        pricedProduct.webViews,
        securityContext,
      );

      expect(result).to.deep.equal([
        webViewProduct,
        webViewProduct2,
        webViewProduct3,
      ]);

      mockProductManager.verify();
    });
    it('should not find one of the webViews for a package by productId', async () => {
      const customerId = 'I-003320';
      const siteId = '09340';
      const pricedProduct = ModelFactory.pricedPackageWithChildren();
      const securityContext = {
        inmateJwt: SecurityFactory.inmateJwt({ customerId, siteId }),
      };
      pricedProduct.webViews = [1, 2, 3];
      const [webViewProduct, webViewProduct2] = _.map(
        pricedProduct.webViews,
        (x) => ModelFactory.WebViewProduct({ productId: x }),
      );

      mockProductManager
        .expects('findOneByProductIdOrFail')
        .withExactArgs(pricedProduct.webViews[0], false, securityContext)
        .resolves(webViewProduct);
      mockProductManager
        .expects('findOneByProductIdOrFail')
        .withExactArgs(pricedProduct.webViews[1], false, securityContext)
        .resolves(webViewProduct2);
      mockProductManager
        .expects('findOneByProductIdOrFail')
        .withExactArgs(pricedProduct.webViews[2], false, securityContext)
        .rejects();

      const result: Product[] = await manager.retrieveWebViews(
        pricedProduct.webViews,
        securityContext,
      );

      expect(result).to.deep.equal([webViewProduct, webViewProduct2]);

      mockProductManager.verify();
    });
  });
});

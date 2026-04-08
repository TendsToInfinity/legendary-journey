import { SecurityContextManager } from '@securustablets/libraries.httpsecurity';
import { JsonSchemaParser } from '@securustablets/libraries.json-schema';
import { Postgres } from '@securustablets/libraries.postgres';
import { PaginatedFind } from '@securustablets/libraries.postgres/dist/src/PaginatedFind';
import { FindOptions } from '@securustablets/libraries.postgres/src/models/Find';
import { _ } from '@securustablets/libraries.utils';
import { assert, expect } from 'chai';
import { Exception } from 'securus.tablets.libraries.exceptions';
import * as sinon from 'sinon';
import { Container } from 'typescript-ioc';
import { BlockActionType } from '../../../src/controllers/models/BlockAction';
import {
  ProductStatus,
  ProductTypeIds,
  ThumbnailApprovedStatus,
} from '../../../src/controllers/models/Product';
import { RuleType } from '../../../src/controllers/models/Rule';
import { OrderBy, Search } from '../../../src/controllers/models/Search';
import { ProductDao } from '../../../src/data/PGCatalog/ProductDao';
import { fakeGetSchemaForInterface } from '../../utils/FakeGetSchemaForInterface';
import { MockUtils } from '../../utils/MockUtils';
import { ModelFactory } from '../../utils/ModelFactory';

describe('ProductDao - Unit', () => {
  let productDao: ProductDao;
  let mockPg: sinon.SinonMock;
  let mockRuleDao: sinon.SinonMock;
  let mockProductTypeDao: sinon.SinonMock;
  let mockAvailabilityConverter: sinon.SinonMock;
  let mockLogger: sinon.SinonMock;
  let mockProductDao: sinon.SinonMock;
  let stubGetSchemaForInterface: sinon.SinonStub;

  beforeEach(() => {
    stubGetSchemaForInterface = sinon.stub(
      JsonSchemaParser,
      'getSchemaForInterface',
    );
    stubGetSchemaForInterface.callsFake(fakeGetSchemaForInterface);
    productDao = new ProductDao();
    mockPg = MockUtils.inject(productDao, '_pg', Postgres);
    mockAvailabilityConverter = MockUtils.inject(
      productDao,
      'availabilityConverter',
    );
    mockProductTypeDao = MockUtils.inject(productDao, 'productTypeDao');
    // tslint:disable-next-line
    mockRuleDao = MockUtils.inject(
      productDao,
      'ruleDao',
      class {
        public findSetsByContext() {}
        public aggregateClauses() {}
      },
    );
    mockLogger = sinon.mock((productDao as any).logger);
    mockProductDao = sinon.mock(productDao as any);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('noSql', () => {
    it('successfully retrieves the noSql value', async () => {
      expect((productDao as any).noSql).to.equal(true);
    });
  });
  describe('find', () => {
    it('should call _find with no options', async () => {
      sinon
        .stub(Container.get(SecurityContextManager), 'securityContext')
        .value({ inmateJwt: undefined });
      const product = ModelFactory.product();
      const _findStub = sinon
        .stub(productDao as any, '_find')
        .resolves(product);

      const result = await productDao.find();

      expect(result).to.deep.equal(product);
      expect(_findStub.callCount).to.equal(1);
    });
    it('should call _find with options', async () => {
      sinon
        .stub(Container.get(SecurityContextManager), 'securityContext')
        .value({ inmateJwt: 'Imarealjwtandtotallynotfortestingpurposes' });
      const product = ModelFactory.product();
      const _findStub = sinon
        .stub(productDao as any, '_find')
        .resolves(product);

      const result = await productDao.find({ ids: [product.productId] });

      expect(result).to.deep.equal(product);
      expect(_findStub.callCount).to.equal(1);
    });
  });

  describe('findOneByVendorProductId', () => {
    it('calls find', async () => {
      const expectedSql =
        `SELECT * FROM product WHERE ` +
        `(document->'source'->>'vendorProductId' = $1) AND ` +
        `(document->'source'->>'vendorName' = $2) AND ` +
        `(document->'source'->>'productTypeId' = $3)`;

      mockPg
        .expects('query')
        .withExactArgs(expectedSql, ['123', '321', 'music'])
        .resolves(ModelFactory.queryResult());
      await productDao.findOneByVendorProductId('123', '321', 'music');
      mockPg.verify();
    });
  });

  describe('getSearchFromQueryString', () => {
    let findOptions: FindOptions<any, any>;

    beforeEach(() => {
      findOptions = {
        pageNumber: 0,
        pageSize: 25,
        total: false,
        orderBy: undefined,
      };
    });

    it('should parseQueryString with Product Schema and return Paginated Product', async () => {
      const query = { enforce: 'false' };
      const buildPaginationOptionsSpy = sinon.spy(
        productDao,
        'buildPaginationOptions',
      );
      const parseQueryStringStub = sinon
        .stub(PaginatedFind, 'parseQueryString')
        .returns(findOptions);

      const result = await productDao.getSearchFromQueryString(query);

      expect(buildPaginationOptionsSpy.calledOnceWith(query)).to.equal(
        true,
        'buildPaginationOptionsStub called not right',
      );
      // ProductTypeId.enum === undefined is the signature of Product. Other ProductTypes would specified the enum
      // "parseQueryStringStub.args[0][0]" is ProductDao or "this"
      expect(
        parseQueryStringStub.args[0][0]._schema.properties.productTypeId.enum,
      ).to.be.undefined;
      expect(result).to.deep.equal({
        match: {},
        context: {
          enforce: false,
          customerId: undefined,
          siteId: undefined,
        },
        term: undefined,
        pageNumber: 0,
        pageSize: 25,
        total: false,
        orderBy: undefined,
      });
    });

    it('should parseQueryString with Product Schema, respect enforcement, and return Paginated Product', async () => {
      const query = {
        enforce: 'true',
        customerId: 'I-12345',
        siteId: '99999',
      };
      const buildPaginationOptionsSpy = sinon.spy(
        productDao,
        'buildPaginationOptions',
      );
      const parseQueryStringStub = sinon
        .stub(PaginatedFind, 'parseQueryString')
        .returns(findOptions);

      const result = await productDao.getSearchFromQueryString(query);

      expect(buildPaginationOptionsSpy.calledOnceWith(query)).to.equal(
        true,
        'buildPaginationOptionsStub called not right',
      );
      // ProductTypeId.enum === undefined is the signature of Product. Other ProductTypes would specified the enum
      // "parseQueryStringStub.args[0][0]" is ProductDao or "this"
      expect(
        parseQueryStringStub.args[0][0]._schema.properties.productTypeId.enum,
      ).to.be.undefined;
      expect(result).to.deep.equal({
        match: {},
        context: {
          enforce: true,
          customerId: 'I-12345',
          siteId: '99999',
        },
        term: undefined,
        pageNumber: 0,
        pageSize: 25,
        total: false,
        orderBy: undefined,
      });
    });

    it('should parseQueryString with Movie Schema and return Paginated Product when query productTypeId is movie', async () => {
      const query = {
        productTypeId: 'movie',
        enforce: 'false',
      };
      const buildPaginationOptionsSpy = sinon.spy(
        productDao,
        'buildPaginationOptions',
      );
      const parseQueryStringStub = sinon
        .stub(PaginatedFind, 'parseQueryString')
        .returns({
          contains: {
            document: { productTypeId: 'movie' },
          },
          ...findOptions,
        });

      const result = await productDao.getSearchFromQueryString(query);

      expect(buildPaginationOptionsSpy.calledOnceWith(query)).to.equal(
        true,
        'buildPaginationOptionsStub called not right',
      );
      // "parseQueryStringStub.args[0][0]" is ProductDao or "this"
      expect(
        parseQueryStringStub.args[0][0]._schema.properties.productTypeId.const,
      ).to.equal('movie', 'parseQueryStringStub not called right');
      expect(result).to.deep.equal({
        match: { productTypeId: 'movie' },
        context: {
          enforce: false,
          customerId: undefined,
          siteId: undefined,
        },
        term: undefined,
        pageNumber: 0,
        pageSize: 25,
        total: false,
        orderBy: undefined,
      });
    });

    it('should parseQueryString with Movie Schema including productId and return Paginated Product when query productTypeId is movie', async () => {
      const query = {
        productTypeId: 'movie',
        productId: '1',
        enforce: 'false',
      };
      const buildPaginationOptionsSpy = sinon.spy(
        productDao,
        'buildPaginationOptions',
      );
      const parseQueryStringStub = sinon
        .stub(PaginatedFind, 'parseQueryString')
        .returns({
          contains: {
            document: { productTypeId: 'movie' },
          },
          by: {
            productId: 1,
          },
          ...findOptions,
        });

      const result = await productDao.getSearchFromQueryString(query);

      expect(buildPaginationOptionsSpy.calledOnceWith(query)).to.equal(
        true,
        'buildPaginationOptionsStub called not right',
      );
      // "parseQueryStringStub.args[0][0]" is ProductDao or "this"
      expect(
        parseQueryStringStub.args[0][0]._schema.properties.productTypeId.const,
      ).to.equal('movie', 'parseQueryStringStub not called right');
      expect(result).to.deep.equal({
        match: { productTypeId: 'movie', productId: 1 },
        context: {
          enforce: false,
          customerId: undefined,
          siteId: undefined,
        },
        term: undefined,
        pageNumber: 0,
        pageSize: 25,
        total: false,
        orderBy: undefined,
      });
    });

    it('should search products with "term" when given in the query', async () => {
      const query = {
        term: 'garfield',
        enforce: 'false',
      };
      const buildPaginationOptionsSpy = sinon.spy(
        productDao,
        'buildPaginationOptions',
      );
      const parseQueryStringStub = sinon
        .stub(PaginatedFind, 'parseQueryString')
        .returns(findOptions);

      const result = await productDao.getSearchFromQueryString(query);

      expect(buildPaginationOptionsSpy.calledOnceWith(query)).to.equal(
        true,
        'buildPaginationOptionsStub called not right',
      );
      // ProductTypeId.enum === undefined is the signature of Product. Other ProductTypes would specified the enum
      // "parseQueryStringStub.args[0][0]" is ProductDao or "this"
      expect(
        parseQueryStringStub.args[0][0]._schema.properties.productTypeId.enum,
      ).to.be.undefined;
      expect(result).to.deep.equal({
        match: {},
        context: {
          enforce: false,
          customerId: undefined,
          siteId: undefined,
        },
        term: 'garfield',
        pageNumber: 0,
        pageSize: 25,
        total: false,
        orderBy: undefined,
      });
    });
    it('should search products with productId by options in the query', async () => {
      const query = {
        productId: '1',
        enforce: 'false',
      };
      const findOptionsWithProductId = {
        by: { productId: 1 },
        ...findOptions,
      };
      const buildPaginationOptionsSpy = sinon.spy(
        productDao,
        'buildPaginationOptions',
      );
      const parseQueryStringStub = sinon
        .stub(PaginatedFind, 'parseQueryString')
        .returns(findOptionsWithProductId);

      const result = await productDao.getSearchFromQueryString(query);

      expect(buildPaginationOptionsSpy.calledOnceWith(query)).to.equal(
        true,
        'buildPaginationOptionsStub called not right',
      );
      // ProductTypeId.enum === undefined is the signature of Product. Other ProductTypes would specified the enum
      // "parseQueryStringStub.args[0][0]" is ProductDao or "this"
      expect(
        parseQueryStringStub.args[0][0]._schema.properties.productTypeId.enum,
      ).to.be.undefined;
      expect(result).to.deep.equal({
        match: { productId: 1 },
        context: {
          enforce: false,
          customerId: undefined,
          siteId: undefined,
        },
        term: undefined,
        pageNumber: 0,
        pageSize: 25,
        total: false,
        orderBy: undefined,
      });
    });
  });
  describe('create', () => {
    it('successfully create a product', async () => {
      const product = ModelFactory.product();
      const productId = 342;
      const defaultCreateStub = sinon
        .stub(productDao as any, 'defaultCreate')
        .resolves(productId);
      const updateStub = sinon
        .stub(productDao, 'updateAndRetrieve')
        .resolves(product);

      const result = await productDao.create(product, { apiKey: 'test' });

      expect(result).to.equal(productId);
      expect(defaultCreateStub.called).to.equal(true);
      expect(updateStub.called).to.equal(true);
    });

    it('should throw Conflict exception when postgres has error code 23505', async () => {
      const defaultCreateStub = sinon
        .stub(productDao as any, 'defaultCreate')
        .rejects({
          code: '23505',
        });
      const updateStub = sinon.stub(productDao, 'updateAndRetrieve');
      try {
        await productDao.create(ModelFactory.product(), { apiKey: 'test' });
        expect.fail();
      } catch (e) {
        expect(defaultCreateStub.called).to.equal(true);
        expect(updateStub.called).to.equal(false);
        expect(e.code).to.equal(409);
        expect(e.errors).to.be.undefined;
      }
    });

    it('should give greater detail of the thrown Conflict exception when postgres has error code 23505 and constraint "product_group_idx"', async () => {
      const defaultCreateStub = sinon
        .stub(productDao as any, 'defaultCreate')
        .rejects({
          code: '23505',
          constraint: 'product_group_idx',
        });
      const updateStub = sinon.stub(productDao, 'updateAndRetrieve');
      try {
        await productDao.create(ModelFactory.product(), { apiKey: 'test' });
        expect.fail();
      } catch (e) {
        expect(defaultCreateStub.called).to.equal(true);
        expect(updateStub.called).to.equal(false);
        expect(e.code).to.equal(409);
        expect(e.errors).to.deep.equal([
          'The vendor product ID already exist in this vendor',
        ]);
      }
    });

    it('should throw InternalError exception when postgres has error code other than 23505', async () => {
      const defaultCreateStub = sinon
        .stub(productDao as any, 'defaultCreate')
        .rejects({
          code: '23',
        });
      const updateStub = sinon.stub(productDao, 'updateAndRetrieve');
      try {
        await productDao.create(ModelFactory.product(), { apiKey: 'test' });
        expect.fail();
      } catch (e) {
        expect(defaultCreateStub.called).to.equal(true);
        expect(updateStub.called).to.equal(false);
        expect(e.code).to.equal(500);
      }
    });
  });
  describe('findOne', () => {
    it('should find one product by id', async () => {
      const product1 = ModelFactory.product();

      const findOneStub = sinon
        .stub(productDao as any, '_findOne')
        .resolves(product1);

      const result = await productDao.findOne(product1.productId!);

      assert(findOneStub.calledOnce, '_findOne was not called');
      assert(
        findOneStub.calledOnceWithExactly(product1.productId),
        '_findOne was not called with product1',
      );
      expect(result).to.deep.equal(product1);
    });

    it('should find one product that matches a partial Product', async () => {
      const product1 = ModelFactory.product();
      const product2 = ModelFactory.product();

      const findStub = sinon
        .stub(productDao as any, 'find')
        .resolves([product2]);

      const result = await productDao.findOne({ contains: product1 });

      assert(findStub.calledOnce, 'find was not called');
      assert(
        findStub.calledOnceWithExactly({
          contains: { document: productDao.convertTo(product1).document },
        }),
        'find was not called with product1',
      );
      expect(result).to.deep.equal(product2);
    });
  });
  describe('findOneOrFail', () => {
    it('should find one product by id', async () => {
      const product1 = ModelFactory.product();

      const findOneOrFailStub = sinon
        .stub(productDao as any, '_findOneOrFail')
        .resolves(product1);

      const result = await productDao.findOneOrFail(product1.productId!);

      assert(findOneOrFailStub.calledOnce, '_findOneOrFail was not called');
      assert(
        findOneOrFailStub.calledOnceWithExactly(product1.productId),
        '_findOneOrFail was not called with product1',
      );
      expect(result).to.deep.equal(product1);
    });

    it('should find one product that matches a partial Product', async () => {
      const product1 = ModelFactory.product();
      const product2 = ModelFactory.product();

      const findStub = sinon
        .stub(productDao as any, 'find')
        .resolves([product2]);

      const result = await productDao.findOneOrFail({ contains: product1 });

      assert(findStub.calledOnce, 'find was not called');
      assert(
        findStub.calledOnceWithExactly({
          contains: { document: productDao.convertTo(product1).document },
        }),
        'find was not called with product1',
      );
      expect(result).to.deep.equal(product2);
    });

    it('should throw and exception if it fails to find one product by match', async () => {
      const product1 = ModelFactory.product();

      const findStub = sinon.stub(productDao as any, 'find').resolves([]);

      try {
        await productDao.findOneOrFail({ contains: product1 });
        expect.fail();
      } catch (err) {
        assert(findStub.calledOnce, 'find was not called');
        assert(
          findStub.calledOnceWithExactly({
            contains: { document: productDao.convertTo(product1).document },
          }),
          'find was not called with product1',
        );
        expect(err.name).to.equal(Exception.NotFound.name, err);
      }
    });
    it('should throw and exception if it fails to find one product', async () => {
      const product1 = ModelFactory.product();

      const findStub = sinon
        .stub(productDao as any, '_findOneOrFail')
        .throws(Exception.NotFound());

      try {
        await productDao.findOneOrFail(product1.productId);
        expect.fail();
      } catch (err) {
        assert(findStub.calledOnce, '_findOneOrFail was not called');
        assert(
          findStub.calledOnceWithExactly(product1.productId),
          '_findOneOrFail was not called with product1',
        );
        expect(err.name).to.equal(Exception.NotFound.name, err);
      }
    });
  });
  describe('findDescendantProductIds', () => {
    it('finds all related product ids', async () => {
      const productId1 = 1;
      const productId2 = 7;
      const productId3 = 53;
      const productId4 = 76;
      const expectedResult = [productId1, productId2, productId3, productId4];
      const query = `SELECT document->'childProductIds' as child_product_ids FROM product WHERE product_id = ANY($1)`;

      mockPg
        .expects('query')
        .withExactArgs(query, [[productId1]])
        .resolves({
          rows: [
            {
              childProductIds: [productId4, productId2, productId3, productId2],
            },
          ],
        });
      mockPg
        .expects('query')
        .withExactArgs(query, [[productId2, productId3, productId4]])
        .resolves({ rows: [{ childProductIds: [] }] });

      const result = await productDao.findDescendantProductIds(productId1);

      expect(result).to.deep.equal(expectedResult);

      mockPg.verify();
    });
    it('checks undefined inmateId', async () => {
      sinon
        .stub(Container.get(SecurityContextManager), 'securityContext')
        .value({ inmateJwt: undefined });
      mockPg.expects('query').resolves({ rows: [] });
      await productDao.findDescendantProductIds(12);
      mockPg.verify();
    });
  });
  describe('search', () => {
    let mockClient: sinon.SinonMock;

    function setUp(
      search: Search,
      {
        expectedSearchQuery,
        numResults,
      }: { expectedSearchQuery?: any; numResults?: number } = {},
      {
        isProductTypeIdIncluded,
        isProductIdIncluded,
        isOrderByIncluded,
        isComplexSearch,
        args,
      }: {
        isProductTypeIdIncluded?: boolean;
        isProductIdIncluded?: boolean;
        isOrderByIncluded?: boolean;
        isComplexSearch?: boolean;
        args?: any[];
      } = {},
    ) {
      numResults = _.defaultTo(numResults, 4);
      let useUpdatedSearch = false;
      if (isProductIdIncluded || isProductTypeIdIncluded || isOrderByIncluded) {
        useUpdatedSearch = true;
      }
      const ruleSets = {
        [RuleType.ProductAvailability]: [
          { ruleId: 2, action: { available: true }, productTypeId: 'movie' },
          { ruleId: 3, action: { available: false }, productTypeId: 'movie' },
        ],
        [RuleType.ProductPrice]: [{ ruleId: 4 }],
        [RuleType.ProductSubscriptionAvailability]: [
          {
            ruleId: 6,
            action: { available: true },
            productTypeId: 'gameSubscription',
            productId: 1234,
          },
          {
            ruleId: 7,
            action: { available: false },
            productTypeId: 'gameSubscription',
            productId: 1234,
          },
        ],
      };
      const productTypeClauses = ['movie'];
      const whitelistClauses = [
        { meta: { rating: 'G' }, productTypeId: 'movie' },
      ];
      const blacklistClauses = [
        { meta: { name: 'Frozen' }, productTypeId: 'movie' },
      ];
      const whitelistSubscriptionClauses = [
        { meta: { rating: 'G' }, productTypeId: 'movie' },
      ];
      const blacklistSubscriptionClauses = [
        { meta: { name: 'Frozen' }, productTypeId: 'movie' },
      ];
      const productIds = _.range(numResults);
      const documentMatch = _.isEmpty(search.match)
        ? []
        : _.castArray(search.match);

      const searchResult = ModelFactory.queryResult({
        rows: productIds.map(() =>
          ModelFactory.product({
            available: true,
            availabilityChecks: [],
            ruleIds: [2, 3, 6, 7],
            total: numResults,
          }),
        ),
      });

      const subscriptionSearch = !!search?.context?.productId;
      const enforceGlobalAvailability = !(
        search?.context?.enforce ||
        search?.context?.customerId ||
        search?.context?.siteId ||
        !search?.context?.productId
      );

      mockProductTypeDao
        .expects('findByContext')
        .withArgs(sinon.match(search.context))
        .resolves([
          { productTypeId: 'movie', available: true },
          { productTypeId: 'tvShow', available: false },
        ]);

      mockRuleDao
        .expects('findSetsByContext')
        .withArgs(sinon.match(search.context))
        .resolves(ruleSets);
      if (search?.context?.productId) {
        mockRuleDao
          .expects('aggregateClauses')
          .withExactArgs([2])
          .resolves(whitelistClauses);
        mockRuleDao
          .expects('aggregateClauses')
          .withExactArgs([6])
          .resolves(whitelistSubscriptionClauses);
        mockRuleDao
          .expects('aggregateClauses')
          .withExactArgs([3])
          .resolves(blacklistClauses);
        mockRuleDao
          .expects('aggregateClauses')
          .once()
          .withExactArgs([7])
          .resolves(blacklistSubscriptionClauses);

        const expectedSearchArgs = [
          search.term || '',
          productTypeClauses,
          whitelistClauses,
          blacklistClauses,
          _.isUndefined(search.context.enforce)
            ? false
            : search.context.enforce,
          [2, 3, 4, 6, 7], // productRuleIds
          _.isUndefined(search.total) ? false : search.total,
          _.isUndefined(search.pageSize) ? 25 : search.pageSize,
          (_.isUndefined(search.pageNumber) ? 0 : search.pageNumber) *
            (_.isUndefined(search.pageSize) ? 25 : search.pageSize),
          whitelistSubscriptionClauses,
          enforceGlobalAvailability,
          subscriptionSearch,
          blacklistSubscriptionClauses,
          documentMatch,
        ];
        expectedSearchArgs.pop();
        if (useUpdatedSearch) {
          if (isProductTypeIdIncluded) {
            const matchValue = _.isEmpty(search.match)
              ? []
              : _.castArray(search.match);
            const productTypeIds: string[] = _.chain(matchValue)
              .map((el) => (el as any).productTypeId)
              .filter((el) => !!el)
              .uniqBy((el) => el)
              .value();
            expectedSearchArgs.push(productTypeIds[0]);
          }
          if (isComplexSearch) {
            if (args.length > 0) {
              args.forEach((s) => expectedSearchArgs.push(s));
            }
          }
        } else {
          expectedSearchArgs.push(documentMatch);
        }
        mockPg
          .expects('query')
          .withArgs(
            expectedSearchQuery || sinon.match.string,
            expectedSearchArgs,
          )
          .resolves(searchResult);
      } else {
        mockRuleDao
          .expects('aggregateClauses')
          .once()
          .withExactArgs([2])
          .resolves(whitelistClauses);
        mockRuleDao
          .expects('aggregateClauses')
          .withExactArgs([3])
          .resolves(blacklistClauses);
        mockRuleDao
          .expects('aggregateClauses')
          .twice()
          .withExactArgs([])
          .resolves([]);

        const expectedSearchArgs = [
          search.term || '',
          productTypeClauses,
          whitelistClauses,
          blacklistClauses,
          _.isUndefined(search.context.enforce)
            ? false
            : search.context.enforce,
          [2, 3, 4, 6, 7], // productRuleIds
          _.isUndefined(search.total) ? false : search.total,
          _.isUndefined(search.pageSize) ? 25 : search.pageSize,
          (_.isUndefined(search.pageNumber) ? 0 : search.pageNumber) *
            (_.isUndefined(search.pageSize) ? 25 : search.pageSize),
          [],
          enforceGlobalAvailability,
          subscriptionSearch,
          [],
          documentMatch,
        ];

        expectedSearchArgs.pop();
        if (useUpdatedSearch) {
          if (isProductIdIncluded) {
            const matchValue = _.isEmpty(search.match)
              ? []
              : _.castArray(search.match);
            const ids = _.chain(matchValue)
              .sortBy('productId')
              .map((el) => (el as any).productId)
              .filter((el) => !!el)
              .uniqBy((el) => el)
              .value();
            expectedSearchArgs.push([ids]);
          }
          if (isProductTypeIdIncluded) {
            const matchValue = _.isEmpty(search.match)
              ? []
              : _.castArray(search.match);
            const productTypeIds: string[] = _.chain(matchValue)
              .map((el) => (el as any).productTypeId)
              .filter((el) => !!el)
              .uniqBy((el) => el)
              .value();
            expectedSearchArgs.push(productTypeIds[0]);
          }
          if (isComplexSearch) {
            if (args.length > 0) {
              args.forEach((s) => expectedSearchArgs.push(s));
            }
          }
        } else {
          expectedSearchArgs.push(documentMatch);
        }
        mockPg
          .expects('query')
          .withArgs(
            expectedSearchQuery || sinon.match.string,
            expectedSearchArgs,
          )
          .resolves(searchResult);
      }

      const stubClient = { query: () => null };
      mockClient = sinon.mock(stubClient);

      return searchResult;
    }

    function verify() {
      mockRuleDao.verify();
      mockPg.verify();
      mockClient.verify();
    }

    function testSearch(overrides?: Partial<Search>): Search {
      return _.merge(
        {
          context: { customerId: '1', siteId: '2' },
          term: 'foo',
          match: { productTypeId: 'movie' },
          pageSize: 10,
          pageNumber: 10,
          orderBy: {},
        },
        overrides,
      );
    }

    it('searches products', async () => {
      const search = testSearch();
      const searchResult = setUp(search, {}, { isProductTypeIdIncluded: true });
      const results = await productDao.search(search);
      expect(results.data).to.have.lengthOf(searchResult.rows.length);
      expect(results.pageSize).to.equal(search.pageSize);
      expect(results.pageNumber).to.equal(search.pageNumber);
      verify();
    });
    it('searches subscription products for subscription context', async () => {
      const search = {
        context: { customerId: '1', siteId: '2', productId: '1234' },
        term: 'foo',
        match: { productTypeId: 'game' },
        pageSize: 10,
        pageNumber: 10,
        orderBy: {},
      };
      const args = [
        ['Frozen'],
        ['movie'],
        ['G'],
        ['movie'],
        ['G'],
        ['movie'],
        ['Frozen'],
        ['movie'],
      ];
      const searchResult = setUp(
        search,
        {},
        { isProductTypeIdIncluded: true, isComplexSearch: true, args: args },
      );
      const results = await productDao.search(search);
      expect(results.data).to.have.lengthOf(searchResult.rows.length);
      expect(results.pageSize).to.equal(search.pageSize);
      expect(results.pageNumber).to.equal(search.pageNumber);
      verify();
    });
    it('search products for products search with enforce true', async () => {
      const search = {
        context: { enforce: true },
        term: 'foo',
        match: { productTypeId: 'movie' },
        pageSize: 10,
        pageNumber: 10,
        orderBy: {},
      };
      const searchResult = setUp(search, {}, { isProductTypeIdIncluded: true });
      const results = await productDao.search(search);
      expect(results.data).to.have.lengthOf(searchResult.rows.length);
      expect(results.pageSize).to.equal(search.pageSize);
      expect(results.pageNumber).to.equal(search.pageNumber);
      verify();
    });
    it('search products for products search with only customerId', async () => {
      const search = {
        context: { customerId: '1' },
        term: 'foo',
        match: { productTypeId: 'movie' },
        pageSize: 10,
        pageNumber: 10,
        orderBy: {},
      };
      const searchResult = setUp(search, {}, { isProductTypeIdIncluded: true });
      const results = await productDao.search(search);
      expect(results.data).to.have.lengthOf(searchResult.rows.length);
      expect(results.pageSize).to.equal(search.pageSize);
      expect(results.pageNumber).to.equal(search.pageNumber);
      verify();
    });
    it('search products for products search with only SiteId', async () => {
      const search = {
        context: { siteId: '2' },
        term: 'foo',
        match: { productTypeId: 'movie' },
        pageSize: 10,
        pageNumber: 10,
        orderBy: {},
      };
      const searchResult = setUp(search, {}, { isProductTypeIdIncluded: true });
      const results = await productDao.search(search);
      expect(results.data).to.have.lengthOf(searchResult.rows.length);
      expect(results.pageSize).to.equal(search.pageSize);
      expect(results.pageNumber).to.equal(search.pageNumber);
      verify();
    });
    it('supports match as array', async () => {
      const search = testSearch({ match: [{ foo: 'bar' }, { baz: 'quux' }] });
      setUp(
        search,
        {},
        {
          isProductTypeIdIncluded: false,
          isProductIdIncluded: false,
          isOrderByIncluded: false,
        },
      );
      await productDao.search(search);
      verify();
    });
    it('supports match with productId alone', async () => {
      const search = testSearch({
        match: { productId: 1, productTypeId: 'album' },
      });
      setUp(
        search,
        {
          expectedSearchQuery: sinon.match(
            /(.|\n)*WHERE(.|\n)*AND product_id =(.|\n)*WHERE(.|\n)*AND product_id =(.|\n)*ORDER BY(.|\n)*/,
          ),
        },
        {
          isProductTypeIdIncluded: true,
          isProductIdIncluded: true,
          isOrderByIncluded: false,
        },
      );
      await productDao.search(search);
      verify();
    });
    it('supports empty match', async () => {
      const search = { ...testSearch(), match: {} };
      setUp(
        search,
        {},
        {
          isProductTypeIdIncluded: false,
          isProductIdIncluded: false,
          isOrderByIncluded: false,
        },
      );
      await productDao.search(search);
      verify();
    });
    it('should protect against sql injection sort of', async () => {
      const search = {
        ...testSearch(),
        orderBy: { '; DROP TABLE BOBBY--': 'ASC' } as OrderBy,
      };
      setUp(
        search,
        {},
        {
          isProductTypeIdIncluded: false,
          isProductIdIncluded: false,
          isOrderByIncluded: true,
        },
      );
      try {
        await productDao.search(search);
        expect.fail();
      } catch (err) {
        expect(err.name).to.equal(Exception.InvalidData.name, err);
        expect(err.errors).to.deep.equal([
          `Invalid sort specified: {"; DROP TABLE BOBBY--":"ASC"}`,
        ]);
      }
    });
    it('returns total if specified', async () => {
      const search = testSearch({ total: true });
      setUp(
        search,
        {},
        {
          isProductTypeIdIncluded: true,
          isProductIdIncluded: false,
          isOrderByIncluded: false,
        },
      );
      const { total } = await productDao.search(search);
      expect(total).to.equal(4);
      verify();
    });
    it('returns total of 0 when no search results', async () => {
      const search = testSearch({ total: true });
      setUp(
        search,
        { numResults: 0 },
        {
          isProductTypeIdIncluded: true,
          isProductIdIncluded: false,
          isOrderByIncluded: false,
        },
      );
      const { total } = await productDao.search(search);
      expect(total).to.equal(0);
      verify();
    });
    it('returns undefined for total if not specified/false', async () => {
      const search = testSearch();
      setUp(
        search,
        {},
        {
          isProductTypeIdIncluded: true,
          isProductIdIncluded: false,
          isOrderByIncluded: false,
        },
      );
      const { total } = await productDao.search(search);
      expect(total).to.equal(undefined);
      verify();
    });
    it('supports orderBy', async () => {
      const search = testSearch({
        orderBy: [{ cdate: 'DESC' }, { 'meta.name': 'ASC' }],
      });
      setUp(
        search,
        {
          expectedSearchQuery: sinon.match(
            /(.|\n)*ORDER BY(.|\n)*cdate(.|\n)*DESC,(.|\n)*document->'meta'->>'name'(.|\n)*ASC,(.|\n)*/,
          ),
        },
        {
          isProductTypeIdIncluded: true,
          isProductIdIncluded: false,
          isOrderByIncluded: false,
        },
      );
      await productDao.search(search);
      verify();
    });
    it('should return product searched by product Id', async () => {
      const search = testSearch();
      const searchResult = setUp(
        search,
        {},
        {
          isProductTypeIdIncluded: true,
          isProductIdIncluded: false,
          isOrderByIncluded: false,
        },
      );
      const results = await productDao.search(search);
      expect(results.data).to.have.lengthOf(searchResult.rows.length);
      expect(results.pageSize).to.equal(search.pageSize);
      expect(results.pageNumber).to.equal(search.pageNumber);
      verify();
    });
    it('should return product for complex search', async () => {
      const search = testSearch({
        match: {
          productTypeGroupId: 'music',
          productTypeId: 'album',
          source: {
            vendorName: 'Audible Magic',
            vendorProductId: '567808887',
          },
          meta: {
            genres: 'Pop',
          },
        },
      });
      const args = [
        ['music'],
        ['Audible Magic'],
        ['567808887'],
        JSON.stringify(['Pop']),
      ];
      const searchResult = setUp(
        search,
        {
          expectedSearchQuery: sinon.match(
            /(.|\n)*WHERE (.|\n)*document->'source'->>'vendorName'(.|\n)*document->'source'->>'vendorProductId'(.|\n)*document->'meta'->'genres'(.|\n)*/,
          ),
        },
        { isProductTypeIdIncluded: true, isComplexSearch: true, args: args },
      );
      const results = await productDao.search(search);
      expect(results.data).to.have.lengthOf(searchResult.rows.length);
      expect(results.pageSize).to.equal(search.pageSize);
      expect(results.pageNumber).to.equal(search.pageNumber);
      verify();
    });
    it('should return product for complex search with order by', async () => {
      const search = testSearch({
        match: {
          productTypeGroupId: 'music',
          productTypeId: 'album',
        },
        orderBy: [{ 'meta.startdate': 'DESC' }],
      });
      const args = [['music']];
      const searchResult = setUp(
        search,
        {
          expectedSearchQuery: sinon.match(
            /(.|\n)*WHERE (.|\n)*document->>'productTypeGroupId'(.|\n)*ORDER BY(.|\n)*f_cast_isots(.|\n)*document->'meta'->>'startdate'(.|\n)*DESC(.|\n)*/,
          ),
        },
        { isProductTypeIdIncluded: true, isComplexSearch: true, args: args },
      );
      const results = await productDao.search(search);
      expect(results.data).to.have.lengthOf(searchResult.rows.length);
      expect(results.pageSize).to.equal(search.pageSize);
      expect(results.pageNumber).to.equal(search.pageNumber);
      verify();
    });
    it('should fail with empty search but contains order by', async () => {
      const search = testSearch({
        context: {},
        term: '',
        match: [{ productTypeGroupId: 'music' }],
        orderBy: [{ 'meta.startdate': 'DESC' }],
      });
      setUp(search, {}, { isOrderByIncluded: true });
      try {
        await productDao.search(search);
        assert.fail();
      } catch (err) {
        assert.equal(err.code, 400);
        mockLogger.expects('error');
      }
    });
    it('should return products with search including purchaseTypes', async () => {
      const search = testSearch({
        match: {
          productTypeId: 'album',
          purchaseTypes: ['purchase'],
        },
      });
      const args = [JSON.stringify(['purchase'])];
      const searchResult = setUp(
        search,
        {
          expectedSearchQuery: sinon.match(
            /(.|\n)*WHERE (.|\n)*document->'purchaseTypes'(.|\n)*/,
          ),
        },
        { isProductTypeIdIncluded: true, isComplexSearch: true, args: args },
      );
      const results = await productDao.search(search);
      expect(results.data).to.have.lengthOf(searchResult.rows.length);
      expect(results.pageSize).to.equal(search.pageSize);
      expect(results.pageNumber).to.equal(search.pageNumber);
      verify();
    });
    it('should return products with search including childProductIds', async () => {
      const search = testSearch({
        match: {
          productTypeId: 'album',
          childProductIds: [1, 2, 3, 4],
        },
      });
      const args = [JSON.stringify([1, 2, 3, 4])];
      const searchResult = setUp(
        search,
        {
          expectedSearchQuery: sinon.match(
            /(.|\n)*WHERE (.|\n)*document->'childProductIds'(.|\n)*/,
          ),
        },
        { isProductTypeIdIncluded: true, isComplexSearch: true, args: args },
      );
      const results = await productDao.search(search);
      expect(results.data).to.have.lengthOf(searchResult.rows.length);
      expect(results.pageSize).to.equal(search.pageSize);
      expect(results.pageNumber).to.equal(search.pageNumber);
      verify();
    });
    it('should check if inmateJwt is undefined', async () => {
      sinon
        .stub(Container.get(SecurityContextManager), 'securityContext')
        .value({ inmateJwt: undefined });

      const search = testSearch({ total: true });
      setUp(
        search,
        { numResults: 0 },
        {
          isProductTypeIdIncluded: true,
          isProductIdIncluded: false,
          isOrderByIncluded: false,
        },
      );
      const { total } = await productDao.search(search);
      expect(total).to.equal(0);

      verify();
    });
    describe('findProductAvailabilityOrFail', () => {
      it('should return converted availabilityChecks from product search result', async () => {
        const search = {
          match: { productId: 1 },
          context: { customerId: 'customerId', siteId: 'siteId' },
        };
        setUp(
          search,
          {},
          {
            isProductTypeIdIncluded: false,
            isProductIdIncluded: true,
            isOrderByIncluded: false,
          },
        );

        const expectedAvailability = {
          productId: 1,
          available: true,
          checks: [],
        };
        mockAvailabilityConverter
          .expects('convertFrom')
          .returns(expectedAvailability);
        const availability = await productDao.findProductAvailabilityOrFail(1, {
          customerId: 'customerId',
          siteId: 'siteId',
        });
        expect(availability).to.deep.equal(expectedAvailability);

        mockAvailabilityConverter.verify();
        verify();
      });
      it('should blow up if product does not exists', async () => {
        const search = {
          match: { productId: 1 },
          context: { customerId: 'customerId', siteId: 'siteId' },
        };
        setUp(
          search,
          { numResults: 0 },
          {
            isProductTypeIdIncluded: false,
            isProductIdIncluded: true,
            isOrderByIncluded: false,
          },
        );
        try {
          await productDao.findProductAvailabilityOrFail(1, {
            customerId: 'customerId',
            siteId: 'siteId',
          });
          expect.fail();
        } catch (err) {
          expect(err.name).to.equal(Exception.NotFound.name, err);
          expect(err.errors).to.deep.equal([
            'No Product found matching { productId: 1 }',
          ]);
        }
        verify();
      });
    });
  });
  describe('stripReserveColumns', () => {
    it('successfully removes reserved columns', async () => {
      const expected = ModelFactory.product();

      const product = productDao.stripReservedColumns(expected);

      expect(product).to.deep.equal(_.omit(expected, ['cdate', 'udate']));
    });
  });
  describe('convertTo', () => {
    it('successfully converts to postgres row', async () => {
      const product = ModelFactory.product({
        productId: 123,
        version: 18,
        productTypeId: 'movie',
        status: ProductStatus.Active,
        meta: {
          name: 'Name',
          description: 'desc',
          thumbnail: 'thumb',
        },
        cdate: '2019-05-13T20:32:23.171Z',
        udate: '2019-05-13T20:32:23.171Z',
      });
      const converted = productDao.convertTo(product);
      expect(converted.document).to.deep.equal(
        _.omit(product, 'cdate', 'udate', 'version'),
      );
    });
    it('works without fields', async () => {
      const product = _.omit(
        ModelFactory.product(),
        'productId',
        'cdate',
        'udate',
        'version',
      ) as any;
      const converted = productDao.convertTo(product);
      expect(converted.document).to.deep.equal(product);
    });
  });
  describe('convertFrom', () => {
    it('successfully converts to products', async () => {
      const expected = ModelFactory.product();
      const row = {
        productId: expected.productId,
        document: _.omit(expected, ['cdate', 'udate']),
        cdate: expected.cdate,
        udate: expected.udate,
        version: expected.version,
        available: true,
      };

      const product = productDao.convertFrom(row);
      expect(product).to.deep.equal({
        ...row.document,
        productId: row.productId,
        cdate: row.cdate,
        udate: row.udate,
        version: row.version,
        available: row.available,
      });
    });

    it('successfully converts to products from audit', async () => {
      const expected = ModelFactory.product();
      const row = {
        product_id: expected.productId,
        document: _.omit(expected, ['cdate', 'udate']),
        cdate: expected.cdate,
        udate: expected.udate,
        version: expected.version,
        available: true,
      };

      const product = productDao.convertFrom(row);
      expect(product).to.deep.equal({
        ...row.document,
        productId: row.product_id,
        cdate: row.cdate,
        udate: row.udate,
        version: row.version,
        available: row.available,
      });
    });
  });
  describe('findDistinctForSchema', () => {
    const simpleSchema = {
      type: 'object',
      properties: {
        aString: {
          autoComplete: true,
          type: 'string',
        },
        aObject: {
          type: 'object',
          properties: {
            aObjArrayObjects: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: {
                    autoComplete: true,
                    type: 'string',
                  },
                  data: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        foo: {
                          type: 'string',
                        },
                        bar: {
                          autoComplete: true,
                          type: 'array',
                          items: {
                            type: 'string',
                          },
                        },
                      },
                      required: ['bar', 'foo'],
                    },
                  },
                },
                required: ['data', 'name'],
              },
            },
          },
        },
      },
    };
    it('parses a simple schema', async () => {
      const jsp = new JsonSchemaParser(simpleSchema);
      const schema = jsp.getSchema('aString');
      mockPg
        .expects('query')
        .withArgs(
          `SELECT DISTINCT(document->'aString') as value_list FROM product WHERE document @> '{"productTypeId": "testTypeId"}'`,
        )
        .resolves({
          rows: [
            { valueList: 'uno' },
            { valueList: 'dos' },
            { valueList: 'tres' },
          ],
        });
      const results = await productDao.findDistinctForSchema(
        'testTypeId',
        schema,
      );
      expect(results).to.deep.equal(['uno', 'dos', 'tres']);
    });
    it('parses a complex schema', async () => {
      const jsp = new JsonSchemaParser(simpleSchema);
      const schema = jsp.getSchema('aObject.aObjArrayObjects.data.bar');
      mockPg
        .expects('query')
        .withArgs(
          `SELECT DISTINCT(jsonb_array_elements(jsonb_array_elements(jsonb_array_elements(document->'aObject'->'aObjArrayObjects')->'data')->'bar')) as value_list ` +
            `FROM product WHERE document @> '{"productTypeId": "testTypeId"}'`,
        )
        .resolves({
          rows: [
            { valueList: 'uno' },
            { valueList: 'dos' },
            { valueList: 'tres' },
          ],
        });
      const results = await productDao.findDistinctForSchema(
        'testTypeId',
        schema,
      );
      expect(results).to.deep.equal(['uno', 'dos', 'tres']);
    });
  });
  describe('buildPaginationOptions', () => {
    it('successfully creates pagination options', async () => {
      const query = {
        productTypeId: 'movie',
        orderBy: 'meta.startDate:desc,meta.name:desc',
      };

      const results = productDao.buildPaginationOptions(query);
      expect(results).to.deep.equal({
        contains: { document: { productTypeId: 'movie' } },
        pageNumber: 0,
        pageSize: 25,
        total: false,
        orderBy: [
          { "document->'meta'->'startDate'": 'DESC' },
          { "document->'meta'->'name'": 'DESC' },
          { product_id: 'DESC' },
        ],
      });
    });
  });
  describe('updateProductThumbnailStatus', () => {
    it('update product thumbnail status as approved for one product', async () => {
      const product = {
        productId: 1,
        cdate: '2019-05-13T20:32:23.171Z',
        udate: '2019-05-13T20:32:23.171Z',
        version: 1,
      };

      const auditRow = {
        product_id: 1,
        cdate: product.cdate,
        udate: product.udate,
        version: 1,
        document: product,
      };
      const status = ThumbnailApprovedStatus.Approved;
      const lContext = {};
      const lThumbnail = 'url.com';
      const securityContext = {
        ...lContext,
        reason: 'Update thumbnail status',
      };
      const spyQuery = sinon
        .stub(productDao as any, 'write')
        .resolves({ rows: [auditRow] });
      const actualResult = await productDao.updateProductThumbnailStatus(
        [1],
        status,
        lContext,
        lThumbnail,
      );
      expect(spyQuery.calledOnce).to.be.equal(true);
      expect(
        spyQuery.calledWith(
          sinon.match.any,
          `"${status}"`,
          `"${lThumbnail}"`,
          [1],
          securityContext,
        ),
      );
      expect(actualResult).to.deep.equal([product]);
    });
  });

  describe('findProductsByTerm', () => {
    const products = [
      ModelFactory.product({ productId: 1, version: 0, available: false }),
      ModelFactory.product({ productId: 2, version: 0, available: false }),
      ModelFactory.product({ productId: 3, version: 0, available: false }),
    ];
    const rawProducts = _.map(products, (p) => ({
      productId: p.productId,
      document: p,
      cdate: p.cdate,
      udate: p.udate,
      version: p.version,
      available: p.available,
    }));
    const args = {
      term: { idx: 1, value: 'term' },
      termId: { idx: 2, value: 123 },
      productTypeGroupId: { idx: 3, value: 'music' },
      batchSize: { idx: 4, value: 1000 },
    };
    it('should query products by term to block', async () => {
      mockPg
        .expects('query')
        .withExactArgs(
          sinon.match((i) => {
            return (
              i.includes(`BR.term_id=$${args.termId.idx}`) &&
              i.includes(
                `AND (document->>'productTypeGroupId') = $${args.productTypeGroupId.idx}`,
              ) &&
              i.includes(
                `AND lower(document->'meta'->>'name') ~ ('(^|[^a-zA-Z0-9])' || $${args.term.idx} || '($|[^a-zA-Z0-9])')`,
              ) &&
              i.includes(`LIMIT $${args.batchSize.idx}`)
            );
          }),
          [
            args.term.value,
            args.termId.value,
            args.productTypeGroupId.value,
            args.batchSize.value,
          ],
        )
        .resolves({ rows: rawProducts });

      const result = await productDao.findProductsByTerm(
        args.term.value as string,
        args.termId.value as number,
        args.productTypeGroupId.value as string,
        BlockActionType.Add as BlockActionType,
        args.batchSize.value as number,
      );

      expect(result).to.deep.equal([products[0], products[1], products[2]]);
      mockPg.verify();
    });
    it('should query products by term to unblock', async () => {
      mockPg
        .expects('query')
        .withExactArgs(
          sinon.match((i) => {
            return (
              i.includes(`BR.term_id=$1`) &&
              i.includes(`BR.is_active=true`) &&
              i.includes(`LIMIT $3`)
            );
          }),
          [
            args.termId.value,
            args.productTypeGroupId.value,
            args.batchSize.value,
          ],
        )
        .resolves({ rows: rawProducts });

      const result = await productDao.findProductsByTerm(
        args.term.value as string,
        args.termId.value as number,
        args.productTypeGroupId.value as string,
        BlockActionType.Remove as BlockActionType,
        args.batchSize.value as number,
      );

      expect(result).to.deep.equal([products[0], products[1], products[2]]);
      mockPg.verify();
    });
  });

  describe('findProductsByArtist', () => {
    const products = [
      ModelFactory.product({ productId: 1, version: 0, available: false }),
      ModelFactory.product({ productId: 2, version: 0, available: false }),
      ModelFactory.product({ productId: 3, version: 0, available: false }),
    ];
    const rawProducts = _.map(products, (p) => ({
      productId: p.productId,
      document: p,
      cdate: p.cdate,
      udate: p.udate,
      version: p.version,
      available: p.available,
    }));
    const args = {
      vendorArtistId: { idx: 1, value: 'vendorArtistId' },
      vendorName: { idx: 2, value: 'vendorName' },
      productTypeIds: {
        idx: 3,
        value: [ProductTypeIds.Track, ProductTypeIds.Album],
      },
      artistProductId: { idx: 4, value: 123 },
      batchSize: { idx: 5, value: 500 },
    };
    it('should query products by blockReason and artist productId', async () => {
      const matcher = sinon.match((i) => {
        return (
          i.includes(`BR.blocked_by_product=$${args.artistProductId.idx}`) &&
          i.includes(
            `(document->>'productTypeId') = ANY($${args.productTypeIds.idx})`,
          ) &&
          i.includes(
            `document->'source'->>'vendorArtistId' = $${args.vendorArtistId.idx}`,
          ) &&
          i.includes(
            `document->'source'->>'vendorName' = $${args.vendorName.idx}`,
          ) &&
          i.includes(`LIMIT $${args.batchSize.idx}`)
        );
      });
      mockPg
        .expects('query')
        .withExactArgs(matcher, [
          args.vendorArtistId.value,
          args.vendorName.value,
          args.productTypeIds.value,
          args.artistProductId.value,
          args.batchSize.value,
        ])
        .resolves({ rows: rawProducts });

      const result = await productDao.findProductsByArtist(
        args.vendorArtistId.value,
        args.vendorName.value,
        args.productTypeIds.value,
        BlockActionType.Add,
        args.artistProductId.value,
        args.batchSize.value,
      );

      expect(result).to.deep.equal([products[0], products[1], products[2]]);
      mockPg.verify();
    });
    it('should query products by blockReason and artist productId to unblock', async () => {
      const matcher = sinon.match((i) => {
        return (
          i.includes(`term_id IS NULL AND BR.blocked_by_product=$1`) &&
          i.includes(`LIMIT $3`)
        );
      });
      mockPg
        .expects('query')
        .withExactArgs(matcher, [
          args.artistProductId.value,
          args.productTypeIds.value,
          args.batchSize.value,
        ])
        .resolves({ rows: rawProducts });

      const result = await productDao.findProductsByArtist(
        args.vendorArtistId.value,
        args.vendorName.value,
        args.productTypeIds.value,
        BlockActionType.Remove,
        args.artistProductId.value,
        args.batchSize.value,
      );

      expect(result).to.deep.equal([products[0], products[1], products[2]]);
      mockPg.verify();
    });
  });

  describe('getProductsByDpvData', () => {
    it('generate query for meta.genres and source.genres ', async () => {
      const sourcePath = 'source.genres';
      const dpv = ModelFactory.distinctProductValue({
        fieldPath: 'meta.genres',
      });
      const sourceValueName = `Folk`;
      mockPg
        .expects('query')
        .resolves({ rows: [{ genresCombinations: ['Indie Pop'] }] });
      const result = await productDao.getAllDistinctProductValueCombinations(
        sourcePath,
        dpv.productTypeGroupId,
        sourceValueName,
      );
      expect(result).deep.equal([['Indie Pop']]);
      sinon.verify();
    });
  });

  describe('convertRules', () => {
    it('convert all the rules', async () => {
      const clauses = [
        { productTypeId: 'movie' },
        { meta: { name: 'Gold Sub' }, productTypeId: 'musicSubscription' },
      ];
      const args = {};
      const updatedArgsToCompare = {
        1: { idx: 1, value: ['movie'] },
        2: { idx: 2, value: ['Gold Sub'] },
        3: { idx: 3, value: ['musicSubscription'] },
      };
      const finalSearchString = `AND (  document->>'productTypeId' = ANY($1) ) OR (  document->'meta'->>'name' = ANY($2)  AND document->>'productTypeId' = ANY($3) )`;
      const [updatedArgs, searchString] = await productDao.convertRules(
        clauses,
        args,
      );
      expect(updatedArgs).to.deep.equal(updatedArgsToCompare);
      expect(searchString).to.equal(finalSearchString);
    });
    it('should return blank finalString if called with no rules', async () => {
      const args = {};
      const [updatedArgs, searchString] = await productDao.convertRules(
        [],
        args,
      );
      expect(updatedArgs).to.deep.equal(args);
      expect(searchString).to.equal('');
    });
  });

  describe('tricky private methods not covered -- DO NOT ADD TO THIS!!', () => {
    describe('_enforceGlobalAvailability', () => {
      it('should handle a context with a productId', () => {
        const context = { enforce: false, productId: 321 };
        expect(
          (productDao as any)._enforceGlobalAvailability(context),
        ).to.equal(true);
      });
    });
    describe('buildOrderBy', () => {
      it('it handles dereference orderBys', () => {
        const orderByArray = [{ [`document->>'foo'`]: 'ASC' }];
        const result = (productDao as any).buildOrderBy(orderByArray);
        expect(result).to.equal(`document->>'foo' ASC, `);
      });
    });
    describe('convertToWhereString', () => {
      it('should skip processing an empty clause', () => {
        const [finalString, args] = (productDao as any).convertToWhereString(
          [{}],
          [],
        );
        expect(finalString).to.equal('');
        expect(args).to.deep.equal([]);
      });
    });
    describe('createMainMatchAndOrderBy', () => {
      it('should do nothing if no matches are sent', async () => {
        const argsForTest = { term: 2 };
        const [documentMatchingBlock, orderByBlock, args] = await (
          productDao as any
        ).createMainMatchAndOrderBy([], [], '', [], argsForTest);
        expect(documentMatchingBlock).to.equal('');
        expect(typeof orderByBlock).to.equal('string');
        expect(args).to.deep.equal(argsForTest);
      });
    });
  });

  describe('findArtist', () => {
    it('should test getArtist with undefined vendorName and vendorArtistId', async () => {
      const product = ModelFactory.product();
      const artistProduct = ModelFactory.product({
        productId: 10,
        productTypeId: ProductTypeIds.Artist,
      });
      artistProduct.source = undefined;

      mockProductDao
        .expects('find')
        .withArgs({
          customClauses: [
            {
              clause: `document->'source'->>'vendorProductId' = $1`,
              params: [artistProduct.source?.vendorName],
            },
            {
              clause: `document->'source'->>'vendorName' = $1`,
              params: [artistProduct.source?.vendorArtistId],
            },
            {
              clause: `document->'source'->>'productTypeId' = $1`,
              params: [ProductTypeIds.Artist],
            },
          ],
        })
        .resolves(product);

      const result = await productDao.findArtist(artistProduct);

      expect(result).to.equal(undefined);
    });
    it('should test getArtist with vendorName and vendorArtistId', async () => {
      const product = ModelFactory.product();
      const artistProduct = ModelFactory.product({
        productId: 10,
        productTypeId: ProductTypeIds.Artist,
      });
      artistProduct.source.vendorName = 'gold';
      artistProduct.source.vendorArtistId = '10';

      mockProductDao
        .expects('find')
        .withArgs({
          customClauses: [
            {
              clause: `document->'source'->>'vendorProductId' = $1`,
              params: [artistProduct.source?.vendorArtistId],
            },
            {
              clause: `document->'source'->>'vendorName' = $1`,
              params: [artistProduct.source.vendorName],
            },
            {
              clause: `document->'source'->>'productTypeId' = $1`,
              params: [ProductTypeIds.Artist],
            },
          ],
        })
        .resolves(product);

      const result = await productDao.findArtist(artistProduct);

      expect(result).to.equal(undefined);
    });
  });
});

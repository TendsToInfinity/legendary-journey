import { _ } from '@securustablets/libraries.utils';
import { expect } from 'chai';
import * as faker from 'faker';
import * as sinon from 'sinon';
import { ProductTypeIds } from '../../../src/controllers/models/Product';
import { Search } from '../../../src/controllers/models/Search';
import { OpenSearchManager } from '../../../src/lib/OpenSearchManager';
import { ModelFactory } from '../../utils/ModelFactory';

describe('OpenSearchManager - Unit', () => {
  let openSearchManager: OpenSearchManager;
  let mockOpenSearchDao: sinon.SinonMock;
  let mockProductTypeManager: sinon.SinonMock;
  let mockDecorator: sinon.SinonMock;
  let mockDigestManager: sinon.SinonMock;
  let mockConfig: sinon.SinonMock;

  const productTypeId = 'foobar';
  const productType = ModelFactory.productType();

  beforeEach(() => {
    openSearchManager = new OpenSearchManager();
    mockOpenSearchDao = sinon.mock((openSearchManager as any).openSearchDao);
    mockProductTypeManager = sinon.mock(
      (openSearchManager as any).productTypeManager,
    );
    mockDecorator = sinon.mock((openSearchManager as any).decorator);
    mockDigestManager = sinon.mock((openSearchManager as any).digestManager);
    mockConfig = sinon.mock((openSearchManager as any).config);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('validateSearch', () => {
    it('should throw an error if query and match are supplied in same search request', async () => {
      const search: Search = {
        query: {
          productTypeId,
          clauses: {},
        },
        match: {
          foo: 'bar',
        },
      };
      try {
        await openSearchManager.scrollSearch(productTypeId, search);
        expect.fail();
      } catch (error) {
        expect(error.code).to.equal(400);
        expect(error.errors).to.deep.equal([
          `Cannot search with both 'query' and 'match'.`,
        ]);
      }
    });
    it('should throw an error if requested page exceeds OpenSearch result window', async () => {
      const search: Search = {
        pageSize: 5000,
        pageNumber: 3,
      };
      try {
        await openSearchManager.scrollSearch(productTypeId, search);
        expect.fail();
      } catch (error) {
        expect(error.code).to.equal(400);
        expect(error.errors).to.deep.equal([
          `Requested page exceeds OpenSearch result window (10,000). Please refine filters or use a scroll-based query.`,
        ]);
      }
    });
  });
  describe('scrollSearch', () => {
    it('should not apply defaults to passed in search', async () => {
      mockProductTypeManager
        .expects('getProductType')
        .withExactArgs(productTypeId)
        .resolves(productType);
      mockOpenSearchDao
        .expects('scrollSearch')
        .withExactArgs(productTypeId, {}, productType)
        .resolves();
      await openSearchManager.scrollSearch(productTypeId, {});
      mockOpenSearchDao.verify();
      mockProductTypeManager.verify();
    });
  });
  describe('search', () => {
    it('should return an empty set if product type is not available for the context enforce=true', async () => {
      const expectedResult = {
        data: [],
        pageSize: 25,
        pageNumber: 0,
      };
      mockProductTypeManager
        .expects('isProductTypeAvailableForContext')
        .withExactArgs(productTypeId, { enforce: true })
        .resolves(false);
      const result = await openSearchManager.search(productTypeId, {
        context: { enforce: true },
      });
      expect(result).to.deep.equal(expectedResult);
      mockProductTypeManager.verify();
    });
    it('should return an empty set if using local media and search is for music subscription', async () => {
      const expectedResult = {
        data: [],
        pageSize: 25,
        pageNumber: 0,
      };
      mockConfig
        .expects('get')
        .withExactArgs('catalogLocalMedia')
        .returns({ catalogUseLocalMedia: true });
      mockProductTypeManager
        .expects('isProductTypeAvailableForContext')
        .never();
      const result = await openSearchManager.search(
        ProductTypeIds.MusicSubscription,
        { context: { enforce: true } },
      );
      expect(result).to.deep.equal(expectedResult);
      mockProductTypeManager.verify();
    });
    it('should return an empty set with total if product type is not available for the context enforce=true', async () => {
      const expectedResult = {
        data: [],
        pageSize: 25,
        pageNumber: 0,
        total: 0,
      };
      mockProductTypeManager
        .expects('isProductTypeAvailableForContext')
        .withExactArgs(productTypeId, { enforce: true })
        .resolves(false);
      const result = await openSearchManager.search(productTypeId, {
        context: { enforce: true },
        total: true,
      });
      expect(result).to.deep.equal(expectedResult);
      mockProductTypeManager.verify();
    });
    it('should return products if product type not available and enforce=false', async () => {
      const search: Search = {
        context: { enforce: false },
        pageNumber: 0,
        pageSize: 25,
        total: true,
      };
      const searchResult = {
        data: [{ ...ModelFactory.product(), digest: ModelFactory.digest() }],
        pageSize: 25,
        pageNumber: 0,
        total: 1,
      };
      mockProductTypeManager
        .expects('getProductType')
        .withExactArgs(productTypeId)
        .resolves(productType);
      mockProductTypeManager
        .expects('isProductTypeAvailableForContext')
        .withExactArgs(productTypeId, { enforce: false })
        .resolves(false);
      mockOpenSearchDao
        .expects('search')
        .withExactArgs(productTypeId, search, productType)
        .resolves(searchResult);
      mockDecorator
        .expects('apply')
        .withExactArgs(
          sinon.match.array,
          [
            sinon.match.func,
            sinon.match.func,
            sinon.match.func,
            sinon.match.func,
          ],
          search.context,
        )
        .resolves();
      const results = await openSearchManager.search(productTypeId, search);
      expect(results.data[0].available).to.equal(false);
      mockProductTypeManager.verify();
      mockOpenSearchDao.verify();
      mockDecorator.verify();
    });
    it('should return a decorated Paginated<Product>', async () => {
      const search: Search = {
        context: {
          enforce: false,
        },
        pageNumber: 0,
        pageSize: 25,
        total: true,
      };
      const searchResult = {
        data: [{ ...ModelFactory.product(), digest: ModelFactory.digest() }],
        pageSize: 25,
        pageNumber: 0,
        total: 1,
      };
      mockConfig
        .expects('get')
        .withExactArgs('catalogLocalMedia')
        .returns({ catalogUseLocalMedia: true });
      mockProductTypeManager
        .expects('getProductType')
        .withExactArgs(productTypeId)
        .resolves(productType);
      mockProductTypeManager
        .expects('isProductTypeAvailableForContext')
        .withExactArgs(productTypeId, search.context)
        .resolves(true);
      mockOpenSearchDao
        .expects('search')
        .withExactArgs(productTypeId, search, productType)
        .resolves(searchResult);
      mockDecorator
        .expects('apply')
        .withExactArgs(
          sinon.match.array,
          [
            sinon.match.func,
            sinon.match.func,
            sinon.match.func,
            sinon.match.func,
          ],
          search.context,
        )
        .resolves();
      const results = await openSearchManager.search(productTypeId, search);
      expect(results.data[0].available).to.equal(true);
      mockProductTypeManager.verify();
      mockOpenSearchDao.verify();
      mockDecorator.verify();
    });
  });
  describe('digestProductsIntoOpenSearch', () => {
    it('should call bulk with digested products pruned of decorated fields', async () => {
      const product = ModelFactory.pricedProduct({
        available: true,
        subscriptionIds: [123, 112, 223],
        childProducts: [ModelFactory.product()],
        meta: {
          effectivePrice: 10.45,
        },
      });
      const digest = ModelFactory.digest({ productId: product.productId });

      mockDigestManager
        .expects('digestProducts')
        .withExactArgs([product])
        .resolves([digest]);
      mockOpenSearchDao.expects('bulkProducts').withExactArgs([
        {
          ..._.omit(product, [
            'available',
            'subscriptionIds',
            'childProducts',
            'meta.effectivePrice',
            'purchaseOptions',
          ]),
          digest,
        },
      ]);
      await openSearchManager.digestProductsIntoOpenSearch([product]);
      mockDigestManager.verify();
      mockOpenSearchDao.verify();
    });
  });
  describe('incrementProductTotalSales', () => {
    it('should call updateByScript without specific increment', async () => {
      const productId = faker.random.number(1000);
      const expectedNewCount = 1;
      mockOpenSearchDao
        .expects('updateByScript')
        .withArgs(
          productId,
          productTypeId,
          {
            params: { newCount: expectedNewCount },
            source: sinon.match.string,
          },
          0,
        )
        .once()
        .resolves(true);

      await openSearchManager.incrementProductTotalSales(
        productId,
        productTypeId,
      );

      mockOpenSearchDao.verify();
    });
    it('should call updateByScript with specific increment', async () => {
      const productId = faker.random.number(1000);
      const newCount = faker.random.number(10);
      mockOpenSearchDao
        .expects('updateByScript')
        .withArgs(
          productId,
          productTypeId,
          { params: { newCount }, source: sinon.match.string },
          0,
        )
        .once()
        .resolves(true);

      await openSearchManager.incrementProductTotalSales(
        productId,
        productTypeId,
        newCount,
      );

      mockOpenSearchDao.verify();
    });
    it('should call updateByScript with retries', async () => {
      const productId = faker.random.number(1000);
      const newCount = faker.random.number(10);
      const retries = faker.random.number(10);
      mockOpenSearchDao
        .expects('updateByScript')
        .withArgs(
          productId,
          productTypeId,
          { params: { newCount }, source: sinon.match.string },
          retries,
        )
        .once()
        .resolves(true);

      await openSearchManager.incrementProductTotalSales(
        productId,
        productTypeId,
        newCount,
        retries,
      );

      mockOpenSearchDao.verify();
    });
  });
  describe('getProductsByRules', () => {
    it('should build correct search and call getAffectedProductsByRules', async () => {
      const movieProductType = ProductTypeIds.Movie;
      const rules = [
        ModelFactory.movieAvailabilityRule({
          ruleId: 123,
          clauses: { productId: [1] },
        }),
        ModelFactory.movieAvailabilityRule({
          ruleId: 124,
          clauses: { productId: [2] },
        }),
        ModelFactory.movieAvailabilityRule({
          ruleId: 125,
          clauses: { 'source.vendorProductId': ['vendorId'] },
        }),
        ModelFactory.movieAvailabilityRule({
          ruleId: 126,
          clauses: { productId: [2] },
        }),
      ];
      const expectedQuery = {
        productTypeId: movieProductType,
        clauses: {
          'digest.ruleIds': [
            rules[0].ruleId,
            rules[1].ruleId,
            rules[2].ruleId,
            rules[3].ruleId,
          ],
          productId: [1, 2],
          'source.vendorProductId': ['vendorId'],
        },
      };
      const expectedSearch = {
        query: expectedQuery,
        pageSize: 10000,
        total: true,
      };

      mockOpenSearchDao
        .expects('getAffectedProductsByRulesSearch')
        .withExactArgs(movieProductType, expectedSearch);

      await openSearchManager.getProductsByRules(movieProductType, rules);
    });
    it('should build correct search and call getAffectedProductsByRules with empty clause rule', async () => {
      const movieProductType = ProductTypeIds.Movie;
      const rules = [
        ModelFactory.movieAvailabilityRule({
          ruleId: 123,
          clauses: { productId: [1] },
        }),
        ModelFactory.movieAvailabilityRule({
          ruleId: 125,
          clauses: { 'source.vendorProductId': ['vendorId'] },
        }),
        ModelFactory.movieAvailabilityRule({ ruleId: 124, clauses: {} }),
      ];
      const expectedQuery = {
        productTypeId: movieProductType,
        clauses: {},
      };
      const expectedSearch = {
        query: expectedQuery,
        pageSize: 10000,
        total: true,
      };

      mockOpenSearchDao
        .expects('getAffectedProductsByRulesSearch')
        .withExactArgs(movieProductType, expectedSearch);

      await openSearchManager.getProductsByRules(movieProductType, rules);
    });
    it('should build correct search and call getScrollPage if scrollId is not null', async () => {
      const movieProductTypeId = ProductTypeIds.Movie;
      const rules = [
        ModelFactory.movieAvailabilityRule({
          ruleId: 123,
          clauses: { productId: [1] },
        }),
        ModelFactory.movieAvailabilityRule({
          ruleId: 125,
          clauses: { 'source.vendorProductId': ['vendorId'] },
        }),
        ModelFactory.movieAvailabilityRule({ ruleId: 124, clauses: {} }),
      ];
      mockOpenSearchDao.expects('getScrollPage').withExactArgs('scroll-id');

      await openSearchManager.getProductsByRules(
        movieProductTypeId,
        rules,
        'scroll-id',
      );
    });
  });
});

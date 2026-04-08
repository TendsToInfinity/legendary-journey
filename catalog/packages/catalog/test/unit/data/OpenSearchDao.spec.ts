import { SecurityContextManager } from '@securustablets/libraries.httpsecurity';
import { _, apmWrapper } from '@securustablets/libraries.utils';
import { expect } from 'chai';
import * as faker from 'faker';
import * as sinon from 'sinon';
import { Container } from 'typescript-ioc';
import { ProductStatus } from '../../../db/reference/Product';
import { Search } from '../../../src/controllers/models/Search';
import { OpenSearchDao } from '../../../src/data/OpenSearchDao';
import { OpenSearchHelper } from '../../../src/lib/OpenSearchHelper';
import { ModelFactory } from '../../utils/ModelFactory';

describe('OpenSearchDao - Unit', () => {
  let openSearchDao: OpenSearchDao;
  let mockOsClient: sinon.SinonMock;
  let mockSearchHelper: sinon.SinonMock;
  let mockAppConfig: sinon.SinonMock;
  let mockLogger: sinon.SinonMock;
  let mockOpenSearchConverter: sinon.SinonMock;
  let mockApmWrapper: sinon.SinonMock;

  const productTypeId = 'FooBar';
  const productType = ModelFactory.productType();

  beforeEach(() => {
    openSearchDao = new OpenSearchDao();

    mockOsClient = sinon.mock((openSearchDao as any).client);
    mockSearchHelper = sinon.mock((openSearchDao as any).searchHelper);
    mockAppConfig = sinon.mock((openSearchDao as any).config);
    mockLogger = sinon.mock((openSearchDao as any).logger);
    mockOpenSearchConverter = sinon.mock(
      (openSearchDao as any).openSearchConverter,
    );
    mockApmWrapper = sinon.mock(apmWrapper);
  });

  afterEach(() => {
    sinon.restore();
  });
  describe('bulkProducts', () => {
    it('should gracefully do nothing if nothing is sent', async () => {
      mockLogger
        .expects('info')
        .withExactArgs('Refusing to bulkProducts for an empty array')
        .once();
      mockOsClient.expects('bulk').never();
      await openSearchDao.bulkProducts([]);
      mockLogger.verify();
      mockOsClient.verify();
    });
    it('should send a properly formatted bulk index request', async () => {
      const product = ModelFactory.product({ isBlocked: false });
      const body = [
        {
          update: {
            _index: `${product.productTypeId.toLowerCase()}_main`,
            _id: product.productId,
          },
        },
        { doc: product, doc_as_upsert: true },
      ];
      mockOsClient
        .expects('bulk')
        .withExactArgs({
          body,
          filter_path: [
            'items.update._id',
            'errors',
            'items.update.status',
            'items.update.error',
          ],
          refresh: true,
        })
        .resolves({ body: {} });
      mockLogger
        .expects('debug')
        .withExactArgs(sinon.match(/^Begin query:/))
        .once();
      mockApmWrapper
        .expects('startSpan')
        .withExactArgs('openSearchQuery', 'db')
        .returns(null);
      mockLogger
        .expects('debug')
        .withExactArgs(sinon.match(/^End query:/))
        .once();
      await openSearchDao.bulkProducts([product]);
      mockApmWrapper.verify();
      mockLogger.verify();
      mockOsClient.verify();
    });
    it('should only log items with errors in bulk query', async () => {
      const product = ModelFactory.product();
      const body = [
        {
          update: {
            _index: `${product.productTypeId.toLowerCase()}_main`,
            _id: product.productId,
          },
        },
        { doc: product, doc_as_upsert: true },
      ];
      const documentError = { _id: product.productId, update: { status: 500 } };
      mockOsClient
        .expects('bulk')
        .withExactArgs({
          body,
          filter_path: [
            'items.update._id',
            'errors',
            'items.update.status',
            'items.update.error',
          ],
          refresh: true,
        })
        .resolves({ body: { errors: true, items: [documentError] } });
      const apmSpanStub = sinon.stub({ end: () => null });
      mockApmWrapper
        .expects('startSpan')
        .withExactArgs('openSearchQuery', 'db')
        .returns(apmSpanStub);
      mockLogger
        .expects('debug')
        .withExactArgs(sinon.match(/^Begin query:/))
        .once();
      mockLogger
        .expects('debug')
        .withExactArgs(sinon.match(/^End query:/))
        .once();
      mockLogger
        .expects('error')
        .withExactArgs(JSON.stringify([documentError]))
        .once();
      await openSearchDao.bulkProducts([product]);
      expect(apmSpanStub.end.calledOnce).to.equal(true);
      mockApmWrapper.verify();
      mockLogger.verify();
      mockOsClient.verify();
    });

    it('should convert a digested product before bulking', async () => {
      const product = ModelFactory.product({
        meta: { startDate: '2020-01-01', endDate: '2026-01-01' },
      });
      product.digest = ModelFactory.digest({
        productId: product.productId,
        ruleIds: [123, 32, 44],
        availableGlobally: true,
        whitelist: ['I-123', '99516'],
        blacklist: ['I-9', '90210'],
      });

      const expectedProduct = {
        ...product,
        isBlocked: false,
        digest: {
          ruleIds: [123, 32, 44],
          availableGlobally: true,
          sales: { totalSales: null },
          subscriptionProductIds: [],
          whitelist: ['I-123', '99516'],
          blacklist: ['I-9', '90210'],
        },
      };
      const body = [
        {
          update: {
            _index: `${product.productTypeId.toLowerCase()}_main`,
            _id: product.productId,
          },
        },
        { doc: expectedProduct, doc_as_upsert: true },
      ];
      const documentError = { _id: product.productId, update: { status: 500 } };
      mockOsClient
        .expects('bulk')
        .withExactArgs({
          body,
          filter_path: [
            'items.update._id',
            'errors',
            'items.update.status',
            'items.update.error',
          ],
          refresh: true,
        })
        .resolves({ body: { errors: true, items: [documentError] } });
      const apmSpanStub = sinon.stub({ end: () => null });
      mockApmWrapper
        .expects('startSpan')
        .withExactArgs('openSearchQuery', 'db')
        .returns(apmSpanStub);
      mockLogger
        .expects('debug')
        .withExactArgs(sinon.match(/^Begin query:/))
        .once();
      mockLogger
        .expects('debug')
        .withExactArgs(sinon.match(/^End query:/))
        .once();
      mockLogger
        .expects('error')
        .withExactArgs(JSON.stringify([documentError]))
        .once();
      await openSearchDao.bulkProducts([product]);
      expect(apmSpanStub.end.calledOnce).to.equal(true);
      mockApmWrapper.verify();
      mockLogger.verify();
      mockOsClient.verify();
    });
  });
  describe('scrollSearch', () => {
    it('should return a Paginated<Product> with a scrollId', async () => {
      const product = {
        _source: ModelFactory.product(),
      };
      const search: Search = {
        context: { enforce: false },
        pageNumber: 10,
        pageSize: 100,
      };
      const osQuery = {
        query: { bool: { must: [], must_not: [] } },
        sort: [],
        size: 100,
        track_total_hits: true,
      };
      const expectedResult = {
        scrollId: 'scrollId',
        pageNumber: 0,
        pageSize: 100,
        data: [product._source],
        total: 100,
      };
      const openSearchResponse = {
        body: {
          hits: { total: { value: 100 }, hits: [product] },
          _scroll_id: 'scrollId',
        },
      };
      mockOpenSearchConverter
        .expects('convertSearchToQuery')
        .withExactArgs(search, productType)
        .returns(osQuery);
      mockOsClient
        .expects('search')
        .withExactArgs({
          index: 'foobar_search',
          body: _.omit(osQuery, 'from'),
          scroll: '5m',
        })
        .resolves(openSearchResponse);
      const apmSpanStub = sinon.stub({ end: () => null });
      mockApmWrapper
        .expects('startSpan')
        .withExactArgs('openSearchQuery', 'db')
        .returns(apmSpanStub);
      mockLogger
        .expects('debug')
        .withExactArgs(sinon.match(/^Begin query:/))
        .once();
      mockLogger
        .expects('debug')
        .withExactArgs(sinon.match(/^End query:/))
        .once();
      const results = await openSearchDao.scrollSearch(
        productTypeId,
        search,
        productType,
      );
      expect(apmSpanStub.end.calledOnce).to.equal(true);
      mockApmWrapper.verify();
      expect(results).to.deep.equal(expectedResult);
      mockOpenSearchConverter.verify();
      mockOsClient.verify();
      mockLogger.verify();
    });
    it('should return support total with scroll searches', async () => {
      const product = {
        _source: ModelFactory.product(),
      };
      const search: Search = {
        context: { enforce: false },
        pageNumber: 10,
        pageSize: 100,
        total: true,
      };
      const osQuery = {
        query: { bool: { must: [], must_not: [] } },
        sort: [],
        size: 100,
        track_total_hits: true,
      };
      const expectedResult = {
        scrollId: 'scrollId',
        pageNumber: 0,
        pageSize: 100,
        data: [product._source],
        total: 100,
      };
      const openSearchResponse = {
        body: {
          hits: { total: { value: 100 }, hits: [product] },
          _scroll_id: 'scrollId',
        },
      };
      mockOpenSearchConverter
        .expects('convertSearchToQuery')
        .withExactArgs(search, productType)
        .returns(osQuery);
      mockOsClient
        .expects('search')
        .withExactArgs({
          index: 'foobar_search',
          body: _.omit(osQuery, 'from'),
          scroll: '5m',
        })
        .resolves(openSearchResponse);
      const apmSpanStub = sinon.stub({ end: () => null });
      mockApmWrapper
        .expects('startSpan')
        .withExactArgs('openSearchQuery', 'db')
        .returns(apmSpanStub);
      mockLogger
        .expects('debug')
        .withExactArgs(sinon.match(/^Begin query:/))
        .once();
      mockLogger
        .expects('debug')
        .withExactArgs(sinon.match(/^End query:/))
        .once();
      const results = await openSearchDao.scrollSearch(
        productTypeId,
        search,
        productType,
      );
      expect(apmSpanStub.end.calledOnce).to.equal(true);
      mockApmWrapper.verify();
      expect(results).to.deep.equal(expectedResult);
      mockOpenSearchConverter.verify();
      mockOsClient.verify();
      mockLogger.verify();
    });
  });
  describe('getScrollPage', () => {
    it('should return a Paginated<Product> with a scrollId', async () => {
      const product = {
        _source: ModelFactory.product(),
      };
      const expectedResult = {
        scrollId: 'scrollId',
        pageNumber: 0,
        pageSize: 25,
        data: [product._source],
        total: 100,
      };
      const openSearchResponse = {
        body: {
          hits: { total: { value: 100 }, hits: [product] },
          _scroll_id: 'scrollId',
        },
      };
      mockOsClient
        .expects('scroll')
        .withExactArgs({
          scroll_id: 'scrollId',
          scroll: '5m',
        })
        .resolves(openSearchResponse);
      const apmSpanStub = sinon.stub({ end: () => null });
      mockApmWrapper
        .expects('startSpan')
        .withExactArgs('openSearchQuery', 'db')
        .returns(apmSpanStub);
      mockLogger
        .expects('debug')
        .withExactArgs(sinon.match(/^Begin query:/))
        .once();
      mockLogger
        .expects('debug')
        .withExactArgs(sinon.match(/^End query:/))
        .once();
      const results = await openSearchDao.getScrollPage('scrollId');
      expect(apmSpanStub.end.calledOnce).to.equal(true);
      mockApmWrapper.verify();
      expect(results).to.deep.equal(expectedResult);
      mockOpenSearchConverter.verify();
      mockOsClient.verify();
      mockLogger.verify();
    });
  });
  describe('search', () => {
    it('should return a Paginated<Product>', async () => {
      const product = {
        _source: ModelFactory.product(),
      };
      const search: Search = {
        context: { enforce: false },
        pageNumber: 10,
        pageSize: 100,
        total: true,
      };
      const osQuery = {
        query: { bool: { must: [], must_not: [] } },
        sort: [],
        from: 1000,
        size: 100,
        track_total_hits: true,
      };
      const expectedResult = {
        pageSize: 100,
        data: [product._source],
        pageNumber: 10,
        total: 100,
      };
      const openSearchResponse = {
        body: { hits: { total: { value: 100 }, hits: [product] } },
      };
      mockOpenSearchConverter
        .expects('convertSearchToQuery')
        .withExactArgs(search, productType)
        .returns(osQuery);
      mockLogger
        .expects('info')
        .withExactArgs(
          `OpenSearch index: foobar_search, query: ${JSON.stringify(osQuery)}`,
        )
        .once();
      mockOsClient
        .expects('search')
        .withExactArgs({
          index: 'foobar_search',
          body: osQuery,
        })
        .resolves(openSearchResponse);
      const apmSpanStub = sinon.stub({ end: () => null });
      mockApmWrapper
        .expects('startSpan')
        .withExactArgs('openSearchQuery', 'db')
        .returns(apmSpanStub);
      mockLogger
        .expects('debug')
        .withExactArgs(sinon.match(/^Begin query:/))
        .once();
      mockLogger
        .expects('debug')
        .withExactArgs(sinon.match(/^End query:/))
        .once();
      const results = await openSearchDao.search(
        productTypeId,
        search,
        productType,
      );
      expect(apmSpanStub.end.calledOnce).to.equal(true);
      mockApmWrapper.verify();
      expect(results).to.deep.equal(expectedResult);
      mockOpenSearchConverter.verify();
      mockOsClient.verify();
      mockLogger.verify();
    });
    it('should not return total if not requested', async () => {
      sinon
        .stub(Container.get(SecurityContextManager), 'securityContext')
        .value({ inmateJwt: undefined });
      const product = {
        _source: ModelFactory.product(),
      };
      const search: Search = {
        context: { enforce: false },
        pageNumber: 10,
        pageSize: 100,
      };
      const osQuery = {
        query: { bool: { must: [], must_not: [] } },
        sort: [],
        from: 1000,
        size: 100,
      };
      const expectedResult = {
        pageSize: 100,
        data: [product._source],
        pageNumber: 10,
      };
      const openSearchResponse = {
        body: { hits: { total: 100, hits: [product] } },
      };
      mockOpenSearchConverter
        .expects('convertSearchToQuery')
        .withExactArgs(search, productType)
        .returns(osQuery);
      mockLogger
        .expects('info')
        .withExactArgs(
          `OpenSearch index: foobar_search, query: ${JSON.stringify(osQuery)}`,
        )
        .once();
      mockOsClient
        .expects('search')
        .withExactArgs({
          index: 'foobar_search',
          body: osQuery,
        })
        .resolves(openSearchResponse);
      const apmSpanStub = sinon.stub({ end: () => null });
      mockApmWrapper
        .expects('startSpan')
        .withExactArgs('openSearchQuery', 'db')
        .returns(apmSpanStub);
      mockLogger
        .expects('debug')
        .withExactArgs(sinon.match(/^Begin query:/))
        .once();
      mockLogger
        .expects('debug')
        .withExactArgs(sinon.match(/^End query:/))
        .once();
      const results = await openSearchDao.search(
        productTypeId,
        search,
        productType,
      );
      expect(apmSpanStub.end.calledOnce).to.equal(true);
      mockApmWrapper.verify();
      expect(results).to.deep.equal(expectedResult);
      mockOpenSearchConverter.verify();
      mockOsClient.verify();
      mockLogger.verify();
    });
  });
  describe('update', () => {
    it('should return false if error occurs', async () => {
      const productId = faker.random.number(9999);
      const script = 'any script';
      mockLogger.expects('error').once();
      mockOsClient
        .expects('update')
        .withExactArgs({
          body: { script },
          id: productId.toString(),
          index: OpenSearchHelper.getIndexFromProductTypeId(productTypeId),
          retry_on_conflict: 0,
        })
        .once()
        .throwsException();

      const result = await openSearchDao.updateByScript(
        productId,
        productTypeId,
        script,
      );

      expect(result).to.be.false;
      mockOsClient.verify();
      mockLogger.verify();
    });
    it('should return true if update succeeds', async () => {
      const productId = faker.random.number(9999);
      const script = 'any script';
      mockLogger.expects('debug').twice();
      mockLogger.expects('error').never();
      mockOsClient
        .expects('update')
        .withExactArgs({
          body: { script },
          id: productId.toString(),
          index: OpenSearchHelper.getIndexFromProductTypeId(productTypeId),
          retry_on_conflict: 0,
        })
        .once()
        .returns({});

      const result = await openSearchDao.updateByScript(
        productId,
        productTypeId,
        script,
      );

      expect(result).to.be.true;
      mockOsClient.verify();
      mockLogger.verify();
    });
  });
  describe('getAffectedProductsByRulesSearch', () => {
    it('should return a Paginated<Product>', async () => {
      const product = {
        _source: ModelFactory.product(),
      };
      const search: Search = {
        query: {
          productTypeId: 'movie',
          clauses: {
            'digest.ruleIds': [1, 2, 3, 4],
            productId: [1, 2],
            'source.vendorProductId': ['vendorId'],
          },
        },
        pageSize: 10000,
        total: true,
      };
      const osQuery = {
        query: {
          bool: {
            filter: [
              { term: { 'status.keyword': ProductStatus.Active } },
              { term: { isBlocked: false } },
            ],
            should: [
              { terms: { 'digest.ruleIds': [1, 2, 3, 4] } },
              { terms: { _id: [1, 2] } },
              { terms: { 'source.vendorProductId.keyword': ['vendorId'] } },
            ],
            minimum_should_match: 1,
          },
        },
        size: 10000,
        from: 0,
        track_total_hits: true,
      };
      const expectedResult = {
        pageSize: 10000,
        data: [product._source],
        pageNumber: 0,
        total: 100,
      };
      const openSearchResponse = {
        body: { hits: { total: { value: 100 }, hits: [product] } },
      };
      mockOpenSearchConverter
        .expects('convertRulesSearchToQuery')
        .withExactArgs(search)
        .returns(osQuery);
      mockLogger
        .expects('info')
        .withExactArgs(
          `OpenSearch index: foobar_search, query: ${JSON.stringify(osQuery)}`,
        )
        .once();
      mockOsClient
        .expects('search')
        .withExactArgs({
          index: 'foobar_search',
          body: osQuery,
          scroll: '5m',
        })
        .resolves(openSearchResponse);
      const apmSpanStub = sinon.stub({ end: () => null });
      mockApmWrapper
        .expects('startSpan')
        .withExactArgs('openSearchQuery', 'db')
        .returns(apmSpanStub);
      mockLogger
        .expects('debug')
        .withExactArgs(sinon.match(/^Begin query:/))
        .once();
      mockLogger
        .expects('debug')
        .withExactArgs(sinon.match(/^End query:/))
        .once();
      const results = await openSearchDao.getAffectedProductsByRulesSearch(
        productTypeId,
        search,
      );
      expect(apmSpanStub.end.calledOnce).to.equal(true);
      mockApmWrapper.verify();
      expect(results).to.deep.equal(expectedResult);
      mockOpenSearchConverter.verify();
      mockOsClient.verify();
      mockLogger.verify();
    });
  });
});

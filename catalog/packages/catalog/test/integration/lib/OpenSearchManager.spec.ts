import { JwtType } from '@securustablets/libraries.httpsecurity';
import { _ } from '@securustablets/libraries.utils';
import { SecurityFactory } from '@securustablets/libraries.utils-test';
import * as Bluebird from 'bluebird';
import { expect } from 'chai';
import * as request from 'supertest';
import { ProductStatus } from '../../../db/reference/Product';
import { CatalogService } from '../../../src/CatalogService';
import { Search } from '../../../src/controllers/models/Search';
import { OpenSearchDao } from '../../../src/data/OpenSearchDao';
import { ProductDao } from '../../../src/data/PGCatalog/ProductDao';
import { RuleDao } from '../../../src/data/PGCatalog/RuleDao';
import { OpenSearchManager } from '../../../src/lib/OpenSearchManager';
import { RuleManager } from '../../../src/lib/RuleManager';
import { app } from '../../../src/main';
import { ModelFactory } from '../../utils/ModelFactory';
import { IntegrationTestSuite } from '../IntegrationTestSuite';

describe('OpenSearchManager - Integration', function () {
  IntegrationTestSuite.setUp(this, { openSearch: true });
  let openSearchDao: OpenSearchDao;
  let openSearchManager: OpenSearchManager;
  let productDao: ProductDao;
  let ruleManager: RuleManager;
  let ruleDao: RuleDao;

  const productTypeId = 'movie';
  const customerId = 'I-24601';
  const siteId = '90210';

  before(() => {
    CatalogService.bindAll();
  });

  beforeEach(() => {
    openSearchDao = new OpenSearchDao();
    openSearchManager = new OpenSearchManager();
    productDao = new ProductDao();
    ruleManager = new RuleManager();
    ruleDao = new RuleDao();
  });

  describe('scrollSearch', () => {
    it('should return a search result with a scrollId', async () => {
      const products = [
        ModelFactory.product({ productTypeId }),
        ModelFactory.product({ productTypeId }),
        ModelFactory.product({ productTypeId }),
      ];
      await openSearchManager.digestProductsIntoOpenSearch(products);
      const searchResult = await openSearchManager.scrollSearch(
        productTypeId,
        {},
      );
      expect(searchResult).to.haveOwnProperty('scrollId');
      expect(searchResult.data.length).to.equal(3);
      expect(searchResult.total).to.equal(3);
    });
    it('should return two scrolled pages of search results', async () => {
      const products = [
        ModelFactory.product({ productTypeId }),
        ModelFactory.product({ productTypeId }),
        ModelFactory.product({ productTypeId }),
        ModelFactory.product({ productTypeId }),
        ModelFactory.product({ productTypeId }),
      ];
      await openSearchManager.digestProductsIntoOpenSearch(products);
      const searchResult = await openSearchManager.scrollSearch(productTypeId, {
        pageSize: 3,
      });
      expect(searchResult).to.haveOwnProperty('scrollId');
      expect(searchResult.data.length).to.equal(3);
      expect(searchResult.total).to.equal(5);
      const scrollPageResult = await openSearchManager.getScrollPage(
        searchResult.scrollId,
      );
      expect(scrollPageResult.data.length).to.equal(2);
      expect(searchResult.total).to.equal(5);
    });
  });

  describe('search', () => {
    it('should return an empty search if productType is disabled', async () => {
      const products = [
        ModelFactory.product({ productTypeId }),
        ModelFactory.product({ productTypeId }),
        ModelFactory.product({ productTypeId }),
      ];
      await openSearchManager.digestProductsIntoOpenSearch(products);
      const search: Search = {
        context: { enforce: true },
        total: true,
      };
      const expectedResult = {
        pageSize: 25,
        pageNumber: 0,
        total: 0,
        data: [],
      };
      const searchResult = await openSearchManager.search(
        productTypeId,
        search,
      );
      expect(searchResult).to.deep.equal(expectedResult);
    });
    it('should return results with digest if enforce:false', async () => {
      await IntegrationTestSuite.enableProductTypes(
        [productTypeId],
        [{ customerId }],
      );
      const productPartial = {
        productTypeId,
        status: ProductStatus.Active,
        startDate: '1970-01-01',
        endDate: '9999-01-01',
        isBlocked: false,
      };
      const products = [
        ModelFactory.product(productPartial),
        ModelFactory.product(productPartial),
        ModelFactory.product(productPartial),
      ];
      await openSearchManager.digestProductsIntoOpenSearch(products);
      const search: Search = {
        context: { enforce: false, customerId, siteId },
        total: true,
      };
      const searchResult = await openSearchManager.search(
        productTypeId,
        search,
      );
      expect(searchResult.data.length).to.equal(3);
      searchResult.data.forEach((product) => {
        expect(product).to.haveOwnProperty('digest');
      });
    });
    it('should return results with digest redacted if enforce:true', async () => {
      await IntegrationTestSuite.enableProductTypes(
        [productTypeId],
        [{ customerId }],
      );
      const productPartial = {
        productTypeId,
        status: ProductStatus.Active,
        startDate: '1970-01-01',
        endDate: '9999-01-01',
        isBlocked: false,
      };
      const products = [
        ModelFactory.product(productPartial),
        ModelFactory.product(productPartial),
        ModelFactory.product(productPartial),
      ];
      await openSearchManager.digestProductsIntoOpenSearch(products);
      const search: Search = {
        context: { enforce: true, customerId, siteId },
        total: true,
      };
      const searchResult = await openSearchManager.search(
        productTypeId,
        search,
      );
      expect(searchResult.data.length).to.equal(3);
      searchResult.data.forEach((product) => {
        expect(product).to.not.haveOwnProperty('digest');
      });
    });
  });

  describe('incrementProductTotalSales', () => {
    let testToken: string = null;

    before(async () => {
      testToken = await SecurityFactory.jwt(
        SecurityFactory.corpJwt({
          jwtType: JwtType.Corporate,
          username: 'testUser',
          permissions: ['catalogAdmin'],
        }),
      );
    });

    it('should increment total sales count to 1', async () => {
      const product = ModelFactory.product();
      const productId = await productDao.create(product, { apiKey: 'test' });
      product.productId = productId;

      await openSearchManager.digestProductsIntoOpenSearch([product]);

      await openSearchManager.incrementProductTotalSales(
        product.productId,
        product.productTypeId,
        1,
      );

      await new Promise((f) => setTimeout(f, 1000));

      const { body: searchResult } = await request(app)
        .post('/products/search')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          query: {
            productTypeId: product.productTypeId,
            clauses: {},
            productId: productId.toString(),
          },
          orderBy: [{ 'meta.startDate': 'DESC' }],
          total: false,
        });

      expect(searchResult.data[0].digest.sales.totalSales).to.equal(1);
    });

    it('should increment total sales count 100 times, retry_on_conflict set to 120', async () => {
      const increments = 100;
      const retries = 120;

      const product = ModelFactory.product();
      const productId = await productDao.create(product, { apiKey: 'test' });
      product.productId = productId;

      await openSearchManager.digestProductsIntoOpenSearch([product]);

      await Bluebird.map(Array(increments), async () => {
        await openSearchManager.incrementProductTotalSales(
          product.productId,
          product.productTypeId,
          1,
          retries,
        );
      });

      await new Promise((f) => setTimeout(f, 1000));

      const { body: searchResult } = await request(app)
        .post('/products/search')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          query: {
            productTypeId: product.productTypeId,
            clauses: {},
            productId: productId.toString(),
          },
          orderBy: [{ 'meta.startDate': 'DESC' }],
          total: false,
        });

      expect(searchResult.data[0].digest.sales.totalSales).to.equal(increments);
    });
  });

  describe('getProductsByRules', () => {
    it('should handle creating and updating multiple rules', async () => {
      const securityContext = { corpJwt: SecurityFactory.corpJwt() };
      const products = [
        ModelFactory.activeMovie({ source: { vendorProductId: '1' } }), // Skip
        ModelFactory.activeMovie({ source: { vendorProductId: '2' } }), // Skip
        ModelFactory.activeMovie({ source: { vendorProductId: '3' } }), // Skip
        ModelFactory.activeMovie({
          source: { vendorProductId: '4' },
          meta: { genres: ['Action'] },
        }), // Hit
        ModelFactory.activeMovie({
          source: { vendorProductId: '5' },
          meta: { genres: ['Action'] },
        }), // Hit
        ModelFactory.activeMovie({
          source: { vendorProductId: '6' },
          meta: { genres: ['Adventure'] },
        }), // Skip
        ModelFactory.activeMovie({
          source: { vendorProductId: '7' },
          meta: { name: 'testCase' },
        }), // Hit
        ModelFactory.activeMovie({ source: { vendorProductId: '8' } }), // Skip
        ModelFactory.activeMovie({ source: { vendorProductId: '9' } }), // Skip
        ModelFactory.activeMovie({ source: { vendorProductId: '10' } }), // Hit
      ];
      const initialRule = ModelFactory.productAvailabilityRule({
        action: { available: true },
        clauses: { 'source.vendorProductId': ['2', '3', '5'] },
      });
      await IntegrationTestSuite.loadProductsAndRules(
        products,
        [initialRule],
        [{ customerId }],
      );

      const whiteList10 = ModelFactory.productAvailabilityRule({
        action: { available: true },
        clauses: { 'source.vendorProductId': ['10'] },
      });
      const blacklist5 = ModelFactory.productAvailabilityRule({
        action: { available: false },
        clauses: { 'source.vendorProductId': ['5'] },
      });
      const blacklistAction = ModelFactory.productAvailabilityRule({
        action: { available: true },
        clauses: { 'meta.genres': ['Action'] },
      });
      const whiteListTestCaseName = ModelFactory.productAvailabilityRule({
        action: { available: true },
        clauses: { 'meta.name': ['testCase'] },
      });

      whiteList10.ruleId = await ruleDao.create(whiteList10, securityContext);
      blacklist5.ruleId = await ruleDao.create(blacklist5, securityContext);
      blacklistAction.ruleId = await ruleDao.create(
        blacklistAction,
        securityContext,
      );
      whiteListTestCaseName.ruleId = await ruleDao.create(
        whiteListTestCaseName,
        securityContext,
      );

      const productsFromRules = (
        await openSearchManager.getProductsByRules('movie', [
          whiteList10,
          blacklist5,
          blacklistAction,
          whiteListTestCaseName,
        ])
      ).data;
      // Ensure we only return the products the rules match
      expect(productsFromRules.length).to.equal(4);
      const product4 = _.find(
        productsFromRules,
        (p) => p.source.vendorProductId === '4',
      );
      const product5 = _.find(
        productsFromRules,
        (p) => p.source.vendorProductId === '5',
      );
      const product7 = _.find(
        productsFromRules,
        (p) => p.source.vendorProductId === '7',
      );
      const product10 = _.find(
        productsFromRules,
        (p) => p.source.vendorProductId === '10',
      );
      _.forEach(
        [product4, product5, product7, product10],
        (p) => expect(p).to.be.not.be.undefined,
      );

      const allClauseRule = ModelFactory.productAvailabilityRule({
        action: { available: true },
      });
      allClauseRule.ruleId = await ruleDao.create(
        allClauseRule,
        securityContext,
      );

      // Resubmit all previous rules and the all clause rule, ensure all products come back due to the all clause
      const allProducts = (
        await openSearchManager.getProductsByRules('movie', [
          initialRule,
          whiteList10,
          blacklist5,
          blacklistAction,
          whiteListTestCaseName,
          allClauseRule,
        ])
      ).data;
      expect(
        _.uniq(_.map(allProducts, (p) => p.source.vendorProductId)).length,
      ).to.equal(10);
    });
  });
});

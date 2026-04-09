import { expect } from 'chai';
import { CatalogService } from '../../../src/CatalogService';
import { OpenSearchDao } from '../../../src/data/OpenSearchDao';
import { ModelFactory } from '../../utils/ModelFactory';
import { IntegrationTestSuite } from '../IntegrationTestSuite';

describe('OpenSearchDao - Integration', function () {
  IntegrationTestSuite.setUp(this, { postgres: false, openSearch: true });
  let openSearchDao: OpenSearchDao;

  const productTypeId = 'movie';

  before(() => {
    CatalogService.bindAll();
  });

  beforeEach(() => {
    openSearchDao = new OpenSearchDao();
  });

  describe('bulkProducts', () => {
    it('should bulk products', async () => {
      const products = [
        ModelFactory.product({ productTypeId }),
        ModelFactory.product({ productTypeId }),
        ModelFactory.product({ productTypeId }),
      ];
      const result = await openSearchDao.bulkProducts(products);
      expect(result).to.equal(true);
    });
  });
  describe('scrollSearch', () => {
    it('should return a search result with a scrollId', async () => {
      const products = [
        ModelFactory.product({ productTypeId }),
        ModelFactory.product({ productTypeId }),
        ModelFactory.product({ productTypeId }),
      ];
      await openSearchDao.bulkProducts(products);
      const searchResult = await openSearchDao.scrollSearch(
        productTypeId,
        {},
        ModelFactory.productType(),
      );
      expect(searchResult).to.haveOwnProperty('scrollId');
    });
  });
  describe('getScrollPage', () => {
    it('should return a search result from a scrollId', async () => {
      const products = [
        ModelFactory.product({ productTypeId }),
        ModelFactory.product({ productTypeId }),
        ModelFactory.product({ productTypeId }),
      ];
      await openSearchDao.bulkProducts(products);
      const searchResult = await openSearchDao.scrollSearch(
        productTypeId,
        {},
        ModelFactory.productType(),
      );
      expect(searchResult).to.haveOwnProperty('scrollId');
      const scrollResult = await openSearchDao.getScrollPage(
        searchResult.scrollId,
      );
      expect(scrollResult.data).to.deep.equal([]);
      expect(scrollResult.total).to.equal(3);
      expect(scrollResult).to.haveOwnProperty('scrollId');
    });
  });
  describe('search', () => {
    it('should return a search result (without a scrollId)', async () => {
      const products = [
        ModelFactory.product({ productTypeId }),
        ModelFactory.product({ productTypeId }),
        ModelFactory.product({ productTypeId }),
      ];
      await openSearchDao.bulkProducts(products);
      const searchResult = await openSearchDao.search(
        productTypeId,
        {},
        ModelFactory.productType(),
      );
      expect(searchResult).not.to.haveOwnProperty('scrollId');
      expect(searchResult.data.length).to.equal(3);
      expect(searchResult.total).to.equal(undefined);
      expect(searchResult.pageNumber).to.equal(0);
      expect(searchResult.pageSize).to.equal(25);
    });
  });
});

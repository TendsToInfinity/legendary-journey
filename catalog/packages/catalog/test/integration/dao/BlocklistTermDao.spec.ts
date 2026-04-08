import { _ } from '@securustablets/libraries.utils';
import { expect } from 'chai';
import { CatalogService } from '../../../src/CatalogService';
import { BlocklistTermDao } from '../../../src/data/PGCatalog/BlocklistTermDao';
import { ProductDao } from '../../../src/data/PGCatalog/ProductDao';
import { ModelFactory } from '../../utils/ModelFactory';
import { IntegrationTestSuite } from '../IntegrationTestSuite';

describe('BlocklistTermDao - Integration', function () {
  IntegrationTestSuite.setUp(this);
  let blocklistTermDao: BlocklistTermDao;
  let productDao: ProductDao;

  before(() => {
    CatalogService.bindAll();
  });

  beforeEach(() => {
    blocklistTermDao = new BlocklistTermDao();
    productDao = new ProductDao();
  });

  describe('create', () => {
    it('should create a blocklist term', async () => {
      const blocklistTerm = ModelFactory.blocklistTerm();
      const { blocklistTermId } = await blocklistTermDao.createAndRetrieve(
        blocklistTerm,
        ModelFactory.auditContext(),
      );
      const result = await blocklistTermDao.findOneOrFail(blocklistTermId);
      const expected = _.cloneDeep(blocklistTerm);
      expected.blocklistTermId = blocklistTermId;
      expect(blocklistTermId).not.to.be.undefined;
      expect(result).not.to.be.undefined;
      expect(result.blocklistTermId).to.equal(expected.blocklistTermId);
      expect(result.term).to.equal(expected.term);
      expect(result.enabled).to.equal(expected.enabled);
    });
  });

  describe('findByTerms', () => {
    it('should find terms', async () => {
      const productTypeGroupId = ModelFactory.fakeProductTypes;
      const _blocklistTerm = ModelFactory.blocklistTerm({
        term: 'test',
        productTypeGroupId,
      });
      const { blocklistTermId } = await blocklistTermDao.createAndRetrieve(
        _blocklistTerm,
        ModelFactory.auditContext(),
      );
      const terms = ['test', 'term'];
      const blocklistTerms = await blocklistTermDao.findByTerms(
        terms,
        productTypeGroupId,
      );
      expect(blocklistTerms.length).to.equal(1);
      expect(blocklistTerms[0].term).to.equal(terms[0]);
      expect(blocklistTerms[0].blocklistTermId).to.equal(blocklistTermId);
    });
  });

  describe('setTermsStatus', () => {
    it('should enable terms', async () => {
      const _blocklistTerm = ModelFactory.blocklistTerm({
        term: 'test',
        enabled: false,
      });
      const { blocklistTermId } = await blocklistTermDao.createAndRetrieve(
        _blocklistTerm,
        ModelFactory.auditContext(),
      );
      const ids = [blocklistTermId];
      await blocklistTermDao.setTermsStatus(ids, true);
      const result = await blocklistTermDao.findOneOrFail(blocklistTermId);
      expect(result.enabled).to.be.true;
    });
  });

  describe('findByQueryString', () => {
    it('should find terms', async () => {
      const _blocklistTerm = ModelFactory.blocklistTerm({
        term: 'test',
      });
      const { blocklistTermId } = await blocklistTermDao.createAndRetrieve(
        _blocklistTerm,
        ModelFactory.auditContext(),
      );
      const blocklistTerms = await blocklistTermDao.findByQueryString({
        blocklistTermId: blocklistTermId.toString(),
      });
      expect(blocklistTerms.data.length).to.equal(1);
      expect(blocklistTerms.data[0].blocklistTermId).to.equal(blocklistTermId);
    });
  });
});

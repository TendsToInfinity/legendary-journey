import { expect } from 'chai';
import { CatalogService } from '../../../src/CatalogService';
import { BlockActionState } from '../../../src/controllers/models/BlockAction';
import { BlockActionDao } from '../../../src/data/PGCatalog/BlockActionDao';
import { BlocklistTermDao } from '../../../src/data/PGCatalog/BlocklistTermDao';
import { ProductDao } from '../../../src/data/PGCatalog/ProductDao';
import { ModelFactory } from '../../utils/ModelFactory';
import { IntegrationTestSuite } from '../IntegrationTestSuite';

describe('BlockActionDao - Integration', function () {
  IntegrationTestSuite.setUp(this);
  let blocklistTermDao: BlocklistTermDao;
  let blockActionDao: BlockActionDao;
  let productDao: ProductDao;

  before(() => {
    CatalogService.bindAll();
  });

  beforeEach(() => {
    blocklistTermDao = new BlocklistTermDao();
    blockActionDao = new BlockActionDao();
    productDao = new ProductDao();
  });

  describe('create', () => {
    it('should create a block action', async () => {
      const { blocklistTermId } = await blocklistTermDao.createAndRetrieve(
        ModelFactory.blocklistTerm(),
        ModelFactory.auditContext(),
      );
      const blocklistTerm =
        await blocklistTermDao.findOneOrFail(blocklistTermId);
      const { blockActionId } = await blockActionDao.createAndRetrieve(
        ModelFactory.blockAction({
          blocklistTermIds: [blocklistTerm.blocklistTermId],
          state: BlockActionState.Pending,
        }),
        ModelFactory.auditContext(),
      );
      const blockAction = await blockActionDao.findOneOrFail(blockActionId);
      expect(blockAction.blocklistTermIds).to.deep.equal([
        +blocklistTerm.blocklistTermId,
      ]);
      expect(blockAction.blockActionId).to.be.equal(blockActionId);
    });

    it('should create a block action with multiple blocklist terms', async () => {
      const { blocklistTermId } = await blocklistTermDao.createAndRetrieve(
        ModelFactory.blocklistTerm({ term: 'unique1' }),
        ModelFactory.auditContext(),
      );
      const blocklistTerm2 = await blocklistTermDao.createAndRetrieve(
        ModelFactory.blocklistTerm({ term: 'unique2' }),
        ModelFactory.auditContext(),
      );
      const { blockActionId } = await blockActionDao.createAndRetrieve(
        ModelFactory.blockAction({
          blocklistTermIds: [blocklistTermId, blocklistTerm2.blocklistTermId],
          state: BlockActionState.Pending,
        }),
        ModelFactory.auditContext(),
      );

      const blockAction = await blockActionDao.findOneOrFail(blockActionId);
      expect(blockAction.blocklistTermIds).to.deep.equal([
        +blocklistTermId,
        +blocklistTerm2.blocklistTermId,
      ]);
      expect(blockAction.blockActionId).to.be.equal(blockActionId);
    });
  });

  describe('find', () => {
    it('should find a block action', async () => {
      const { blocklistTermId } = await blocklistTermDao.createAndRetrieve(
        ModelFactory.blocklistTerm({ term: 'unique1' }),
        ModelFactory.auditContext(),
      );
      const blocklistTerm2 = await blocklistTermDao.createAndRetrieve(
        ModelFactory.blocklistTerm({ term: 'unique2' }),
        ModelFactory.auditContext(),
      );
      const { blockActionId } = await blockActionDao.createAndRetrieve(
        ModelFactory.blockAction({
          blocklistTermIds: [blocklistTermId, blocklistTerm2.blocklistTermId],
          state: BlockActionState.Pending,
        }),
        ModelFactory.auditContext(),
      );

      const blockAction = await blockActionDao.findOneOrFail(blockActionId);
      expect(blockAction.blocklistTermIds).to.deep.equal([
        +blocklistTermId,
        +blocklistTerm2.blocklistTermId,
      ]);
      expect(blockAction.blockActionId).to.be.equal(blockActionId);
    });
  });

  describe('findByQueryString', () => {
    it('should find a block action', async () => {
      const { blocklistTermId } = await blocklistTermDao.createAndRetrieve(
        ModelFactory.blocklistTerm(),
        ModelFactory.auditContext(),
      );
      const blocklistTerm2 = await blocklistTermDao.createAndRetrieve(
        ModelFactory.blocklistTerm(),
        ModelFactory.auditContext(),
      );
      const { blockActionId } = await blockActionDao.createAndRetrieve(
        ModelFactory.blockAction({
          blocklistTermIds: [blocklistTermId, blocklistTerm2.blocklistTermId],
          state: BlockActionState.Pending,
        }),
        ModelFactory.auditContext(),
      );

      const blockActions = await blockActionDao.findByQueryString({});

      expect(blockActions).to.be.not.null;
      expect(blockActions.data.length).to.equal(1);
      expect(blockActions.data[0].blocklistTermIds).to.deep.equal([
        +blocklistTermId,
        +blocklistTerm2.blocklistTermId,
      ]);
      expect(blockActions.data[0].blockActionId).to.be.equal(blockActionId);
    });
  });
});

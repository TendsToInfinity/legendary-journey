import { expect } from 'chai';
import { Schema } from 'jsonschema';
import { CatalogService } from '../../../src/CatalogService';
import { BlockActionState } from '../../../src/controllers/models/BlockAction';
import { BlockActionDao } from '../../../src/data/PGCatalog/BlockActionDao';
import { BlockReasonDao } from '../../../src/data/PGCatalog/BlockReasonDao';
import { BlocklistTermDao } from '../../../src/data/PGCatalog/BlocklistTermDao';
import { ProductDao } from '../../../src/data/PGCatalog/ProductDao';
import { ProductTypeDao } from '../../../src/data/PGCatalog/ProductTypeDao';
import { ModelFactory } from '../../utils/ModelFactory';
import * as client from '../../utils/client';
import { IntegrationTestSuite } from '../IntegrationTestSuite';
import '../global.spec';

describe('BlockReasonDao - Integration', function () {
  IntegrationTestSuite.setUp(this);
  let blocklistTermDao: BlocklistTermDao;
  let blockActionDao: BlockActionDao;
  let blockReasonDao: BlockReasonDao;
  let productDao: ProductDao;
  let productTypeDao: ProductTypeDao;
  let movieSchema: Schema;

  before(() => {
    CatalogService.bindAll();
  });

  beforeEach(async () => {
    blocklistTermDao = new BlocklistTermDao();
    blockActionDao = new BlockActionDao();
    blockReasonDao = new BlockReasonDao();
    productDao = new ProductDao();
    productTypeDao = new ProductTypeDao();
    movieSchema = (await productTypeDao.findOneOrFail('movie')).jsonSchema;
  });

  describe('createAndRetrieve', () => {
    it('should create a block reason', async () => {
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
      const { productId } = await client.createProduct(
        ModelFactory.productFromSchema(movieSchema),
      );
      const { blockReasonId } = await blockReasonDao.createAndRetrieve(
        ModelFactory.blockReason({
          blockActionId,
          term: blocklistTerm.term,
          termId: blocklistTerm.blocklistTermId,
          productId,
        }),
        ModelFactory.auditContext(),
      );
      const blockAction = await blockActionDao.findOneOrFail(blockActionId);
      const blockReason = await blockReasonDao.findOneOrFail(blockReasonId);
      expect(blockAction.blocklistTermIds).to.deep.equal([
        +blocklistTerm.blocklistTermId,
      ]);
      expect(blockReason.blockReasonId).to.be.equal(blockReasonId);
      expect(blockReason.blockActionId).to.be.equal(blockActionId);
      expect(blockReason.term).to.be.equal(blocklistTerm.term);
      expect(blockReason.termId).to.be.equal(blocklistTerm.blocklistTermId);
    });

    it('should create a block reason with multiple blocklist terms', async () => {
      const { blocklistTermId } = await blocklistTermDao.createAndRetrieve(
        ModelFactory.blocklistTerm({ term: 'unique1' }),
        ModelFactory.auditContext(),
      );
      let blocklistTerm2 = await blocklistTermDao.createAndRetrieve(
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

      const blocklistTerm1 =
        await blocklistTermDao.findOneOrFail(blocklistTermId);
      const { productId } = await client.createProduct(
        ModelFactory.productFromSchema(movieSchema),
      );
      const blockReason1 = await blockReasonDao.createAndRetrieve(
        ModelFactory.blockReason({
          blockActionId,
          term: blocklistTerm1.term,
          termId: blocklistTerm1.blocklistTermId,
          productId,
        }),
        ModelFactory.auditContext(),
      );
      const blockReason1Id = blockReason1.blockReasonId;

      blocklistTerm2 = await blocklistTermDao.findOneOrFail(
        blocklistTerm2.blocklistTermId,
      );
      const product2 = await client.createProduct(
        ModelFactory.productFromSchema(movieSchema),
      );
      const blockReason2 = await blockReasonDao.createAndRetrieve(
        ModelFactory.blockReason({
          blockActionId,
          term: blocklistTerm2.term,
          termId: blocklistTerm2.blocklistTermId,
          productId: product2.productId,
        }),
        ModelFactory.auditContext(),
      );
      const blockReason2Id = blockReason2.blockReasonId;
      const paginatedResult = await blockReasonDao.findByQueryString({
        blockActionId: blockActionId.toString(),
        orderBy: `blockReasonId:asc`,
      });

      const blockReasons = paginatedResult.data;

      expect(blockReasons).to.be.not.null;
      expect(blockReasons.length).to.be.equal(2);
      expect(blockReasons[0]).to.be.not.null;
      expect(blockReasons[1]).to.be.not.null;
      expect(blockReasons[0].blockReasonId).to.be.equal(blockReason1Id);
      expect(blockReasons[1].blockReasonId).to.be.equal(blockReason2Id);
      expect(blockReasons[0].blockActionId).to.be.equal(blockActionId);
      expect(blockReasons[1].blockActionId).to.be.equal(blockActionId);
      expect(blockReasons[0].term).to.be.equal(blocklistTerm1.term);
      expect(blockReasons[1].term).to.be.equal(blocklistTerm2.term);
      expect(blockReasons[0].termId).to.be.equal(
        blocklistTerm1.blocklistTermId,
      );
      expect(blockReasons[1].termId).to.be.equal(
        blocklistTerm2.blocklistTermId,
      );
    });

    it('should create a block reason with a product id', async () => {
      const productId = await productDao.create(
        ModelFactory.product(),
        ModelFactory.auditContext(),
      );

      const { blockActionId } = await blockActionDao.createAndRetrieve(
        ModelFactory.blockAction({
          productId,
          state: BlockActionState.Pending,
        }),
        ModelFactory.auditContext(),
      );

      await client.createProduct(
        ModelFactory.productFromSchema(movieSchema, { productId }),
      );
      const { blockReasonId } = await blockReasonDao.createAndRetrieve(
        ModelFactory.blockReason({
          blockActionId,
          productId,
        }),
        ModelFactory.auditContext(),
      );

      const blockAction = await blockActionDao.findOneOrFail(blockActionId);
      const blockReason = await blockReasonDao.findOneOrFail(blockReasonId);

      expect(blockAction).not.be.null;
      expect(blockReason).not.be.null;
      expect(blockAction.productId).to.equal(productId);
      expect(blockAction.blockActionId).to.be.equal(blockActionId);
      expect(blockReason.productId).to.be.equal(productId);
      expect(blockReason.blockActionId).to.be.equal(blockActionId);
    });
  });
});

import { _ } from '@securustablets/libraries.utils';
import * as Bluebird from 'bluebird';
import { expect } from 'chai';
import { Schema } from 'jsonschema';
import * as sinon from 'sinon';
import { CatalogService } from '../../../src/CatalogService';
import {
  BlockAction,
  BlockActionState,
  BlockActionType,
} from '../../../src/controllers/models/BlockAction';
import { BlocklistTerm } from '../../../src/controllers/models/BlocklistTerm';
import { BlockActionDao } from '../../../src/data/PGCatalog/BlockActionDao';
import { BlockReasonDao } from '../../../src/data/PGCatalog/BlockReasonDao';
import { BlocklistTermDao } from '../../../src/data/PGCatalog/BlocklistTermDao';
import { ProductTypeDao } from '../../../src/data/PGCatalog/ProductTypeDao';
import { BlocklistActionManager } from '../../../src/lib/BlocklistActionManager';
import { BlocklistReasonManager } from '../../../src/lib/BlocklistReasonManager';
import { ManualBlocklistManager } from '../../../src/lib/ManualBlocklistManager';
import { ProductManager } from '../../../src/lib/ProductManager';
import { ProductTypeManager } from '../../../src/lib/ProductTypeManager';
import { ModelFactory } from '../../utils/ModelFactory';
import * as client from '../../utils/client';
import { IntegrationTestSuite } from '../IntegrationTestSuite';
import '../global.spec';

describe('BlocklistActionManager - Integration', function () {
  IntegrationTestSuite.setUp(this);
  let productMan: ProductManager;
  let productTypeMan: ProductTypeManager;
  let blocklistTermDao: BlocklistTermDao;
  let blockActionDao: BlockActionDao;
  let blockReasonDao: BlockReasonDao;
  let blocklistActionManager: BlocklistActionManager;
  let blocklistReasonManager: BlocklistReasonManager;
  let manualBlocklistManager: ManualBlocklistManager;
  let productTypeDao: ProductTypeDao;
  let movieSchema: Schema;

  before(async () => {
    await CatalogService.bindAll();
  });

  beforeEach(async () => {
    productMan = new ProductManager();
    productTypeMan = new ProductTypeManager();
    blocklistTermDao = new BlocklistTermDao();
    blockActionDao = new BlockActionDao();
    blockReasonDao = new BlockReasonDao();
    blocklistActionManager = new BlocklistActionManager();
    blocklistReasonManager = new BlocklistReasonManager();
    manualBlocklistManager = new ManualBlocklistManager();
    productTypeDao = new ProductTypeDao();
    movieSchema = (await productTypeDao.findOneOrFail('movie')).jsonSchema;
  });

  afterEach(async () => {
    sinon.restore();
    await Bluebird.delay(1000);
  });

  describe('getBlocklistTerm', () => {
    it('should return a blocklist term', async () => {
      const { blocklistTermId } = await blocklistTermDao.createAndRetrieve(
        ModelFactory.blocklistTerm({
          term: 'test',
        }),
        ModelFactory.auditContext(),
      );
      const result =
        await blocklistActionManager.getBlocklistTerm(blocklistTermId);
      expect(result).not.to.be.undefined;
      expect(result.term).to.equal('test');
      expect(result.blocklistTermId).to.equal(blocklistTermId);
    });
  });

  describe('getBlocklistTerms', () => {
    it('should return a list of blocklist terms', async () => {
      const blocklistTerm1 = await blocklistTermDao.createAndRetrieve(
        ModelFactory.blocklistTerm({
          term: 'test1',
        }),
        ModelFactory.auditContext(),
      );
      const blocklistTerm2 = await blocklistTermDao.createAndRetrieve(
        ModelFactory.blocklistTerm({
          term: 'test2',
        }),
        ModelFactory.auditContext(),
      );
      const result = await blocklistActionManager.getBlocklistTerms({} as any);
      expect(result).not.to.be.undefined;
      expect(result.data).to.have.length(2);
      expect(result.data[0].term).to.equal('test1');
      expect(result.data[0].blocklistTermId).to.equal(
        blocklistTerm1.blocklistTermId,
      );
      expect(result.data[1].term).to.equal('test2');
      expect(result.data[1].blocklistTermId).to.equal(
        blocklistTerm2.blocklistTermId,
      );
    });
  });

  describe('getBlockAction', () => {
    it('should return a blocklist action', async () => {
      const { blocklistTermId } = await blocklistTermDao.createAndRetrieve(
        ModelFactory.blocklistTerm({
          term: 'test',
        }),
        ModelFactory.auditContext(),
      );
      const { blockActionId } = await blockActionDao.createAndRetrieve(
        ModelFactory.blockAction({
          action: BlockActionType.Add,
          blocklistTermIds: [+blocklistTermId],
          state: BlockActionState.Pending,
        }),
        ModelFactory.auditContext(),
      );
      const result = await blocklistActionManager.getBlockAction(blockActionId);
      expect(result).not.to.be.undefined;
      expect(result.action).to.equal(BlockActionType.Add);
      expect(result.blockActionId).to.equal(blockActionId);
      expect(result.blocklistTermIds).to.have.length(1);
      expect(+result.blocklistTermIds[0]).to.equal(+blocklistTermId);
    });
  });

  describe('getBlockActions', () => {
    it('should return a list of blocklist actions', async () => {
      const blocklistTerm1 = await blocklistTermDao.createAndRetrieve(
        ModelFactory.blocklistTerm({
          term: 'test1',
        }),
        ModelFactory.auditContext(),
      );
      const blocklistTerm2 = await blocklistTermDao.createAndRetrieve(
        ModelFactory.blocklistTerm({
          term: 'test2',
        }),
        ModelFactory.auditContext(),
      );
      const blckActn1 = await blockActionDao.createAndRetrieve(
        ModelFactory.blockAction({
          action: BlockActionType.Add,
          blocklistTermIds: [+blocklistTerm1.blocklistTermId],
          state: BlockActionState.Pending,
        }),
        ModelFactory.auditContext(),
      );
      const blockActionId1 = blckActn1.blockActionId;
      const blckActn2 = await blockActionDao.createAndRetrieve(
        ModelFactory.blockAction({
          action: BlockActionType.Add,
          blocklistTermIds: [+blocklistTerm2.blocklistTermId],
          state: BlockActionState.Pending,
        }),
        ModelFactory.auditContext(),
      );
      const blockActionId2 = blckActn2.blockActionId;
      const result = await blocklistActionManager.getBlockActions({} as any);
      expect(result).not.to.be.undefined;
      expect(result.data).to.have.length(2);
      expect(result.data[0].action).to.equal(BlockActionType.Add);
      expect(result.data[0].blockActionId).to.equal(blockActionId1);
      expect(result.data[0].blocklistTermIds).to.have.length(1);
      expect(+result.data[0].blocklistTermIds[0]).to.equal(
        +blocklistTerm1.blocklistTermId,
      );
      expect(result.data[1].action).to.equal(BlockActionType.Add);
      expect(result.data[1].blockActionId).to.equal(blockActionId2);
      expect(result.data[1].blocklistTermIds).to.have.length(1);
      expect(+result.data[1].blocklistTermIds[0]).to.equal(
        +blocklistTerm2.blocklistTermId,
      );
    });
  });

  describe('getBlockReason', () => {
    it('should return a list of blocklist reasons', async () => {
      let blocklistTerm = ModelFactory.blocklistTerm({
        term: 'testTerm',
      });
      blocklistTerm = await blocklistTermDao.createAndRetrieve(
        blocklistTerm,
        ModelFactory.auditContext(),
      );
      let blockAction = ModelFactory.blockAction({
        blocklistTermIds: [+blocklistTerm.blocklistTermId],
        state: BlockActionState.Pending,
      });
      blockAction = await blockActionDao.createAndRetrieve(
        blockAction,
        ModelFactory.auditContext(),
      );

      const { productId } = await client.createProduct(
        ModelFactory.productFromSchema(movieSchema),
      );
      let blockReason = ModelFactory.blockReason({
        blockActionId: blockAction.blockActionId,
        termId: blocklistTerm.blocklistTermId,
        term: blocklistTerm.term,
        productId,
      });

      blockReason = await blockReasonDao.createAndRetrieve(
        blockReason,
        ModelFactory.auditContext(),
      );

      const blockReasons = await blocklistReasonManager.getBlockReasons(
        {} as any,
      );
      expect(blockReasons).not.to.be.undefined;
      expect(blockReasons.data[0].blockReasonId).to.equal(
        blockReason.blockReasonId,
      );
      expect(blockReasons.data[0].blockActionId).to.equal(
        blockAction.blockActionId,
      );
      expect(blockReasons.data[0].termId).to.deep.equal(
        blocklistTerm.blocklistTermId,
      );
    });
  });

  describe('getBlockReasons', () => {
    it('should return a blocklist reason', async () => {
      let blocklistTerm = ModelFactory.blocklistTerm({
        term: 'testTerm',
      });
      blocklistTerm = await blocklistTermDao.createAndRetrieve(
        blocklistTerm,
        ModelFactory.auditContext(),
      );
      let blockAction = ModelFactory.blockAction({
        blocklistTermIds: [+blocklistTerm.blocklistTermId],
        state: BlockActionState.Pending,
      });
      blockAction = await blockActionDao.createAndRetrieve(
        blockAction,
        ModelFactory.auditContext(),
      );

      const { productId } = await client.createProduct(
        ModelFactory.productFromSchema(movieSchema),
      );
      let blockReason = ModelFactory.blockReason({
        blockActionId: blockAction.blockActionId,
        termId: blocklistTerm.blocklistTermId,
        term: blocklistTerm.term,
        productId,
      });

      blockReason = await blockReasonDao.createAndRetrieve(
        blockReason,
        ModelFactory.auditContext(),
      );

      const data = await blocklistReasonManager.getBlockReason(
        blockReason.blockReasonId,
      );

      expect(data.blockReasonId).to.equal(blockReason.blockReasonId);
      expect(data.blockActionId).to.equal(blockAction.blockActionId);
      expect(data.termId).to.deep.equal(blocklistTerm.blocklistTermId);
    });
  });

  describe('disableBlocklistTerms', () => {
    it('should disable a blocklist term', async () => {
      let blocklistTerm1 = await ModelFactory.blocklistTerm({
        term: 'testTerm1',
      });
      blocklistTerm1 = await blocklistTermDao.createAndRetrieve(
        blocklistTerm1,
        ModelFactory.auditContext(),
      );

      let blocklistTerm2 = await ModelFactory.blocklistTerm({
        term: 'testTerm2',
      });
      blocklistTerm2 = await blocklistTermDao.createAndRetrieve(
        blocklistTerm2,
        ModelFactory.auditContext(),
      );

      const blockAction = ModelFactory.blockAction({
        blocklistTermIds: [
          +blocklistTerm1.blocklistTermId,
          +blocklistTerm2.blocklistTermId,
        ],
        action: BlockActionType.Add,
        state: BlockActionState.Pending,
      });
      await blockActionDao.createAndRetrieve(
        blockAction,
        ModelFactory.auditContext(),
      );

      await blocklistActionManager.disableBlocklistTerms(
        [+blocklistTerm1.blocklistTermId, +blocklistTerm2.blocklistTermId],
        {},
      );

      const blocklistTerm1After = await blocklistTermDao.findOneOrFail(
        blocklistTerm1.blocklistTermId,
      );
      expect(blocklistTerm1After).not.to.be.undefined;
      expect(blocklistTerm1After.enabled).to.be.false;

      const blocklistTerm2After = await blocklistTermDao.findOneOrFail(
        blocklistTerm2.blocklistTermId,
      );
      expect(blocklistTerm2After).not.to.be.undefined;
      expect(blocklistTerm2After.enabled).to.be.false;

      const resultAfterUpdate = await blockActionDao.findByQueryString({
        orderBy: 'blockActionId:asc',
      });
      const blockActionsAfterUpdate = resultAfterUpdate.data.filter(
        (blckActn) =>
          _.isEqual(blckActn.blocklistTermIds, [
            blocklistTerm1.blocklistTermId,
            blocklistTerm2.blocklistTermId,
          ]),
      );
      expect(_.isArray(blockActionsAfterUpdate)).to.be.true;
      expect(blockActionsAfterUpdate.length).to.equal(2);
      expect(blockActionsAfterUpdate[0].action).to.equal(BlockActionType.Add);
      expect(blockActionsAfterUpdate[0].blocklistTermIds).to.deep.equal([
        blocklistTerm1.blocklistTermId,
        blocklistTerm2.blocklistTermId,
      ]);
      expect(blockActionsAfterUpdate[1].action).to.equal(
        BlockActionType.Remove,
      );
      expect(blockActionsAfterUpdate[1].blocklistTermIds).to.deep.equal([
        blocklistTerm1.blocklistTermId,
        blocklistTerm2.blocklistTermId,
      ]);
      sinon.verify();
    });
    it('should process blocklist terms batch by batch', async () => {
      const termsArr = Array.from(Array(30).keys()).map(
        (i) => `blocklistTerm${i}`,
      );
      const blocklistTerms: BlocklistTerm[] = [];
      const blockActions: BlockAction[] = [];

      for (const term of termsArr) {
        let blocklistTerm = await ModelFactory.blocklistTerm({
          term,
        });
        blocklistTerm = await blocklistTermDao.createAndRetrieve(
          blocklistTerm,
          ModelFactory.auditContext(),
        );
        blocklistTerms.push(blocklistTerm);
      }
      const blockTermIds = blocklistTerms.map(
        (blocklistTerm) => blocklistTerm.blocklistTermId,
      );

      await blocklistActionManager.disableBlocklistTerms(blockTermIds, {});

      const chunks = _.chunk(blockTermIds, 20);

      for (const chunk of chunks) {
        const blockAction = await blockActionDao.findOneOrFail({
          by: {
            blocklistTermIds: chunk,
          },
        });
        blockActions.push(blockAction);
      }

      expect(blocklistTerms.length).to.equal(30);
      expect(blockActions.length).to.equal(2);
      expect(blockActions[0].blocklistTermIds).to.deep.equal(
        blockTermIds.slice(0, 20),
      );
      expect(blockActions[1].blocklistTermIds).to.deep.equal(
        blockTermIds.slice(20, 30),
      );
      expect(blockActions[1].action).to.equal(BlockActionType.Remove);
      expect(blockActions[1].action).to.equal(BlockActionType.Remove);
      sinon.verify();
    });
  });

  describe('Create Blocklist Terms', () => {
    it('should create a blocklist term', async () => {
      const productTypeGroupId = ModelFactory.fakeProductTypes;

      await blocklistActionManager.createOrUpdateBlocklistTerms(
        ['blocklistTerm1', 'blocklistTerm2'],
        productTypeGroupId,
        {},
      );

      const blocklistTerm1 = await blocklistTermDao.findOneOrFail({
        by: {
          term: 'blocklistTerm1',
        },
      });

      const blocklistTerm2 = await blocklistTermDao.findOneOrFail({
        by: {
          term: 'blocklistTerm2',
        },
      });

      const blockAction = await blockActionDao.findOneOrFail({
        by: {
          blocklistTermIds: [
            +blocklistTerm1.blocklistTermId,
            +blocklistTerm2.blocklistTermId,
          ],
        },
      });

      expect(blocklistTerm1).not.to.be.undefined;
      expect(blocklistTerm2).not.to.be.undefined;
      expect(blockAction).not.to.be.undefined;
      sinon.verify();
    });
    it('should process blocklist terms batch by batch', async () => {
      const termsArr = Array.from(Array(30).keys()).map(
        (i) => `blocklistTerm${i}`,
      );
      const blocklistTerms: BlocklistTerm[] = [];
      const blockActions: BlockAction[] = [];
      const productTypeGroupId = ModelFactory.fakeProductTypes;
      await blocklistActionManager.createOrUpdateBlocklistTerms(
        termsArr,
        productTypeGroupId,
        {},
      );
      for (const term of termsArr) {
        const blocklistTerm = await blocklistTermDao.findOneOrFail({
          by: {
            term: term,
          },
        });
        blocklistTerms.push(blocklistTerm);
      }

      const blockTermIds = blocklistTerms.map(
        (blocklistTerm) => blocklistTerm.blocklistTermId,
      );
      const chunks = _.chunk(blockTermIds, 20);
      for (const chunk of chunks) {
        const blockAction = await blockActionDao.findOneOrFail({
          by: {
            blocklistTermIds: chunk,
          },
        });
        blockActions.push(blockAction);
      }

      expect(blocklistTerms.length).to.equal(30);
      expect(blockActions.length).to.equal(2);
      expect(blockActions[0].blocklistTermIds).to.deep.equal(
        blockTermIds.slice(0, 20),
      );
      expect(blockActions[1].blocklistTermIds).to.deep.equal(
        blockTermIds.slice(20, 30),
      );
      expect(blockActions[1].action).to.equal(BlockActionType.Add);
      expect(blockActions[1].action).to.equal(BlockActionType.Add);
      sinon.verify();
    });
  });

  describe('Update Blocklist Terms', () => {
    it('should update a blocklist term', async () => {
      const productTypeGroupId = ModelFactory.fakeProductTypes;

      let blocklistTerm1 = await blocklistTermDao.createAndRetrieve(
        ModelFactory.blocklistTerm({
          term: 'testTerm1',
          enabled: false,
          productTypeGroupId,
        }),
        ModelFactory.auditContext(),
      );

      let blocklistTerm2 = await blocklistTermDao.createAndRetrieve(
        ModelFactory.blocklistTerm({
          term: 'testTerm2',
          enabled: false,
          productTypeGroupId,
        }),
        ModelFactory.auditContext(),
      );

      const { blockActionId } = await blockActionDao.createAndRetrieve(
        ModelFactory.blockAction({
          blocklistTermIds: [
            +blocklistTerm1.blocklistTermId,
            +blocklistTerm2.blocklistTermId,
          ],
          action: BlockActionType.Remove,
          state: BlockActionState.Pending,
        }),
        ModelFactory.auditContext(),
      );

      await blocklistActionManager.createOrUpdateBlocklistTerms(
        ['testTerm1', 'testTerm2Updated'],
        productTypeGroupId,
        {},
      );

      blocklistTerm1 = await blocklistTermDao.findOneOrFail(
        blocklistTerm1.blocklistTermId,
      );
      blocklistTerm2 = await blocklistTermDao.findOneOrFail(
        blocklistTerm2.blocklistTermId,
      );
      const blocklistTerm3 = await blocklistTermDao.findOneOrFail({
        by: {
          term: 'testTerm2Updated',
        },
      });
      const blockAction = await blockActionDao.findOneOrFail(blockActionId);
      const blockAction2 = await blockActionDao.findOneOrFail({
        by: {
          blocklistTermIds: [
            +blocklistTerm1.blocklistTermId,
            +blocklistTerm3.blocklistTermId,
          ],
        },
      });

      expect(blocklistTerm1).not.to.be.undefined;
      expect(blocklistTerm1.enabled).to.be.true;
      expect(blocklistTerm2).not.to.be.undefined;
      expect(blocklistTerm2.enabled).to.be.false;
      expect(blocklistTerm3).not.to.be.undefined;
      expect(blocklistTerm3.enabled).to.be.true;
      expect(blockAction).not.to.be.undefined;
      expect(blockAction.action).to.equal(BlockActionType.Remove);
      expect(blockAction.blocklistTermIds).to.deep.equal([
        blocklistTerm1.blocklistTermId,
        blocklistTerm2.blocklistTermId,
      ]);
      expect(blockAction2).not.to.be.undefined;
      expect(blockAction2.action).to.equal(BlockActionType.Add);
      expect(blockAction2.blocklistTermIds).to.deep.equal([
        blocklistTerm1.blocklistTermId,
        blocklistTerm3.blocklistTermId,
      ]);
      sinon.verify();
    });
  });
});

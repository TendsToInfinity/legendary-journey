import { CorpJwt } from '@securustablets/libraries.httpsecurity';
import { _ } from '@securustablets/libraries.utils';
import { assert, expect } from 'chai';
import { Exception } from 'securus.tablets.libraries.exceptions';
import * as sinon from 'sinon';
import {
  BlockActionBy,
  BlockActionState,
  BlockActionType,
} from '../../../src/controllers/models/BlockAction';
import { BlocklistActionManager } from '../../../src/lib/BlocklistActionManager';
import { MessagingConstants } from '../../../src/messaging/MessagingConstants';
import { ModelFactory } from '../../utils/ModelFactory';

describe('BlocklistActionManager - unit', () => {
  let manager: BlocklistActionManager;
  let mockBlockActionDao: sinon.SinonMock;
  let mockBlocklistTermDao: sinon.SinonMock;
  let mockMessagingManager: sinon.SinonMock;

  beforeEach(() => {
    manager = new BlocklistActionManager();
    mockBlockActionDao = sinon.mock((manager as any).blockActionDao);
    mockBlocklistTermDao = sinon.mock((manager as any).blocklistTermDao);
    mockMessagingManager = sinon.mock((manager as any).messagingManager);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('disableBlocklistTerms', () => {
    it('should disable the blocklist term', async () => {
      const productTypeGroupId = ModelFactory.fakeProductTypes;
      const blocklistTerms = [
        ModelFactory.blocklistTerm({
          blocklistTermId: 1,
          enabled: false,
          term: 'foo',
          productTypeGroupId,
        }),
        ModelFactory.blocklistTerm({
          blocklistTermId: 2,
          enabled: false,
          term: 'bar',
          productTypeGroupId,
        }),
        ModelFactory.blocklistTerm({
          blocklistTermId: 3,
          enabled: false,
          term: 'test',
          productTypeGroupId,
        }),
      ];

      // disableBlocklistTerms call
      const blocklistTermIds = blocklistTerms.map(
        (blocklistTerm) => blocklistTerm.blocklistTermId,
      );
      mockBlocklistTermDao
        .expects('setTermsStatus')
        .once()
        .withArgs(blocklistTermIds, false)
        .resolves(blocklistTerms);

      // enqueueDeleteBlocklistAction call
      const blockAction = ModelFactory.blockAction({
        action: BlockActionType.Remove,
        type: BlockActionBy.Terms,
        blocklistTermIds,
        state: BlockActionState.Pending,
      });
      mockBlockActionDao
        .expects('createAndRetrieve')
        .withExactArgs(blockAction, {
          corpJwt: {
            username: 'test',
          } as CorpJwt,
        })
        .resolves(_.mergeWith(_.clone(blockAction), { blockActionId: 1 }));

      // publishBlocklistAction call
      mockMessagingManager
        .expects('publish')
        .once()
        .withArgs(
          MessagingConstants.PUBLICATION_ID,
          MessagingConstants.BLOCK_ACTION_PENDING_ROUTING_KEY,
          sinon.match.any,
        )
        .resolves();
      mockMessagingManager
        .expects('publish')
        .once()
        .withArgs(
          MessagingConstants.PUBLICATION_ID,
          MessagingConstants.BLOCK_ACTION_LEGACY_ROUTING_KEY,
          sinon.match.any,
        )
        .resolves();

      const blocklistTermsResult = await manager.disableBlocklistTerms(
        blocklistTermIds,
        {
          corpJwt: {
            username: 'test',
          } as CorpJwt,
        },
      );

      expect(blocklistTermsResult).to.deep.equal(blocklistTerms);
    });
    it('should handle blocklist api service error', async () => {
      const productTypeGroupId = ModelFactory.fakeProductTypes;
      const blocklistTerms = [
        ModelFactory.blocklistTerm({
          blocklistTermId: 1,
          term: 'foo',
          productTypeGroupId,
        }),
        ModelFactory.blocklistTerm({
          blocklistTermId: 2,
          term: 'bar',
          productTypeGroupId,
        }),
        ModelFactory.blocklistTerm({
          blocklistTermId: 3,
          term: 'test',
          productTypeGroupId,
        }),
      ];

      const blocklistTermIds = blocklistTerms.map(
        (blocklistTerm) => blocklistTerm.blocklistTermId,
      );
      mockBlocklistTermDao
        .expects('setTermsStatus')
        .once()
        .withArgs(blocklistTermIds, false)
        .resolves(blocklistTerms);

      const blockAction = ModelFactory.blockAction({
        action: BlockActionType.Remove,
        type: BlockActionBy.Terms,
        blocklistTermIds,
        state: BlockActionState.Pending,
      });
      mockBlockActionDao
        .expects('createAndRetrieve')
        .withExactArgs(blockAction, {
          corpJwt: {
            username: 'test',
          } as CorpJwt,
        })
        .resolves(_.mergeWith(_.clone(blockAction), { blockActionId: 1 }));

      mockMessagingManager
        .expects('publish')
        .once()
        .withArgs(
          MessagingConstants.PUBLICATION_ID,
          MessagingConstants.BLOCK_ACTION_PENDING_ROUTING_KEY,
          sinon.match.any,
        )
        .rejects(Exception.InternalError('failed to publish'));

      try {
        await manager.disableBlocklistTerms(blocklistTermIds, {
          corpJwt: {
            username: 'test',
          } as CorpJwt,
        });
        assert.fail(`test`);
      } catch (err) {
        expect(err.name).to.equal(Exception.InternalError.name);
      }
      sinon.verify();
    });
  });
  describe('createOrUpdateBlocklistTerms', () => {
    it('should create a new blocklist term', async () => {
      const productTypeGroupId = ModelFactory.fakeProductTypes;
      const term1 = ModelFactory.blocklistTerm({
        term: 'foo',
        enabled: true,
        productTypeGroupId,
      });
      const term2 = ModelFactory.blocklistTerm({
        term: 'bar',
        enabled: true,
        productTypeGroupId,
      });
      const newBlockTerm = [term1, term2];

      mockBlocklistTermDao
        .expects('findByTerms')
        .once()
        .withArgs(['foo', 'bar'], productTypeGroupId)
        .resolves([]);
      mockBlocklistTermDao
        .expects('createAndRetrieve')
        .withExactArgs(newBlockTerm[0], {
          corpJwt: {
            username: 'test',
          } as CorpJwt,
        })
        .resolves(
          _.mergeWith(_.clone(newBlockTerm[0]), { blocklistTermId: 1 }),
        );
      mockBlocklistTermDao
        .expects('createAndRetrieve')
        .withExactArgs(newBlockTerm[1], {
          corpJwt: {
            username: 'test',
          } as CorpJwt,
        })
        .resolves(
          _.mergeWith(_.clone(newBlockTerm[1]), { blocklistTermId: 2 }),
        );
      const blockAction = ModelFactory.blockAction({
        blocklistTermIds: [1, 2],
        type: BlockActionBy.Terms,
        action: BlockActionType.Add,
        state: BlockActionState.Pending,
      });
      mockBlockActionDao
        .expects('createAndRetrieve')
        .withExactArgs(blockAction, {
          corpJwt: {
            username: 'test',
          } as CorpJwt,
        })
        .resolves(_.mergeWith(_.clone(blockAction), { blockActionId: 1 }));
      const _blocklistTerms = [_.clone(term1), _.clone(term2)];
      _blocklistTerms[0].blocklistTermId = 1;
      _blocklistTerms[1].blocklistTermId = 2;
      mockMessagingManager
        .expects('publish')
        .once()
        .withArgs(
          MessagingConstants.PUBLICATION_ID,
          MessagingConstants.BLOCK_ACTION_PENDING_ROUTING_KEY,
          sinon.match.any,
        )
        .resolves();
      // check if have blocklistTerms in legacy message
      const legacyMessage = {
        ...blockAction,
        blocklistTerms: _blocklistTerms,
        blockActionId: sinon.match.any,
      };
      mockMessagingManager
        .expects('publish')
        .once()
        .withArgs(
          MessagingConstants.PUBLICATION_ID,
          MessagingConstants.BLOCK_ACTION_LEGACY_ROUTING_KEY,
          legacyMessage,
        )
        .resolves();
      await manager.createOrUpdateBlocklistTerms(
        ['foo', 'bar'],
        productTypeGroupId,
        {
          corpJwt: {
            username: 'test',
          } as CorpJwt,
        },
      );
      sinon.verify();
    });
    it('should upsert blocklist term', async () => {
      const productTypeGroupId = ModelFactory.fakeProductTypes;
      const existingTerms = [
        ModelFactory.blocklistTerm({
          blocklistTermId: 1,
          term: 'foo',
          enabled: true,
          productTypeGroupId,
        }),
        ModelFactory.blocklistTerm({
          blocklistTermId: 2,
          term: 'bar',
          enabled: false,
          productTypeGroupId,
        }),
      ];
      const newBlockTerm = [
        ModelFactory.blocklistTerm({
          term: 'bar',
          enabled: true,
          productTypeGroupId,
        }),
        ModelFactory.blocklistTerm({
          term: 'sui',
          enabled: true,
          productTypeGroupId,
        }),
      ];

      mockBlocklistTermDao
        .expects('findByTerms')
        .once()
        .withArgs(['bar', 'sui'], productTypeGroupId)
        .resolves([existingTerms[1]]); // bar
      mockBlocklistTermDao
        .expects('setTermsStatus')
        .once()
        .withArgs([existingTerms[1].blocklistTermId], true)
        .resolves([existingTerms[1]]);
      mockBlocklistTermDao
        .expects('createAndRetrieve')
        .once()
        .withArgs(newBlockTerm[1], {
          corpJwt: {
            username: 'test',
          } as CorpJwt,
        })
        .resolves(
          _.mergeWith(_.clone(newBlockTerm[1]), { blocklistTermId: 3 }),
        );
      const blockAction = ModelFactory.blockAction({
        blocklistTermIds: [2, 3],
        type: BlockActionBy.Terms,
        action: BlockActionType.Add,
        state: BlockActionState.Pending,
      });
      mockBlockActionDao
        .expects('createAndRetrieve')
        .withExactArgs(blockAction, {
          corpJwt: {
            username: 'test',
          } as CorpJwt,
        })
        .resolves(_.mergeWith(_.clone(blockAction), { blockActionId: 1 }));
      const _blocklistTerms = [
        _.clone(existingTerms[1]),
        _.clone(newBlockTerm[1]),
      ];
      _blocklistTerms[0].blocklistTermId = 2;
      _blocklistTerms[1].blocklistTermId = 3;
      mockMessagingManager
        .expects('publish')
        .once()
        .withArgs(
          MessagingConstants.PUBLICATION_ID,
          MessagingConstants.BLOCK_ACTION_PENDING_ROUTING_KEY,
          sinon.match.any,
        )
        .resolves({});
      mockMessagingManager
        .expects('publish')
        .once()
        .withArgs(
          MessagingConstants.PUBLICATION_ID,
          MessagingConstants.BLOCK_ACTION_LEGACY_ROUTING_KEY,
          sinon.match.any,
        )
        .resolves();
      await manager.createOrUpdateBlocklistTerms(
        ['bar', 'sui'],
        productTypeGroupId,
        {
          corpJwt: {
            username: 'test',
          } as CorpJwt,
        },
      );
      sinon.verify();
    });
    it('should upsert only existing blocklist term', async () => {
      const productTypeGroupId = ModelFactory.fakeProductTypes;
      const existingTerms = [
        ModelFactory.blocklistTerm({
          blocklistTermId: 1,
          term: 'foo',
          enabled: true,
          productTypeGroupId,
        }),
        ModelFactory.blocklistTerm({
          blocklistTermId: 2,
          term: 'bar',
          enabled: false,
          productTypeGroupId,
        }),
      ];

      mockBlocklistTermDao
        .expects('findByTerms')
        .once()
        .withArgs(['bar'], productTypeGroupId)
        .resolves([existingTerms[1]]);
      mockBlocklistTermDao
        .expects('setTermsStatus')
        .once()
        .withArgs([existingTerms[1].blocklistTermId], true)
        .resolves([existingTerms[1]]);
      const blockAction = ModelFactory.blockAction({
        blocklistTermIds: [2],
        type: BlockActionBy.Terms,
        action: BlockActionType.Add,
        state: BlockActionState.Pending,
      });
      mockBlockActionDao
        .expects('createAndRetrieve')
        .withExactArgs(blockAction, {
          corpJwt: {
            username: 'test',
          } as CorpJwt,
        })
        .resolves(_.mergeWith(_.clone(blockAction), { blockActionId: 1 }));
      mockMessagingManager
        .expects('publish')
        .once()
        .withArgs(
          MessagingConstants.PUBLICATION_ID,
          MessagingConstants.BLOCK_ACTION_PENDING_ROUTING_KEY,
          sinon.match.any,
        )
        .resolves({});
      mockMessagingManager
        .expects('publish')
        .once()
        .withArgs(
          MessagingConstants.PUBLICATION_ID,
          MessagingConstants.BLOCK_ACTION_LEGACY_ROUTING_KEY,
          sinon.match.any,
        )
        .resolves();
      await manager.createOrUpdateBlocklistTerms(['bar'], productTypeGroupId, {
        corpJwt: {
          username: 'test',
        } as CorpJwt,
      });
      sinon.verify();
    });
    it('should handle blocklist api service error', async () => {
      const productTypeGroupId = ModelFactory.fakeProductTypes;
      const term1 = ModelFactory.blocklistTerm({
        term: 'foo',
        enabled: true,
        productTypeGroupId,
      });
      const term2 = ModelFactory.blocklistTerm({
        term: 'bar',
        enabled: true,
        productTypeGroupId,
      });
      const newBlockTerm = [term1, term2];

      mockBlocklistTermDao
        .expects('findByTerms')
        .once()
        .withArgs(['foo', 'bar'], productTypeGroupId)
        .resolves([]);
      mockBlocklistTermDao
        .expects('createAndRetrieve')
        .withExactArgs(newBlockTerm[0], {
          corpJwt: {
            username: 'test',
          } as CorpJwt,
        })
        .resolves(
          _.mergeWith(_.clone(newBlockTerm[0]), { blocklistTermId: 1 }),
        );
      mockBlocklistTermDao
        .expects('createAndRetrieve')
        .withExactArgs(newBlockTerm[1], {
          corpJwt: {
            username: 'test',
          } as CorpJwt,
        })
        .resolves(
          _.mergeWith(_.clone(newBlockTerm[1]), { blocklistTermId: 2 }),
        );
      const blockAction = ModelFactory.blockAction({
        blocklistTermIds: [1, 2],
        type: BlockActionBy.Terms,
        action: BlockActionType.Add,
        state: BlockActionState.Pending,
      });
      mockBlockActionDao
        .expects('createAndRetrieve')
        .withExactArgs(blockAction, {
          corpJwt: {
            username: 'test',
          } as CorpJwt,
        })
        .resolves(_.mergeWith(_.clone(blockAction), { blockActionId: 1 }));
      const _blocklistTerms = [_.clone(term1), _.clone(term2)];
      _blocklistTerms[0].blocklistTermId = 1;
      _blocklistTerms[1].blocklistTermId = 2;
      mockMessagingManager
        .expects('publish')
        .once()
        .withArgs(
          MessagingConstants.PUBLICATION_ID,
          MessagingConstants.BLOCK_ACTION_PENDING_ROUTING_KEY,
          sinon.match.any,
        )
        .rejects(Exception.InternalError('test'));
      try {
        await manager.createOrUpdateBlocklistTerms(
          ['foo', 'bar'],
          productTypeGroupId,
          {
            corpJwt: {
              username: 'test',
            } as CorpJwt,
          },
        );
        assert.fail('test');
      } catch (err) {
        expect(err.name).to.equal(Exception.InternalError.name);
      }
      sinon.verify();
    });
    it('should skip already applied terms while creating block action', async () => {
      const productTypeGroupId = ModelFactory.fakeProductTypes;
      const existingTerms = [
        ModelFactory.blocklistTerm({
          blocklistTermId: 1,
          term: 'baz',
          enabled: true,
          productTypeGroupId,
        }),
        ModelFactory.blocklistTerm({
          blocklistTermId: 2,
          term: 'bar',
          enabled: false,
          productTypeGroupId,
        }),
      ];
      mockBlocklistTermDao
        .expects('findByTerms')
        .once()
        .withArgs(['bar', 'baz'], productTypeGroupId)
        .resolves(existingTerms);
      mockBlocklistTermDao
        .expects('setTermsStatus')
        .once()
        .withArgs([existingTerms[1].blocklistTermId], true)
        .resolves([existingTerms[1]]);
      const blockAction = ModelFactory.blockAction({
        blocklistTermIds: [2],
        type: BlockActionBy.Terms,
        action: BlockActionType.Add,
        state: BlockActionState.Pending,
      });
      mockBlockActionDao
        .expects('createAndRetrieve')
        .withExactArgs(blockAction, {
          corpJwt: {
            username: 'test',
          } as CorpJwt,
        })
        .resolves(_.mergeWith(_.clone(blockAction), { blockActionId: 1 }));
      mockMessagingManager
        .expects('publish')
        .once()
        .withArgs(
          MessagingConstants.PUBLICATION_ID,
          MessagingConstants.BLOCK_ACTION_PENDING_ROUTING_KEY,
          sinon.match.any,
        )
        .resolves({});
      mockMessagingManager
        .expects('publish')
        .once()
        .withArgs(
          MessagingConstants.PUBLICATION_ID,
          MessagingConstants.BLOCK_ACTION_LEGACY_ROUTING_KEY,
          sinon.match.any,
        )
        .resolves({});

      await manager.createOrUpdateBlocklistTerms(
        ['bar', 'baz'],
        productTypeGroupId,
        {
          corpJwt: {
            username: 'test',
          } as CorpJwt,
        },
      );
      sinon.verify();
    });
  });

  describe('publishBlocklistAction', () => {
    it('should publish legacy data only if provided', async () => {
      const blockAction = ModelFactory.blockAction();
      mockMessagingManager
        .expects('publish')
        .once()
        .withArgs(
          MessagingConstants.PUBLICATION_ID,
          MessagingConstants.BLOCK_ACTION_PENDING_ROUTING_KEY,
          blockAction,
        )
        .resolves();

      mockMessagingManager
        .expects('publish')
        .withArgs(
          MessagingConstants.PUBLICATION_ID,
          MessagingConstants.BLOCK_ACTION_LEGACY_ROUTING_KEY,
          sinon.match.any,
        )
        .never();

      await manager.publishBlocklistAction(blockAction);
    });
  });
});

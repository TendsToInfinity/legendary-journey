import { expect } from 'chai';
import * as sinon from 'sinon';
import { LargeImpactEventState } from '../../../src/controllers/models/LargeImpactEvent';
import { MessagingConstants } from '../../../src/messaging/MessagingConstants';
import { ModelFactory } from '../../utils/ModelFactory';
import { LargeImpactEventManager } from './../../../src/lib/LargeImpactEventManager';

describe('LargeImpactEventManager - Unit', () => {
  const sandbox = sinon.createSandbox();
  let manager: LargeImpactEventManager;
  let mockDao: sinon.SinonMock;
  let mockMessagingManager: sinon.SinonMock;
  let mockLogger: sinon.SinonMock;
  beforeEach(() => {
    manager = new LargeImpactEventManager();
    mockDao = sandbox.mock((manager as any).lieDao);
    mockMessagingManager = sandbox.mock((manager as any).messagingManager);
    mockLogger = sandbox.mock((manager as any).logger);
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('createAndPublish', () => {
    it('should create LIE, publish and retrieve it', async () => {
      const lie = ModelFactory.largeImpactEvent({ largeImpactEventId: 1 });
      const routingKey = lie.routingKey;
      mockDao
        .expects('createAndRetrieve')
        .withExactArgs(lie, { routingKey })
        .resolves(lie);

      mockMessagingManager
        .expects('publish')
        .once()
        .withArgs(
          MessagingConstants.PUBLICATION_ID,
          MessagingConstants.LARGE_IMPACT_EVENT_PENDING_ROUTING_KEY,
          lie,
        )
        .resolves();

      const result = await manager.createAndPublish(lie, { routingKey });

      expect(result).to.deep.equal(lie);
      sinon.verify();
    });

    it('should not publish LIE if if not created ', async () => {
      const lie = ModelFactory.largeImpactEvent({ largeImpactEventId: 1 });
      const routingKey = lie.routingKey;
      mockDao
        .expects('createAndRetrieve')
        .withExactArgs(lie, { routingKey })
        .resolves(undefined);

      mockMessagingManager.expects('publish').never();

      const result = await manager.createAndPublish(lie, { routingKey });

      expect(result).to.deep.equal(undefined);
      sinon.verify();
    });
  });

  describe('updateAndPublish', () => {
    it('should update LIE, publish and retrieve it', async () => {
      const lie = ModelFactory.largeImpactEvent({ largeImpactEventId: 1 });
      const routingKey = lie.routingKey;
      mockDao
        .expects('updateAndRetrieve')
        .withExactArgs(1, lie, { routingKey })
        .resolves(lie);

      mockMessagingManager
        .expects('publish')
        .once()
        .withArgs(
          MessagingConstants.PUBLICATION_ID,
          MessagingConstants.LARGE_IMPACT_EVENT_PENDING_ROUTING_KEY,
          lie,
        )
        .resolves();

      const result = await manager.updateAndPublish(lie, { routingKey });

      expect(result).to.deep.equal(lie);
      sinon.verify();
    });

    it('should not publish LIE if if not updated ', async () => {
      const lie = ModelFactory.largeImpactEvent({ largeImpactEventId: 1 });
      const routingKey = lie.routingKey;
      mockDao
        .expects('updateAndRetrieve')
        .withExactArgs(1, lie, { routingKey })
        .resolves(undefined);

      mockMessagingManager.expects('publish').never();

      const result = await manager.updateAndPublish(lie, { routingKey });

      expect(result).to.deep.equal(undefined);
      sinon.verify();
    });
  });

  describe('updatePendingToProcessingAndPublish', () => {
    it('should update LIE to processing, publish and retrieve it', async () => {
      const lie = ModelFactory.largeImpactEvent({ largeImpactEventId: 1 });
      const routingKey = lie.routingKey;
      mockDao
        .expects('retrieveProcessableEvent')
        .withExactArgs(routingKey)
        .resolves(lie);

      mockMessagingManager
        .expects('publish')
        .once()
        .withArgs(
          MessagingConstants.PUBLICATION_ID,
          MessagingConstants.LARGE_IMPACT_EVENT_PROCESSING_ROUTING_KEY,
          lie,
        )
        .resolves();

      const result = await manager.updatePendingToProcessingAndPublish(lie);

      expect(result).to.deep.equal(lie);
      sinon.verify();
    });

    it('should not publish LIE if if not created ', async () => {
      const lie = ModelFactory.largeImpactEvent({ largeImpactEventId: 1 });
      const routingKey = lie.routingKey;
      mockDao
        .expects('retrieveProcessableEvent')
        .withExactArgs(routingKey)
        .resolves(undefined);

      mockMessagingManager.expects('publish').never();

      const result = await manager.updatePendingToProcessingAndPublish(lie);

      expect(result).to.deep.equal(undefined);
      sinon.verify();
    });
  });

  describe('processingAndUpdateToComplete', () => {
    it('should process LIE, update to complete and retrieve it', async () => {
      const lie = ModelFactory.largeImpactEvent({ largeImpactEventId: 1 });
      const routingKey = lie.routingKey;
      mockDao
        .expects('updateAndRetrieve')
        .withExactArgs(
          lie.largeImpactEventId,
          { state: LargeImpactEventState.Complete },
          { routingKey },
        )
        .resolves(lie);

      mockLogger
        .expects('info')
        .withExactArgs(`LIE completed ${JSON.stringify(lie)}`);
      mockMessagingManager
        .expects('publish')
        .once()
        .withArgs(
          MessagingConstants.PUBLICATION_ID,
          MessagingConstants.LARGE_IMPACT_EVENT_COMPLETE_ROUTING_KEY,
          lie,
        )
        .resolves();

      const result = await manager.processingAndUpdateToComplete(lie, {
        routingKey,
      });

      expect(result).to.deep.equal(lie);
      sinon.verify();
    });

    it('should not publish LIE if if not created ', async () => {
      const lie = ModelFactory.largeImpactEvent({ largeImpactEventId: 1 });
      const routingKey = lie.routingKey;
      mockDao
        .expects('updateAndRetrieve')
        .withExactArgs(
          lie.largeImpactEventId,
          { state: LargeImpactEventState.Complete },
          { routingKey },
        )
        .resolves(undefined);

      mockMessagingManager.expects('publish').never();

      const result = await manager.processingAndUpdateToComplete(lie, {
        routingKey,
      });

      expect(result).to.deep.equal(undefined);
      sinon.verify();
    });
  });
});

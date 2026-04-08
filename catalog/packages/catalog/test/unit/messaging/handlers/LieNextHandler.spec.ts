import { expect } from 'chai';
import * as sinon from 'sinon';
import { MessagingConstants } from '../../../../src/messaging/MessagingConstants';
import { LieNextHandler } from '../../../../src/messaging/handlers/LieNextHandler';
import { ModelFactory } from '../../../utils/ModelFactory';

describe('LieNextHandler - Unit', () => {
  let lieHandler: LieNextHandler;
  let mockLieManager: sinon.SinonMock;
  let mockLogger: sinon.SinonMock;

  beforeEach(() => {
    lieHandler = new LieNextHandler();
    mockLieManager = sinon.mock((lieHandler as any).lieManager);
    mockLogger = sinon.mock((lieHandler as any).log);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('handleMessage', () => {
    it('should call updatePendingToProcessingAndPublish with exact parameters', async () => {
      const routingKey =
        MessagingConstants.LARGE_IMPACT_EVENT_PENDING_ROUTING_KEY;
      const payload = JSON.stringify({ test: 'test' });
      const lieItem = ModelFactory.largeImpactEvent({
        routingKey,
        payload,
      });

      mockLieManager
        .expects('updatePendingToProcessingAndPublish')
        .withExactArgs(lieItem)
        .resolves(lieItem);
      mockLogger.expects('error').never();
      await lieHandler.handleMessage(routingKey, lieItem);

      sinon.verify();
    });

    it('should log information for debug', async () => {
      const routingKey =
        MessagingConstants.LARGE_IMPACT_EVENT_PENDING_ROUTING_KEY;
      const payload = JSON.stringify({ test: 'test' });
      const lieItem = ModelFactory.largeImpactEvent({
        routingKey,
        payload,
      });

      mockLieManager
        .expects('updatePendingToProcessingAndPublish')
        .withExactArgs(lieItem)
        .throws(Error('Error'));

      mockLogger.expects('error').once();

      try {
        await lieHandler.handleMessage(routingKey, lieItem);
        expect.fail();
      } catch (ex) {
        expect(ex.message).to.contain('Error');
      }
      sinon.verify();
    });
  });
});

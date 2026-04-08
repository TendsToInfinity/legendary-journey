import { expect } from 'chai';
import * as sinon from 'sinon';
import {
  LargeImpactEvent,
  LargeImpactEventState,
} from '../../../../src/controllers/models/LargeImpactEvent';
import { LieHandler } from '../../../../src/messaging/handlers/LieHandler';
import { ModelFactory } from '../../../utils/ModelFactory';

describe('LieHandler - Unit', () => {
  let lieHandler: LieHandler;
  let mockLieManager: sinon.SinonMock;
  let mockLogger: sinon.SinonMock;

  beforeEach(() => {
    lieHandler = new LieHandler();
    mockLieManager = sinon.mock((lieHandler as any).lieManager);
    mockLogger = sinon.mock((lieHandler as any).log);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('handleMessage', () => {
    it('should call createAndPublish with exact parameters', async () => {
      const routingKey = 'dpv.123.updated';
      const payload = { test: 'test' };
      const lieItem = {
        routingKey,
        payload: payload,
        state: LargeImpactEventState.Pending,
      } as LargeImpactEvent;

      const lieItemResolved = ModelFactory.largeImpactEvent({
        routingKey,
        payload: payload,
      });

      mockLieManager
        .expects('createAndPublish')
        .withExactArgs(lieItem, { routingKey })
        .resolves(lieItemResolved);
      mockLogger.expects('error').never();
      await lieHandler.handleMessage(routingKey, payload);

      sinon.verify();
    });

    it('should log information for debug', async () => {
      const routingKey = 'dpv.123.updated';
      const payload = { test: 'test' };
      const lieItem = {
        routingKey,
        payload: payload,
        state: LargeImpactEventState.Pending,
      } as LargeImpactEvent;

      mockLieManager
        .expects('createAndPublish')
        .withExactArgs(lieItem, { routingKey })
        .throws(Error('Error'));

      mockLogger.expects('error').once();

      try {
        await lieHandler.handleMessage(routingKey, payload);
        expect.fail();
      } catch (ex) {
        expect(ex.message).to.contain('Error');
      }
      sinon.verify();
    });
  });
});

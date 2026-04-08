import { expect } from 'chai';
import { Exception } from 'securus.tablets.libraries.exceptions';
import * as sinon from 'sinon';
import { MessagingConstants } from '../../../../src/messaging/MessagingConstants';
import { LieProcessingHandler } from '../../../../src/messaging/handlers/LieProcessingHandler';
import { ModelFactory } from '../../../utils/ModelFactory';

describe('LieProcessingHandler - Unit', () => {
  let lieHandler: LieProcessingHandler;
  let mockLieManager: sinon.SinonMock;
  let mockLogger: sinon.SinonMock;
  let blocklistLieMock: sinon.SinonMock;
  let mockDpvLie: sinon.SinonMock;

  beforeEach(() => {
    lieHandler = new LieProcessingHandler();
    mockLieManager = sinon.mock((lieHandler as any).lieManager);
    mockLogger = sinon.mock((lieHandler as any).log);
    blocklistLieMock = sinon.mock((lieHandler as any).blocklistLie);
    mockDpvLie = sinon.mock((lieHandler as any).dpvLie);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('handleMessage', () => {
    it('should call processingAndUpdateToComplete with exact parameters', async () => {
      const routingKey =
        MessagingConstants.LARGE_IMPACT_EVENT_PROCESSING_ROUTING_KEY;
      const payload = ModelFactory.distinctProductValue();
      const payloadRoutingKey = `dpv.${payload.productTypeGroupId}.updated`;
      const lieItem = ModelFactory.largeImpactEvent({
        routingKey: payloadRoutingKey,
        payload,
      });
      mockLogger
        .expects('info')
        .withExactArgs(`LIE processing ${JSON.stringify(lieItem)}`);
      mockDpvLie.expects('dpvProcessHandler').withExactArgs(payload).resolves();
      mockLieManager
        .expects('processingAndUpdateToComplete')
        .withExactArgs(lieItem, { routingKey })
        .resolves(lieItem);
      mockLogger.expects('error').never();

      await lieHandler.handleMessage(routingKey, lieItem);

      sinon.verify();
    });

    it('should log information for debug', async () => {
      const routingKey =
        MessagingConstants.LARGE_IMPACT_EVENT_PROCESSING_ROUTING_KEY;
      const payload = ModelFactory.distinctProductValue();
      const payloadRoutingKey = `dpv.${payload.productTypeGroupId}.updated`;
      const lieItem = ModelFactory.largeImpactEvent({
        routingKey: payloadRoutingKey,
        payload,
      });

      mockLogger
        .expects('info')
        .withExactArgs(`LIE processing ${JSON.stringify(lieItem)}`);
      mockDpvLie.expects('dpvProcessHandler').withExactArgs(payload).once();
      mockLieManager
        .expects('processingAndUpdateToComplete')
        .withExactArgs(lieItem, { routingKey })
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
    it('should not log information for debug if 404 and test environment', async () => {
      const routingKey =
        MessagingConstants.LARGE_IMPACT_EVENT_PROCESSING_ROUTING_KEY;
      const payload = ModelFactory.distinctProductValue();
      const payloadRoutingKey = `dpv.${payload.productTypeGroupId}.updated`;
      const lieItem = ModelFactory.largeImpactEvent({
        routingKey: payloadRoutingKey,
        payload,
      });

      mockLogger
        .expects('info')
        .withExactArgs(`LIE processing ${JSON.stringify(lieItem)}`);
      mockDpvLie.expects('dpvProcessHandler').withExactArgs(payload).once();
      mockLieManager
        .expects('processingAndUpdateToComplete')
        .withExactArgs(lieItem, { routingKey })
        .throws(Exception.NotFound());
      mockLogger.expects('error').never();

      await lieHandler.handleMessage(routingKey, lieItem);
      sinon.verify();
    });
    it('should log information for debug if 404 and not test environment', async () => {
      const routingKey =
        MessagingConstants.LARGE_IMPACT_EVENT_PROCESSING_ROUTING_KEY;
      const payload = ModelFactory.distinctProductValue();
      const payloadRoutingKey = `dpv.${payload.productTypeGroupId}.updated`;
      const lieItem = ModelFactory.largeImpactEvent({
        routingKey: payloadRoutingKey,
        payload,
      });

      mockLogger
        .expects('info')
        .withExactArgs(`LIE processing ${JSON.stringify(lieItem)}`);
      mockDpvLie.expects('dpvProcessHandler').withExactArgs(payload).once();
      mockLieManager
        .expects('processingAndUpdateToComplete')
        .withExactArgs(lieItem, { routingKey })
        .throws(Exception.NotFound());
      const configMock = sinon.mock((lieHandler as any).config);
      configMock.expects('get').withExactArgs('allowTestApis').returns(false);
      mockLogger.expects('error').once();

      try {
        await lieHandler.handleMessage(routingKey, lieItem);
        expect.fail();
      } catch (ex) {
        expect(ex.code).to.equal(404);
      }
      sinon.verify();
    });
    it("ends the LIE if it doesn't match anything", async () => {
      const routingKey =
        MessagingConstants.LARGE_IMPACT_EVENT_PROCESSING_ROUTING_KEY;
      const lieItem = ModelFactory.largeImpactEvent({
        routingKey: 'not a valid routing key',
        payload: { anything: 'can go here' },
      });

      mockLogger
        .expects('info')
        .withExactArgs(`LIE processing ${JSON.stringify(lieItem)}`);
      mockDpvLie.expects('dpvProcessHandler').never();
      blocklistLieMock.expects('blockActionProcessHandler').never();
      mockLieManager
        .expects('processingAndUpdateToComplete')
        .withExactArgs(lieItem, { routingKey })
        .resolves(lieItem);
      mockLogger.expects('error').never();

      await lieHandler.handleMessage(routingKey, lieItem);

      sinon.verify();
    });

    describe('blocklist handling', () => {
      it('routes blockactions to the blocklistLie', async () => {
        const routingKey =
          MessagingConstants.LARGE_IMPACT_EVENT_PROCESSING_ROUTING_KEY;
        const payload = ModelFactory.blockAction();
        const payloadRoutingKey =
          MessagingConstants.BLOCK_ACTION_PENDING_ROUTING_KEY;
        const lieItem = ModelFactory.largeImpactEvent({
          routingKey: payloadRoutingKey,
          payload,
        });

        mockLogger
          .expects('info')
          .withExactArgs(`LIE processing ${JSON.stringify(lieItem)}`);
        blocklistLieMock
          .expects('blockActionProcessHandler')
          .withExactArgs(payloadRoutingKey, payload)
          .resolves();
        mockLieManager
          .expects('processingAndUpdateToComplete')
          .withExactArgs(lieItem, { routingKey })
          .resolves(lieItem);
        mockLogger.expects('error').never();

        await lieHandler.handleMessage(routingKey, lieItem);

        sinon.verify();
      });
    });
  });
});

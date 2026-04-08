import { StandardMessagingConfigs } from '@securustablets/libraries.messaging/dist/src/StandardMessagingConfigs';
import { expect } from 'chai';
import * as sinon from 'sinon';
import { MessagingConfig } from '../../../src/messaging/MessagingConfig';
import { MessagingConstants } from '../../../src/messaging/MessagingConstants';

describe('MessagingConfig', () => {
  let messagingConfig: MessagingConfig;
  let mockLogger: sinon.SinonMock;
  let mockMessagingManager: sinon.SinonMock;
  let mockTabletServicesMessagingConfig: sinon.SinonMock;
  let mockAppConfig: sinon.SinonMock;

  beforeEach(() => {
    messagingConfig = new MessagingConfig();
    mockLogger = sinon.mock((messagingConfig as any).logger);
    mockMessagingManager = sinon.mock(
      (messagingConfig as any).messagingManager,
    );
    mockTabletServicesMessagingConfig = sinon.mock(
      StandardMessagingConfigs.tabletServices,
    );
    mockAppConfig = sinon.mock((messagingConfig as any).appConfig);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('registerAndStart()', () => {
    it('should register config and start the broker when rmq disableSubscriptions is FALSE ', async () => {
      const subscriptionStub = {
        onMessageReceived: { addHandler: sinon.stub() },
      };

      mockTabletServicesMessagingConfig.expects('register').once();
      mockLogger
        .expects('info')
        .withExactArgs('Starting messaging broker...')
        .once();
      mockMessagingManager.expects('startBroker');
      mockLogger
        .expects('info')
        .withExactArgs('Started messaging broker.')
        .once();

      mockAppConfig
        .expects('get')
        .withExactArgs('rmq')
        .returns({ disableSubscriptions: false });

      mockMessagingManager
        .expects('getSubscription')
        .withExactArgs(MessagingConstants.SUBSCRIPTION_ID)
        .returns(subscriptionStub);

      await messagingConfig.registerAndStart();

      expect(subscriptionStub.onMessageReceived.addHandler.callCount).to.equal(
        14,
      );

      mockLogger.verify();
      mockMessagingManager.verify();
      mockTabletServicesMessagingConfig.verify();
    });
    it('should call a handler ', async () => {
      const handler = {
        bindingKeys: ['*.#'],
        handleMessage: sinon.stub(),
      };
      const rk = 'test.test.test';
      const message = { some: 'test' };
      const subscriptionStub = {
        onMessageReceived: {
          addHandler: (bindingKey, handleMessage) => {
            handleMessage(rk, message);
          },
        },
      };
      (messagingConfig as any).messageHandlers = [handler];
      mockTabletServicesMessagingConfig.expects('register').once();
      mockLogger
        .expects('info')
        .withExactArgs('Starting messaging broker...')
        .once();
      mockMessagingManager.expects('startBroker');
      mockLogger
        .expects('info')
        .withExactArgs('Started messaging broker.')
        .once();
      mockAppConfig
        .expects('get')
        .withExactArgs('rmq')
        .returns({ disableSubscriptions: false });
      mockMessagingManager
        .expects('getSubscription')
        .withExactArgs(MessagingConstants.SUBSCRIPTION_ID)
        .returns(subscriptionStub);
      await messagingConfig.registerAndStart();
      expect(handler.handleMessage.calledOnceWithExactly(rk, message)).to.equal(
        true,
      );
      sinon.verify();
    });
    it('should cover the messageHandler anonymous function', async () => {
      const subscriptionStub = {
        onMessageReceived: { addHandler: sinon.stub() },
      };
      const messageHandlerStub = {
        bindingKeys: ['test'],
        handleMessage: (rk, m) => sinon.stub(),
      };
      (messagingConfig as any).messageHandlers = [messageHandlerStub];

      mockTabletServicesMessagingConfig.expects('register').once();
      mockLogger
        .expects('info')
        .withExactArgs('Starting messaging broker...')
        .once();
      mockMessagingManager.expects('startBroker');
      mockLogger
        .expects('info')
        .withExactArgs('Started messaging broker.')
        .once();

      mockAppConfig
        .expects('get')
        .withExactArgs('rmq')
        .returns({ disableSubscriptions: false });

      mockMessagingManager
        .expects('getSubscription')
        .withExactArgs(MessagingConstants.SUBSCRIPTION_ID)
        .returns(subscriptionStub);

      await messagingConfig.registerAndStart();

      // cover the damn line
      await (messagingConfig as any).messageHandlers[0].handleMessage('test', {
        foo: 'bar',
      });

      expect(subscriptionStub.onMessageReceived.addHandler.callCount).to.equal(
        1,
      );

      mockLogger.verify();
      mockMessagingManager.verify();
      mockTabletServicesMessagingConfig.verify();
    });

    it('should register config and start the broker when rmq disableSubscriptions is TRUE ', async () => {
      mockTabletServicesMessagingConfig.expects('register').once();
      mockLogger
        .expects('info')
        .withExactArgs('Starting messaging broker...')
        .once();
      mockMessagingManager.expects('startBroker');
      mockLogger
        .expects('info')
        .withExactArgs('Started messaging broker.')
        .once();

      mockAppConfig
        .expects('get')
        .withExactArgs('rmq')
        .returns({ disableSubscriptions: true });

      await messagingConfig.registerAndStart();

      mockMessagingManager.expects('getSubscription').never();

      mockLogger.verify();
      mockMessagingManager.verify();
      mockTabletServicesMessagingConfig.verify();
    });
  });

  describe('getMessagingConfig()', () => {
    it('should return only queues if disableSubscriptions is TRUE', () => {
      const disableSubscriptions = true;
      const config = (messagingConfig as any).getMessagingConfig(
        disableSubscriptions,
      );
      expect(config).to.have.all.keys('queues');
      expect(config).to.not.have.any.keys('bindings', 'subscriptions');
    });

    it('should return queues, bindings and subscriptions if disableSubscriptions is FALSE', () => {
      const disableSubscriptions = false;
      const config = (messagingConfig as any).getMessagingConfig(
        disableSubscriptions,
      );
      expect(config).to.have.all.keys('queues', 'bindings', 'subscriptions');
      expect(
        config.bindings[MessagingConstants.SUBSCRIPTION_ID].bindingKeys.length,
      ).equals(14);
    });
  });
});

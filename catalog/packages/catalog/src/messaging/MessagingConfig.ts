import { Logger } from '@securustablets/libraries.logging';
import {
  MessagingConfigProvider,
  MessagingManager,
  StandardMessagingConfigs,
} from '@securustablets/libraries.messaging';
import { _ } from '@securustablets/libraries.utils';
import { Inject, Singleton } from 'typescript-ioc';
import { AppConfig } from '../utils/AppConfig';
import { MessagingConstants } from './MessagingConstants';
import { CDNFailureHandler } from './handlers/CDNFailureHandler';
import { FutureProductChangesRequestHandler } from './handlers/FutureProductChangeRequestHandler';
import { LegacyInactiveProductHandler } from './handlers/LegacyInactiveProductHandler';
import { LieHandler } from './handlers/LieHandler';
import { LieNextHandler } from './handlers/LieNextHandler';
import { LieProcessingHandler } from './handlers/LieProcessingHandler';
import { OrderCompleteHandler } from './handlers/OrderCompleteHandler';
import { ProductUpdateCidnFulfillmentResponseHandler } from './handlers/ProductUpdateCidnFulfillmentResponseHandler';
import { ProductUpsertRequestHandler } from './handlers/ProductUpsertRequestHandler';

@Singleton
export class MessagingConfig {
  @Inject
  private logger!: Logger;

  @Inject
  private messagingConfigProvider!: MessagingConfigProvider;

  @Inject
  private messagingManager!: MessagingManager;

  @Inject
  private appConfig!: AppConfig;

  @Inject
  private productUpsertRequestHandler!: ProductUpsertRequestHandler;

  @Inject
  private productUpdateCidnFulfillmentResponseHandler!: ProductUpdateCidnFulfillmentResponseHandler;

  @Inject
  private futureProductChangesRequestHandler!: FutureProductChangesRequestHandler;

  @Inject
  private lieHandler!: LieHandler;

  @Inject
  private lieNextHandler!: LieNextHandler;

  @Inject
  private lieProcessingHandler!: LieProcessingHandler;

  @Inject
  private legacyInactiveProductHandler!: LegacyInactiveProductHandler;

  @Inject
  private cdnFailureHandler!: CDNFailureHandler;

  @Inject
  private orderCompleteHandler!: OrderCompleteHandler;

  private messageHandlers = [
    this.productUpsertRequestHandler,
    this.productUpdateCidnFulfillmentResponseHandler,
    this.futureProductChangesRequestHandler,
    this.lieHandler,
    this.lieNextHandler,
    this.lieProcessingHandler,
    this.legacyInactiveProductHandler,
    this.cdnFailureHandler,
    this.orderCompleteHandler,
  ];

  public async registerAndStart() {
    StandardMessagingConfigs.tabletServices.register();

    const { disableSubscriptions } = this.appConfig.rmq;

    this.messagingConfigProvider.registerMessagingConfig(
      this.getMessagingConfig(disableSubscriptions),
    );

    this.logger.info('Starting messaging broker...');
    await this.messagingManager.startBroker();
    this.logger.info('Started messaging broker.');

    if (!disableSubscriptions) {
      const onMessageReceived = this.messagingManager.getSubscription(
        MessagingConstants.SUBSCRIPTION_ID,
      ).onMessageReceived;
      this.messageHandlers.map((messageHandler) => {
        messageHandler.bindingKeys.map((bindingKey) => {
          onMessageReceived.addHandler(bindingKey, (rk: string, m: any) =>
            messageHandler.handleMessage(rk, m),
          );
        });
      });
    }
  }

  private getMessagingConfig(disableSubscriptions: boolean) {
    const queues = {
      [MessagingConstants.QUEUE_ID]: {
        assert: true,
        options: {
          durable: true,
        },
      },
    };

    const bindings = {
      [MessagingConstants.SUBSCRIPTION_ID]: {
        source: MessagingConstants.EXCHANGE_ID,
        destination: MessagingConstants.QUEUE_ID,
        destinationType: 'queue' as const,
        bindingKeys: _.flatMap(
          this.messageHandlers,
          (messageHandler) => messageHandler.bindingKeys,
        ),
      },
    };

    const subscriptions = {
      [MessagingConstants.SUBSCRIPTION_ID]: {
        queue: MessagingConstants.QUEUE_ID,
      },
    };

    return {
      queues,
      ...(!disableSubscriptions && { bindings, subscriptions }),
    };
  }
}

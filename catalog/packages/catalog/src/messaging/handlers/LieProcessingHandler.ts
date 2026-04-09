import { Logger } from '@securustablets/libraries.logging/dist/src/Logger';
import { Inject, Singleton } from 'typescript-ioc';
import { LargeImpactEvent } from '../../controllers/models/LargeImpactEvent';
import { LargeImpactEventManager } from '../../lib/LargeImpactEventManager';
import { AppConfig } from '../../utils/AppConfig';
import { MessagingConstants } from '../MessagingConstants';
import { BlocklistLie } from '../lie/BlocklistLie';
import { DistinctProductValueLie } from '../lie/DistinctProductValueLie';

@Singleton
export class LieProcessingHandler {
  @Inject
  private lieManager!: LargeImpactEventManager;

  @Inject
  private dpvLie!: DistinctProductValueLie;

  @Inject
  private blocklistLie!: BlocklistLie;

  @Inject
  private log!: Logger;

  @Inject
  private config: AppConfig;

  public readonly bindingKeys = [
    MessagingConstants.LARGE_IMPACT_EVENT_PROCESSING_ROUTING_KEY,
  ];

  public async handleMessage(
    routingKey: string,
    message: LargeImpactEvent,
  ): Promise<boolean> {
    this.log.info(`LIE processing ${JSON.stringify(message)}`);
    try {
      // add here more processing handlers with the pattern testing
      if (
        MessagingConstants.DISTINCT_PRODUCT_VALUE_UPDATED_PATTERN.test(
          message.routingKey,
        )
      ) {
        await this.dpvLie.dpvProcessHandler(message.payload);
      } else if (
        message.routingKey ===
        MessagingConstants.BLOCK_ACTION_PENDING_ROUTING_KEY
      ) {
        await this.blocklistLie.blockActionProcessHandler(
          message.routingKey,
          message.payload,
        );
      }
      await this.lieManager.processingAndUpdateToComplete(message, {
        routingKey,
      });
    } catch (error) {
      // Allowing missing entities for testing because RMQ handling is all over the place right now
      if (error.code !== 404 || !this.config.allowTestApis) {
        this.log.error(
          `Cannot process or update the lie with the routing key ${message.routingKey} and the payload: ${JSON.stringify(message.payload)}`,
          error,
        );
        throw error;
      }
    }

    return true;
  }
}

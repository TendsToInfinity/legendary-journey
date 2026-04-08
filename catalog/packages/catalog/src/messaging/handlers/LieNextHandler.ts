import { Logger } from '@securustablets/libraries.logging/dist/src/Logger';
import { Inject, Singleton } from 'typescript-ioc';
import { LargeImpactEvent } from '../../controllers/models/LargeImpactEvent';
import { LargeImpactEventManager } from '../../lib/LargeImpactEventManager';
import { MessagingConstants } from '../MessagingConstants';

@Singleton
export class LieNextHandler {
  @Inject
  private lieManager!: LargeImpactEventManager;

  @Inject
  private log!: Logger;

  public readonly bindingKeys = [
    MessagingConstants.LARGE_IMPACT_EVENT_PENDING_ROUTING_KEY,
    MessagingConstants.LARGE_IMPACT_EVENT_COMPLETE_ROUTING_KEY,
  ];

  public async handleMessage(
    routingKey: string,
    message: LargeImpactEvent,
  ): Promise<boolean> {
    try {
      await this.lieManager.updatePendingToProcessingAndPublish(message);
    } catch (error) {
      this.log.error(
        `Cannot update the lie with the routing key ${message.routingKey} and the payload: ${JSON.stringify(message.payload)}`,
        error,
      );
      throw error;
    }

    return true;
  }
}

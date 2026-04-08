import { Logger } from '@securustablets/libraries.logging';
import { Inject, Singleton } from 'typescript-ioc';
import {
  LargeImpactEvent,
  LargeImpactEventState,
} from '../../controllers/models/LargeImpactEvent';
import { LargeImpactEventManager } from '../../lib/LargeImpactEventManager';
import { MessagingConstants } from '../MessagingConstants';

@Singleton
export class LieHandler {
  @Inject
  private lieManager!: LargeImpactEventManager;

  @Inject
  private log!: Logger;

  public readonly bindingKeys = [
    MessagingConstants.DISTINCT_PRODUCT_VALUE_UPDATED_ROUTING_KEY,
    MessagingConstants.BLOCK_ACTION_PENDING_ROUTING_KEY,
  ];

  public async handleMessage(
    routingKey: string,
    message: any,
  ): Promise<boolean> {
    // the handler for creating a pending LIE record
    const lieItem = {
      routingKey,
      payload: message,
      state: LargeImpactEventState.Pending,
    } as LargeImpactEvent;
    try {
      await this.lieManager.createAndPublish(lieItem, { routingKey });
    } catch (error) {
      this.log.error(
        `Cannot create a lie with the routing key ${lieItem.routingKey} and the payload: ${JSON.stringify(lieItem.payload)}`,
        error,
      );
      throw error;
    }

    return true;
  }
}

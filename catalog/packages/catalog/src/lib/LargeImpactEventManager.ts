import { Logger } from '@securustablets/libraries.logging';
import { MessagingManager } from '@securustablets/libraries.messaging';
import { Inject } from 'typescript-ioc';
import {
  LargeImpactEvent,
  LargeImpactEventState,
} from '../controllers/models/LargeImpactEvent';
import { LargeImpactEventDao } from '../data/PGCatalog/LargeImpactEventDao';
import { MessagingConstants } from '../messaging/MessagingConstants';

export class LargeImpactEventManager {
  @Inject
  private lieDao!: LargeImpactEventDao;

  @Inject
  private messagingManager!: MessagingManager;

  @Inject
  private logger!: Logger;

  public findByQueryString = this.lieDao.findByQueryString.bind(this.lieDao);
  public findOneOrFail = this.lieDao.findOneOrFail.bind(this.lieDao);
  public setLastProcessedPage = this.lieDao.setLastProcessedPage.bind(
    this.lieDao,
  );

  public async createAndPublish(
    lie: LargeImpactEvent,
    context: object,
  ): Promise<LargeImpactEvent> {
    const lieCreated = await this.lieDao.createAndRetrieve(lie, context);
    if (lieCreated) {
      await this.messagingManager.publish(
        MessagingConstants.PUBLICATION_ID,
        MessagingConstants.LARGE_IMPACT_EVENT_PENDING_ROUTING_KEY,
        lieCreated,
      );
    }
    return lieCreated;
  }

  public async updateAndPublish(
    lie: LargeImpactEvent,
    context: object,
  ): Promise<LargeImpactEvent> {
    const lieUpdated = await this.lieDao.updateAndRetrieve(
      lie.largeImpactEventId,
      lie,
      context,
    );
    if (lieUpdated) {
      await this.messagingManager.publish(
        MessagingConstants.PUBLICATION_ID,
        MessagingConstants.LARGE_IMPACT_EVENT_PENDING_ROUTING_KEY,
        lieUpdated,
      );
    }
    return lieUpdated;
  }

  public async updatePendingToProcessingAndPublish(
    lie: LargeImpactEvent,
  ): Promise<LargeImpactEvent> {
    const processableLie = await this.lieDao.retrieveProcessableEvent(
      lie.routingKey,
    );
    if (processableLie) {
      await this.messagingManager.publish(
        MessagingConstants.PUBLICATION_ID,
        MessagingConstants.LARGE_IMPACT_EVENT_PROCESSING_ROUTING_KEY,
        processableLie,
      );
    }
    return processableLie;
  }

  public async processingAndUpdateToComplete(
    lie: LargeImpactEvent,
    context: object,
  ): Promise<LargeImpactEvent> {
    const lieUpdated = await this.lieDao.updateAndRetrieve(
      lie.largeImpactEventId,
      { state: LargeImpactEventState.Complete },
      context,
    );
    if (lieUpdated) {
      this.logger.info(`LIE completed ${JSON.stringify(lieUpdated)}`);
      await this.messagingManager.publish(
        MessagingConstants.PUBLICATION_ID,
        MessagingConstants.LARGE_IMPACT_EVENT_COMPLETE_ROUTING_KEY,
        lieUpdated,
      );
    }
    return lieUpdated;
  }
}

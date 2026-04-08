import { Inject, Singleton } from 'typescript-ioc';
import { FutureState } from '../../controllers/models/FutureProductChange';
import { FutureProductChangeManager } from '../../lib/FutureProductChangeManager';
import { MessagingConstants } from '../MessagingConstants';
import { FutureProductChangesMessage } from '../models/FutureProductChangeMessage';

@Singleton
export class FutureProductChangesRequestHandler {
  @Inject
  private futureProductMan!: FutureProductChangeManager;

  public readonly bindingKeys = [
    MessagingConstants.FUTURE_PRODUCT_CHANGE_REQUEST_ROUTING_KEY,
  ];

  public async handleMessage(
    routingKey: string,
    futureProductChangesMessage: FutureProductChangesMessage,
  ): Promise<boolean> {
    await Promise.all([
      futureProductChangesMessage.futureProductChanges.map(
        async (futureProduct) => {
          const exists =
            await this.futureProductMan.findFutureProductChange(futureProduct);
          if (exists?.length > 0) {
            await this.futureProductMan.update(
              exists[0].futureProductChangeId,
              futureProduct,
              { routingKey },
            );
          } else {
            futureProduct.state = FutureState.Pending;
            await this.futureProductMan.create(futureProduct, { routingKey });
          }
        },
      ),
    ]);

    return true;
  }
}

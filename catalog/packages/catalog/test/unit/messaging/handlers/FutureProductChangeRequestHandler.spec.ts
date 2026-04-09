import * as faker from 'faker';
import * as sinon from 'sinon';
import { FutureProductChangesRequestHandler } from '../../../../src/messaging/handlers/FutureProductChangeRequestHandler';
import { ModelFactory } from '../../../utils/ModelFactory';

describe('FutureProductChangesRequestHandler - Unit', () => {
  let futureProductChangesRequestHandler: FutureProductChangesRequestHandler;
  let mockFutureProductManager: sinon.SinonMock;

  beforeEach(() => {
    futureProductChangesRequestHandler =
      new FutureProductChangesRequestHandler();
    mockFutureProductManager = sinon.mock(
      (futureProductChangesRequestHandler as any).futureProductMan,
    );
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('handleMessage', () => {
    it('should call createFutureProduct', async () => {
      const routingKey = 'test';
      const futureProduct = ModelFactory.futureProduct({
        action: {
          meta: { basePrice: { purchase: faker.random.number() } },
          source: {
            msrp: faker.random.alphaNumeric(10),
            wholesalePrice: faker.random.word(),
          },
        },
      });

      mockFutureProductManager
        .expects('findFutureProductChange')
        .withExactArgs(futureProduct)
        .once()
        .resolves();

      mockFutureProductManager
        .expects('create')
        .withExactArgs(futureProduct, { routingKey })
        .once()
        .resolves(1);

      await futureProductChangesRequestHandler.handleMessage(routingKey, {
        futureProductChanges: [futureProduct],
      });

      mockFutureProductManager.verify();
    });

    it('should call update with exact parameters', async () => {
      const routingKey = 'test';
      const futureProduct = ModelFactory.futureProduct({
        action: {
          meta: { basePrice: { purchase: faker.random.number() } },
          source: {
            msrp: faker.random.alphaNumeric(10),
            wholesalePrice: faker.random.word(),
          },
        },
      });

      const oldFutureProduct = {
        ...futureProduct,
        futureProductChangeId: 1,
        action: {
          source: {
            msrp: '1.99',
            wholesalePrice: '1.99',
          },
          meta: {
            basePrice: {
              purchase: 1.99,
            },
          },
        },
      };

      mockFutureProductManager
        .expects('findFutureProductChange')
        .withExactArgs(futureProduct)
        .resolves([oldFutureProduct]);

      mockFutureProductManager
        .expects('update')
        .withExactArgs(1, futureProduct, { routingKey })
        .resolves();

      await futureProductChangesRequestHandler.handleMessage(routingKey, {
        futureProductChanges: [futureProduct],
      });

      mockFutureProductManager.verify();
    });
  });
});

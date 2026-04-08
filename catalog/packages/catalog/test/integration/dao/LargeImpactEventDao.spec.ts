import { expect } from 'chai';
import { CatalogService } from '../../../src/CatalogService';
import { LargeImpactEventDao } from '../../../src/data/PGCatalog/LargeImpactEventDao';
import { ModelFactory } from '../../utils/ModelFactory';
import { IntegrationTestSuite } from '../IntegrationTestSuite';
import '../global.spec';
import { LargeImpactEventState } from './../../../src/controllers/models/LargeImpactEvent';

describe('LargeImpactEventDao - Integration', function () {
  IntegrationTestSuite.setUp(this);
  let largeImpactEventDao: LargeImpactEventDao;

  before(() => {
    CatalogService.bindAll();
  });

  beforeEach(async () => {
    largeImpactEventDao = new LargeImpactEventDao();
  });

  describe('retrieveProcessableEvent', () => {
    it('should find a next processable largeImpactEvent', async () => {
      const { largeImpactEventId } =
        await largeImpactEventDao.createAndRetrieve(
          ModelFactory.largeImpactEvent(),
          ModelFactory.auditContext(),
        );
      const largeImpactEvent =
        await largeImpactEventDao.findOneOrFail(largeImpactEventId);
      const processableLargeImpactEvent =
        await largeImpactEventDao.retrieveProcessableEvent(
          largeImpactEvent.routingKey,
        );
      expect(largeImpactEvent.largeImpactEventId).to.deep.equal(
        largeImpactEventId,
      );
      expect(processableLargeImpactEvent.largeImpactEventId).to.deep.equal(
        largeImpactEvent.largeImpactEventId,
      );
      expect(processableLargeImpactEvent.state).to.deep.equal(
        LargeImpactEventState.Processing,
      );
    });

    it('should not process a new largeImpactEvent if one event already in the processing state', async () => {
      const largeImpactEventId1 = (
        await largeImpactEventDao.createAndRetrieve(
          ModelFactory.largeImpactEvent(),
          ModelFactory.auditContext(),
        )
      ).largeImpactEventId;
      const largeImpactEvent1 =
        await largeImpactEventDao.findOneOrFail(largeImpactEventId1);

      const largeImpactEventId2 = (
        await largeImpactEventDao.createAndRetrieve(
          ModelFactory.largeImpactEvent({
            routingKey: largeImpactEvent1.routingKey,
          }), // the same routing key
          ModelFactory.auditContext(),
        )
      ).largeImpactEventId;

      const largeImpactEvent2 =
        await largeImpactEventDao.findOneOrFail(largeImpactEventId2);

      const processableLargeImpactEvent1 =
        await largeImpactEventDao.retrieveProcessableEvent(
          largeImpactEvent1.routingKey,
        );
      const processableLargeImpactEvent2 =
        await largeImpactEventDao.retrieveProcessableEvent(
          largeImpactEvent1.routingKey,
        );

      expect(largeImpactEvent1.largeImpactEventId).to.equal(
        largeImpactEventId1,
      ); // the 1st lie exists
      expect(largeImpactEvent2.largeImpactEventId).to.equal(
        largeImpactEventId2,
      ); // the 2nd lie exists

      expect(largeImpactEvent1.routingKey).to.equal(
        largeImpactEvent2.routingKey,
      );

      expect(true).to.satisfy(() => {
        if (
          (processableLargeImpactEvent1.largeImpactEventId ===
            largeImpactEvent1.largeImpactEventId &&
            processableLargeImpactEvent1.state ===
              LargeImpactEventState.Processing &&
            processableLargeImpactEvent2 === undefined) || // if the 1st is processing the 2nd undefined
          (processableLargeImpactEvent2.largeImpactEventId ===
            largeImpactEvent2.largeImpactEventId &&
            processableLargeImpactEvent2.state ===
              LargeImpactEventState.Processing &&
            processableLargeImpactEvent1 === undefined) // if the 2nd is processing the 1st undefined
        ) {
          return true;
        } else {
          return false;
        }
      });
    });
  });
});

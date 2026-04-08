import * as Bluebird from 'bluebird';
import { expect } from 'chai';
import * as faker from 'faker';
import { CatalogService } from '../../../../src/CatalogService';
import { LargeImpactEventState } from '../../../../src/controllers/models/LargeImpactEvent';
import { LargeImpactEventDao } from '../../../../src/data/PGCatalog/LargeImpactEventDao';
import { LargeImpactEventManager } from '../../../../src/lib/LargeImpactEventManager';
import { LieHandler } from '../../../../src/messaging/handlers/LieHandler';
import { IntegrationTestSuite } from '../../IntegrationTestSuite';
import '../../global.spec';

describe('LieHandler - Integration', function () {
  IntegrationTestSuite.setUp(this);
  let lieManager: LargeImpactEventManager;
  let lieHandler: LieHandler;
  let lieDao: LargeImpactEventDao;

  before(() => {
    CatalogService.bindAll();
  });

  beforeEach(() => {
    lieManager = new LargeImpactEventManager();
    lieHandler = new LieHandler();
    lieDao = new LargeImpactEventDao();
  });

  describe('handleMessage', () => {
    // pended test, it's not guaranteed that the processing has started and hard to pinpoint between start and complete
    xit('should create new LIE and start processing', async () => {
      const routingKey = faker.random
        .words(5)
        .split(' ')
        .join('.')
        .toLowerCase();
      const testPayload = { prop: faker.random.words(10) };

      await lieHandler.handleMessage(routingKey, testPayload);

      const lieCreated = await lieDao.find({ by: { routingKey } });
      expect(lieCreated).to.be.not.null;
      expect(lieCreated.length).to.be.equal(1);
      expect(lieCreated[0].routingKey).to.equal(routingKey);
      expect(lieCreated[0].payload).to.deep.equal(testPayload);
      expect(lieCreated[0].version).to.equal(1);
      expect(lieCreated[0].state).to.equal(LargeImpactEventState.Processing);
    });

    it('should create new LIE and wait for complete', async () => {
      const routingKey = faker.random
        .words(5)
        .split(' ')
        .join('.')
        .toLowerCase();
      const testPayload = { prop: faker.random.words(10) };

      await lieHandler.handleMessage(routingKey, testPayload);
      await Bluebird.delay(900); // wait for the message is handled

      const lieCreated = await lieDao.find({ by: { routingKey } });
      expect(lieCreated).to.be.not.null;
      expect(lieCreated.length).to.be.equal(1);
      expect(lieCreated[0].routingKey).to.equal(routingKey);
      expect(lieCreated[0].payload).to.deep.equal(testPayload);
      expect(lieCreated[0].version).to.equal(2);
      expect(lieCreated[0].state).to.equal(LargeImpactEventState.Complete);
    });
  });
});

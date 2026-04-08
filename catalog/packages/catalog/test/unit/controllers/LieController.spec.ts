import { SecurityFactory } from '@securustablets/libraries.utils-test';
import { assert } from 'chai';
import { Request } from 'express';
import * as sinon from 'sinon';
import { LieController } from '../../../src/controllers/LieController';
import { ModelFactory } from '../../utils/ModelFactory';

describe('LargeImpactEventController - Unit', () => {
  let controller: LieController;
  let mockLargeImpactEventManager: sinon.SinonMock;

  const context = { apiKey: 'test' };

  beforeEach(() => {
    controller = new LieController();
    mockLargeImpactEventManager = sinon.mock((controller as any).lieManager);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('findByQueryString', () => {
    it('should call the dao', async () => {
      mockLargeImpactEventManager
        .expects('findByQueryString')
        .withArgs({ foo: 'bar' });
      await controller.findLargeImpactEvents({
        query: { foo: 'bar' },
      } as any as Request);
      sinon.verify();
    });
  });

  describe('get by id', () => {
    it('should call LargeImpactEventManager.findOneOrFail', async () => {
      mockLargeImpactEventManager.expects('findOneOrFail').withArgs(1);
      await controller.getLargeImpactEvent('1', context);
      sinon.verify();
    });
  });

  describe('createLargeImpactEvent', () => {
    it('should call LargeImpactEventManager.createAndPublish', async () => {
      const lie = ModelFactory.largeImpactEvent();
      const corpJwt = SecurityFactory.corpJwt();

      mockLargeImpactEventManager
        .expects('createAndPublish')
        .withArgs(lie, { corpJwt })
        .resolves(lie);

      await controller.createLargeImpactEvent(lie, { corpJwt });
      sinon.verify();
    });
  });

  describe('updateLargeImpactEvent', () => {
    const lie = ModelFactory.largeImpactEvent({ largeImpactEventId: 1 });
    const corpJwt = SecurityFactory.corpJwt();

    it('should call LargeImpactEventManager.updateAndPublish', async () => {
      mockLargeImpactEventManager
        .expects('updateAndPublish')
        .withArgs(lie, { corpJwt });

      await controller.updateLargeImpactEvent(
        lie.largeImpactEventId.toString(),
        lie,
        { corpJwt },
      );

      sinon.verify();
    });

    it('should get a 400 for mismatched ruleIds', async () => {
      try {
        await controller.updateLargeImpactEvent('123', lie, { corpJwt });
        assert.fail();
      } catch (err) {
        assert.equal(err.code, 400);
      }

      sinon.verify();
    });
  });
});

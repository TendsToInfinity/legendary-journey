import { Postgres } from '@securustablets/libraries.postgres';
import { assert, expect } from 'chai';
import * as sinon from 'sinon';
import { LargeImpactEventDao } from '../../../src/data/PGCatalog/LargeImpactEventDao';
import { MockUtils } from '../../utils/MockUtils';
import { ModelFactory } from '../../utils/ModelFactory';

describe('LargeImpactEventDao - Unit', () => {
  let largeImpactEventDao: LargeImpactEventDao;
  let pgMock: sinon.SinonMock;

  beforeEach(() => {
    largeImpactEventDao = new LargeImpactEventDao();
    pgMock = MockUtils.inject(largeImpactEventDao, '_pg', Postgres);
  });
  afterEach(() => {
    sinon.restore();
  });
  describe('construct', () => {
    it('constructs', () => {
      assert.isObject(largeImpactEventDao, 'It did not construct');
    });
  });
  describe('retrieveProcessableEvent', () => {
    it('should return a processable LIE', async () => {
      const lie = ModelFactory.largeImpactEvent({ largeImpactEventId: 1 });
      const queryResult = { rows: [lie] };
      sinon.stub(largeImpactEventDao as any, 'write').returns(queryResult);
      const result = await largeImpactEventDao.retrieveProcessableEvent(
        lie.routingKey,
      );
      expect(result).deep.equal(lie);
      sinon.verify();
    });

    it('should return undefined if processable LIE is not exists', async () => {
      const lie = ModelFactory.largeImpactEvent({ largeImpactEventId: 1 });
      const queryResult = { rows: [] };
      sinon.stub(largeImpactEventDao as any, 'write').returns(queryResult);
      const result = await largeImpactEventDao.retrieveProcessableEvent(
        lie.routingKey,
      );
      expect(result).deep.equal(undefined);
      sinon.verify();
    });

    it('should return undefined in case of undefined convert result', async () => {
      const lie = ModelFactory.largeImpactEvent({ largeImpactEventId: 1 });
      const queryResult = undefined;
      sinon.stub(largeImpactEventDao as any, 'write').returns(queryResult);
      sinon
        .stub(largeImpactEventDao as any, 'convertQueryResult')
        .returns(undefined);
      const result = await largeImpactEventDao.retrieveProcessableEvent(
        lie.routingKey,
      );
      expect(result).deep.equal(undefined);
      sinon.verify();
    });
  });

  describe('setLastProcessedPage', () => {
    it('should update lie with last processed page', async () => {
      const regex = sinon.match((value) => {
        return (
          value.includes(`UPDATE large_impact_event`) &&
          value.includes(`SET payload = jsonb_set(payload,'{lastPage}', $1)`) &&
          value.includes(`WHERE large_impact_event_id = $2`)
        );
      });

      pgMock.expects('write').withExactArgs(regex, [12, 1]);
      await largeImpactEventDao.setLastProcessedPage(1, 12);
      sinon.verify();
    });
  });
});

import { _, findPkgRootSync } from '@securustablets/libraries.utils';
import { assert, expect } from 'chai';
import { Request } from 'express';
import * as mockRequire from 'mock-require';
import * as path from 'path';
import { Exception } from 'securus.tablets.libraries.exceptions';
import * as sinon from 'sinon';
import { HeartbeatController } from '../../../src/controllers/HeartbeatController';

describe('HeartbeatController - Unit', () => {
  let heartbeatController: HeartbeatController;
  let mockPostgres: sinon.SinonMock;
  let mockEligibility: sinon.SinonMock;
  beforeEach(() => {
    heartbeatController = new HeartbeatController();
    mockPostgres = sinon.mock(_.get(heartbeatController, 'postgres'));
    mockEligibility = sinon.mock(
      _.get(heartbeatController, 'eligibilityManager'),
    );
  });
  afterEach(() => {
    sinon.restore();
    mockRequire.stopAll();
  });
  describe('getHeartbeat', () => {
    it('should return heartbeat with its dependencies', async () => {
      mockRequire(path.join(findPkgRootSync(__dirname), 'package.json'), {
        version: '1.0.0',
      });
      mockPostgres.expects('heartbeat').resolves({ version: '11' });
      mockEligibility.expects('heartbeat').resolves({ version: 'eligibility' });
      const heartbeat = await heartbeatController.heartbeat({} as Request);
      expect(heartbeat).to.deep.equal({
        version: '1.0.0',
        postgres: { version: '11' },
        eligibility: { version: 'eligibility' },
      });
      mockPostgres.verify();
      mockEligibility.verify();
    });
    it('returns the version without checking its dependencies when query isAlive is "true"', async () => {
      mockRequire(path.join(findPkgRootSync(__dirname), 'package.json'), {
        version: '1.0.0',
      });
      mockPostgres.expects('heartbeat').never();
      mockEligibility.expects('heartbeat').never();
      const heartbeat = await heartbeatController.heartbeat({
        // tslint:disable-next-line
        query: { isAlive: 'true' },
      } as any);
      expect(heartbeat).to.deep.equal({ version: '1.0.0' });
      mockPostgres.verify();
      mockEligibility.verify();
    });
    it('throws an exception when postgres is down', async () => {
      const mockVersion = { version: '1.0.0' };
      mockRequire(
        path.join(findPkgRootSync(__dirname), 'package.json'),
        mockVersion,
      );
      const mockConnectionError = Error('CONNECTION_ERROR');
      mockPostgres
        .expects('heartbeat')
        .resolves(Promise.reject(mockConnectionError));
      mockEligibility.expects('heartbeat').resolves({ data: mockVersion });
      try {
        await heartbeatController.heartbeat({} as Request);
        assert.fail();
      } catch (err) {
        expect(err.name).to.equal(Exception.InternalError.name, err);
        expect(err.errors[0].version).to.equal('1.0.0');
      }
      mockPostgres.verify();
      mockEligibility.verify();
    });
    it('throws an exception when eligibility is down', async () => {
      const mockVersion = { version: '1.0.0' };
      mockRequire(
        path.join(findPkgRootSync(__dirname), 'package.json'),
        mockVersion,
      );
      const mockConnectionError = Error('CONNECTION_ERROR');
      mockPostgres.expects('heartbeat').resolves({ data: mockVersion });
      mockEligibility
        .expects('heartbeat')
        .resolves(Promise.reject(mockConnectionError));
      try {
        await heartbeatController.heartbeat({} as Request);
        assert.fail();
      } catch (err) {
        expect(err.name).to.equal(Exception.InternalError.name, err);
        expect(err.errors[0].version).to.equal('1.0.0');
      }
      mockPostgres.verify();
      mockEligibility.verify();
    });
  });
});

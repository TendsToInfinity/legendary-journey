import { _ } from '@securustablets/libraries.utils';
import { expect } from 'chai';
import * as request from 'supertest';
import { app } from '../../../src/main';
import { IntegrationTestSuite } from '../IntegrationTestSuite';

describe('HeartbeatController', function () {
  IntegrationTestSuite.setUp(this);

  it('should return heartbeat', async () => {
    const { body: heartbeat } = await request(app)
      .get('/heartbeat')
      .expect(200);
    expect(_.keys(heartbeat)).to.have.members([
      'version',
      'postgres',
      'eligibility',
    ]);
  });
});

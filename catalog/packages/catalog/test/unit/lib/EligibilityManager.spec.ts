import { Eligibility } from '@securustablets/services.inmate.client';
import { expect } from 'chai';
import { Exception } from 'securus.tablets.libraries.exceptions';
import * as sinon from 'sinon';
import { EligibilityManager } from '../../../src/lib/EligibilityManager';
import { ModelFactory } from '../../utils/ModelFactory';

describe('EligibilityManager - Unit', () => {
  let eligibilityManager: EligibilityManager;
  let mockEligibilityApi: sinon.SinonMock;
  let mockInmateEligibilityApi: sinon.SinonMock;
  let mockEligibiltyHeartbeatApi: sinon.SinonMock;
  let mockInmateHeartbeatApi: sinon.SinonMock;
  let stubGetSecurityContext: sinon.SinonStub;
  let stubConfig: sinon.SinonStub;

  beforeEach(() => {
    eligibilityManager = new EligibilityManager();
    mockEligibilityApi = sinon.mock((eligibilityManager as any).eligibilityApi);
    mockInmateEligibilityApi = sinon.mock(
      (eligibilityManager as any).inmateEligibilityApi,
    );
    mockEligibiltyHeartbeatApi = sinon.mock(
      (eligibilityManager as any).eligibilityHeartbeatApi,
    );
    mockInmateHeartbeatApi = sinon.mock(
      (eligibilityManager as any).inmateHeartbeatApi,
    );
    stubGetSecurityContext = sinon.stub();
    sinon
      .stub(
        (eligibilityManager as any).securityContextManager,
        'securityContext',
      )
      .get(stubGetSecurityContext);
    stubConfig = sinon.stub();
    sinon.stub((eligibilityManager as any).config, 'features').get(stubConfig);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('heartbeat', () => {
    it('should call eligibility heartbeat api when enabled', async () => {
      stubConfig.returns({});

      const expected = { data: { status: 'enabled' } };
      mockEligibiltyHeartbeatApi.expects('heartbeat').once().returns(expected);

      const result = await eligibilityManager.heartbeat();
      expect(result).to.deep.equal(expected.data);

      expect(stubConfig.called, 'config should have been checked').to.be.true;

      mockEligibiltyHeartbeatApi.verify();
    });
    it('should call inmate heartbeat api when enabled and eligibilityByInmateService is true', async () => {
      stubConfig.returns({ eligibilityByInmateService: true });

      const expected = { data: { status: 'enabled' } };
      mockInmateHeartbeatApi.expects('heartbeat').once().returns(expected);

      const result = await eligibilityManager.heartbeat();
      expect(result).to.deep.equal(expected.data);

      expect(stubConfig.called, 'config should have been checked').to.be.true;

      mockInmateHeartbeatApi.verify();
    });
  });

  describe('getEligibility', () => {
    it('should not call eligibility api or inmate eligibility api when security context doesnt have inmateJwt set, return default eligibility', async () => {
      mockInmateEligibilityApi.expects('getEligibility').never();
      mockEligibilityApi.expects('eligibility').never();
      stubGetSecurityContext.returns({});
      const result = await eligibilityManager.getEligibility();
      expect(result).to.deep.equal(ModelFactory.defaultEligibility());
      expect(
        stubGetSecurityContext.called,
        'security context should have been checked',
      ).to.be.true;
      mockInmateEligibilityApi.verify();
      mockEligibilityApi.verify();
    });
    it('should call eligibility api when passed an inmate tablet', async () => {
      stubConfig.returns({});
      const expected: Eligibility = ModelFactory.defaultEligibility({
        disableMediaPurchase: true,
      });
      stubGetSecurityContext.returns({ inmateJwt: {} });
      mockEligibilityApi
        .expects('eligibility')
        .withExactArgs()
        .resolves({ data: expected });

      const result = await eligibilityManager.getEligibility();
      expect(result).to.deep.equal(expected);
      mockEligibilityApi.verify();
    });
    it('should call inmate eligibility api when passed an inmate tablet and eligibilityByInmateService is true', async () => {
      stubConfig.returns({ eligibilityByInmateService: true });

      const expected: Eligibility = ModelFactory.defaultEligibility({
        disableMediaPurchase: true,
      });
      stubGetSecurityContext.returns({
        inmateJwt: {
          payload: {
            customerId: 'customerId',
            custodyAccount: 'custodyAccount',
          },
        },
      });
      mockInmateEligibilityApi
        .expects('getEligibility')
        .withExactArgs('customerId', 'custodyAccount')
        .resolves({ data: expected });

      const result = await eligibilityManager.getEligibility();
      expect(result).to.deep.equal(expected);
      mockInmateEligibilityApi.verify();
    });
    it('should passthrough 401', async () => {
      stubConfig.returns({});
      stubGetSecurityContext.returns({ inmateJwt: {} });
      mockEligibilityApi
        .expects('eligibility')
        .withExactArgs()
        .rejects(
          Exception.Unauthorized({
            message: 'message',
            errors: 'errors',
            source: 'source',
          }),
        );
      try {
        await eligibilityManager.getEligibility();
        expect.fail();
      } catch (e) {
        expect(e.code).to.equal(401);
        expect(e.message).to.equal(
          'Unauthorized error received, forwarding this response ["errors"]',
        );
        expect(e.errors).to.deep.equal(['errors']);
      }
      mockEligibilityApi.verify();
    });
  });
});

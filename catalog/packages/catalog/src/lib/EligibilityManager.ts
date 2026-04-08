import { SecurityContextManager } from '@securustablets/libraries.httpsecurity';
import {
  ApiResponse,
  Eligibility,
  EligibilityApi,
  EligibilityHeartbeatApi,
} from '@securustablets/services.eligibility.client';
import {
  EligibilityApi as InmateEligibilityApi,
  InmateHeartbeatApi,
} from '@securustablets/services.inmate.client';
import { Inject, Singleton } from 'typescript-ioc';
import { ServiceUtils } from '../services/ServiceUtils';
import { AppConfig } from '../utils/AppConfig';

@Singleton
export class EligibilityManager {
  @Inject
  private eligibilityApi!: EligibilityApi;
  @Inject
  private inmateEligibilityApi!: InmateEligibilityApi;
  @Inject
  private eligibilityHeartbeatApi!: EligibilityHeartbeatApi;
  @Inject
  private inmateHeartbeatApi!: InmateHeartbeatApi;

  @Inject
  private securityContextManager!: SecurityContextManager;

  @Inject
  private config!: AppConfig;

  public async getEligibility(): Promise<Eligibility> {
    if (
      this.securityContextManager.securityContext &&
      this.securityContextManager.securityContext.inmateJwt
    ) {
      if (this.config.features.eligibilityByInmateService) {
        const payload =
          this.securityContextManager.securityContext.inmateJwt.payload;

        return (
          await ServiceUtils.passthroughAuthError<ApiResponse<Eligibility>>(
            () =>
              this.inmateEligibilityApi.getEligibility(
                payload.customerId,
                payload.custodyAccount,
              ) as any,
          )
        ).data;
      } else {
        return (
          await ServiceUtils.passthroughAuthError<ApiResponse<Eligibility>>(
            () => this.eligibilityApi.eligibility(),
          )
        ).data;
      }
    }
    // Default eligibility, disable nothing
    return {
      disableMediaPurchase: false,
      disableApps: [],
      disableSubscription: false,
    } as any; // TODO kill me and bump eligibility client
  }

  public async heartbeat() {
    if (this.config.features.eligibilityByInmateService) {
      return (await this.inmateHeartbeatApi.heartbeat()).data;
    } else {
      return (await this.eligibilityHeartbeatApi.heartbeat()).data;
    }
  }
}

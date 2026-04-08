import { CloudFront } from 'aws-sdk';
import { Inject, Singleton } from 'typescript-ioc';
import { ProductTypeIds } from '../controllers/models/Product';
import { AppConfig } from '../utils/AppConfig';

@Singleton
export class CloudDistributionManager {
  @Inject
  private config!: AppConfig;

  private get cidnFulfillmentService() {
    return this.config.cidnFulfillmentService;
  }

  private get ebookCloudFrontConfig() {
    return this.config.ebook;
  }

  private getCloudfrontConfig(productTypeId: string) {
    switch (productTypeId.toLowerCase()) {
      case ProductTypeIds.EBook:
        return this.ebookCloudFrontConfig;
      default:
        return this.cidnFulfillmentService;
    }
  }

  public async signPathForCloudFront(s3path: string, productTypeId: string) {
    const cloudFrontConfig = this.getCloudfrontConfig(productTypeId);

    const privateKey = cloudFrontConfig.cloudFrontKey;
    const url = `https://${cloudFrontConfig.cloudFrontDistribution}/${s3path}`;

    const signer = new CloudFront.Signer(
      cloudFrontConfig.cloudFrontPublicKeyId,
      privateKey,
    );
    const now = Math.floor(new Date().getTime() / 1000); // get rid of milliseconds in UTC time
    const expiry = parseInt(cloudFrontConfig.urlExpiresHours, 10);
    const expires = now + expiry * 60 * 60;
    const reducedContentCloudFrontPath = signer.getSignedUrl({ url, expires }); // time UTC
    return reducedContentCloudFrontPath;
  }

  // TODO remove this completely
  public isEnabled() {
    return this.cidnFulfillmentService.enabled;
  }
}

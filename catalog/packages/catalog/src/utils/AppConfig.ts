import { CacheStoreConfig } from '@securustablets/libraries.cache';
import {
  ConfigProp,
  ConfigSource,
  Configuration,
} from '@securustablets/libraries.config';
import { _ } from '@securustablets/libraries.utils';
import { Singleton } from 'typescript-ioc';

@Singleton
export class AppConfig extends Configuration {
  protected get requiredProps(): ConfigProp[] {
    return [
      'elastic',
      'listenPort',
      'log.level',
      'log.format',
      'openSearch.host',
      'openSearch.user',
      'openSearch.pass',
      'postgres.host',
      'postgres.port',
      'postgres.user',
      'postgres.password',
      'postgres.database',
      'rmq.host',
      'rmq.virtualHost',
      'rmq.user',
      'rmq.password',
      'security.jwt.publicKey',
      'security.jwt.issuerUrls',
      'security.apiKey.keys',
      'signedData.publicKey',
      'signedData.jwtExpiry',
      'signedData.privateKey',
    ];
  }

  public get cache(): {
    tier1?: CacheStoreConfig;
    tier3?: CacheStoreConfig;
    ttlMicro: any;
    ttlTiny: any;
    ttlShort: any;
    ttlMedium: any;
    ttlLong: any;
  } {
    const cache = this.get('cache') || ({} as any);
    return {
      tier1: cache.tier1 || {},
      tier3: cache.tier3 || {},
      ttlMicro: _.get(cache, 'ttlMicro', 0),
      ttlTiny: _.get(cache, 'ttlTiny', 0),
      ttlShort: _.get(cache, 'ttlShort', 0),
      ttlMedium: _.get(cache, 'ttlMedium', 0),
      ttlLong: _.get(cache, 'ttlLong', 0),
    };
  }

  public get ddTraceEnabled(): boolean {
    return (
      this.get('DD_TRACE_ENABLED', { source: ConfigSource.Env }) === 'true'
    );
  }

  public get awsXrayEnabled(): boolean {
    return (
      this.get('AWS_XRAY_ENABLED', { source: ConfigSource.Env }) === 'true'
    );
  }

  public get apm(): { server: string } {
    return this.get('apm');
  }

  public get elastic(): string {
    return this.get('elastic');
  }

  public get listenPort(): string {
    return this.get('listenPort');
  }

  public get log(): { level: string; format: string; colorize?: boolean } {
    return this.get('log');
  }

  public get security(): {
    jwt: {
      publicKey: string;
      privateKey?: string;
      issuerUrls: string[];
      discoveryTTL?: number;
    };
    apiKey: { keys: string[] };
  } {
    return this.get('security');
  }

  public get signedData(): {
    privateKey: string;
    publicKey: string;
    jwtExpiry: string;
  } {
    return this.get('signedData');
  }

  public get postgres(): {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
  } {
    return this.get('postgres');
  }

  public get rmq(): {
    host: string;
    virtualHost: string;
    user: string;
    password: string;
    disableSubscriptions?: boolean;
  } {
    return this.get('rmq');
  }

  public get eligibilityService(): { baseUrl: string; apiKey: string } {
    return this.get('eligibilityService');
  }

  public get features(): {
    eligibility?: boolean;
    eligibilityByInmateService?: boolean;
  } {
    return this.get('features') || {};
  }

  public get allowTestApis(): boolean {
    return this.get('allowTestApis');
  }

  public get cidnFulfillmentService(): {
    cloudFrontKey: string;
    cloudFrontPublicKeyId: string;
    urlExpiresHours: string;
    cloudFrontDistribution: string;
    cloudFrontArtUrl: string;
    cloudFrontArtSubfolder: string;
    enabled?: boolean;
  } {
    return _.merge(
      {
        enabled: false,
        urlExpiresHours: '1',
        cloudFrontKey: '',
        cloudFrontPublicKeyId: '',
        cloudFrontDistribution: '',
        cloudFrontArtUrl: '',
        cloudFrontArtSubfolder: 'defaultArt',
      },
      this.get('cidnFulfillmentService'),
    );
  }

  public get cidnArtApprovalEndpoint(): {
    enabled: boolean;
    baseUrl: string;
    artApprovalEndpoint: string;
    batchArtApprovalLimit: number;
  } {
    return _.merge(
      {
        enabled: false,
        baseUrl: '',
        artApprovalEndpoint: '',
        batchArtApprovalLimit: 100,
      },
      this.get('cidnArtApprovalEndpoint'),
    );
  }

  public get ebook(): {
    cloudFrontKey: string;
    cloudFrontPublicKeyId: string;
    cloudFrontDistribution: string;
    cloudFrontUrl: string;
    cloudFrontSubfolder: string;
    urlExpiresHours: string;
  } {
    return _.merge(
      {
        cloudFrontKey: '',
        cloudFrontPublicKeyId: '',
        cloudFrontDistribution: '',
        urlExpiresHours: '1',
        cloudFrontUrl: '',
        cloudFrontSubfolder: '',
      },
      this.get('ebook'),
    );
  }

  public get catalogLocalMedia(): { catalogUseLocalMedia: boolean } {
    return _.merge(
      {
        catalogUseLocalMedia: false,
      },
      this.get('catalogLocalMedia'),
    );
  }

  public get openSearch(): { host: string; user: string; pass: string } {
    return this.get('openSearch');
  }

  public get sqsConfig(): { queueName: string; sqsEnabled: boolean } {
    return _.merge(
      {
        sqsEnabled: false,
        queueName: '',
      },
      this.get('sqsConfig'),
    );
  }

  public get autoReviewV2DateSwitch(): string | undefined {
    return this.get('autoReviewV2DateSwitch');
  }

  public get autoReview(): { concurrency: number } {
    return _.merge(
      {
        concurrency: 100,
      },
      this.get('autoReview'),
    );
  }
}

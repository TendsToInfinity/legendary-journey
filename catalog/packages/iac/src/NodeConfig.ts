import * as pulumi from '@pulumi/pulumi';
import * as tp from '@securustablets/libraries.pulumi';
import { bool, json, num, port, str } from 'envalid';
import { SharedSqsQueue } from './SharedSqsQueue';

export interface NodeConfigEnv {
  NODE_CONFIG_APM_SERVER: string;
  NODE_CONFIG_LISTEN_PORT: number;
  NODE_CONFIG_LOG_LEVEL: string;
  NODE_CONFIG_LOG_FORMAT: string;
  NODE_CONFIG_LOG_COLORIZE: boolean;

  NODE_CONFIG_CACHE_TTLS: object;
  NODE_CONFIG_CACHE_TIER_1_SECONDS: number;
  NODE_CONFIG_CACHE_TIER_3_SECONDS: number;

  NODE_CONFIG_JWT_PUBLIC_KEY: string;
  NODE_CONFIG_JWT_ISSUER_URLS: object;
  NODE_CONFIG_JWT_DISCOVERY_TTL: number;
  NODE_CONFIG_API_KEYS: object;

  NODE_CONFIG_POSTGRES_POOL_OPTIONS: object | undefined;

  NODE_CONFIG_ELASTICSEARCH_CUSTOMER_URL: string;
  NODE_CONFIG_ELIGIBILITY_SERVICE_BASE_URL: string;
  NODE_CONFIG_ELIGIBILITY_SERVICE_API_KEY: string;
  NODE_CONFIG_INMATE_SERVICE_BASE_URL: string;
  NODE_CONFIG_INMATE_SERVICE_API_KEY: string;

  NODE_CONFIG_RMQ_HOSTS: string[];
  NODE_CONFIG_RMQ_DISABLE_SUBSCRIPTIONS: boolean | undefined;

  NODE_CONFIG_SQS_CONFIG_SQS_ENABLED: boolean;
  NODE_CONFIG_CATALOG_LOCAL_MEDIA_CATALOG_USE_LOCAL_MEDIA: boolean;
  NODE_CONFIG_AUTO_REVIEW_V2_DATE_SWITCH: string | undefined;
  NODE_CONFIG_AUTO_REVIEW_CONCURRENCY: number;

  NODE_CONFIG_FEATURES_ELIGIBILITY: boolean;
  NODE_CONFIG_FEATURES_ELIGIBILITY_BY_INMATE_SERVICE: boolean;
}

export interface NodeConfigArgs {
  disableSubscriptions: boolean;
  elasticache: tp.Elasticache;
  opensearch: tp.Opensearch;
  auroraPostgres: tp.AuroraPostgres;
  sharedSqsQueue: SharedSqsQueue;
  port?: tp.EcsTaskExposePort;
}

export class NodeConfig extends tp.TpComponentResource<
  NodeConfigArgs,
  NodeConfigEnv
> {
  public secret: tp.Secret;

  constructor(
    name: string,
    args: NodeConfigArgs,
    opts?: pulumi.ComponentResourceOptions,
  ) {
    super('catalog:NodeConfig:NodeConfig', name, args, opts);
    this.secret = new tp.Secret(
      tp.name(`${this.shortName}-node-config`),
      {
        description: 'NODE_CONFIG secret for catalog service',
        value: this.buildSecretString(),
      },
      { parent: this },
    );
  }

  private buildSecretString() {
    return pulumi.jsonStringify({
      apm: {
        server: this.config.lookup('NODE_CONFIG_APM_SERVER'),
      },
      cache: {
        ...this.config.lookup('NODE_CONFIG_CACHE_TTLS'),
        tier1: {
          secondsToLive: this.config.lookup('NODE_CONFIG_CACHE_TIER_1_SECONDS'),
        },
        tier3: {
          hosts: [
            {
              url: this.args.elasticache.cluster.clusterAddress,
              port: this.args.elasticache.cluster.port,
            },
          ],
          secondsToLive: this.config.lookup('NODE_CONFIG_CACHE_TIER_3_SECONDS'),
          autoDiscover: true,
        },
      },
      elastic: this.config.lookup('NODE_CONFIG_ELASTICSEARCH_CUSTOMER_URL'),
      eligibilityService: {
        apiKey: this.config.lookup('NODE_CONFIG_ELIGIBILITY_SERVICE_API_KEY'),
        baseUrl: this.config.lookup('NODE_CONFIG_ELIGIBILITY_SERVICE_BASE_URL'),
      },
      inmateService: {
        apiKey: this.config.lookup('NODE_CONFIG_INMATE_SERVICE_API_KEY'),
        baseUrl: this.config.lookup('NODE_CONFIG_INMATE_SERVICE_BASE_URL'),
      },
      esClusters: {
        customerEs: this.config.lookup(
          'NODE_CONFIG_ELASTICSEARCH_CUSTOMER_URL',
        ),
      },
      features: {
        eligibility: this.config.lookup('NODE_CONFIG_FEATURES_ELIGIBILITY'),
        eligibilityByInmateService: this.config.lookup(
          'NODE_CONFIG_FEATURES_ELIGIBILITY_BY_INMATE_SERVICE',
        ),
      },
      listenPort:
        this.config.lookup('NODE_CONFIG_LISTEN_PORT') ??
        this.args.port?.port ??
        8080,
      log: {
        colorize: false,
        format: this.config.lookup('NODE_CONFIG_LOG_FORMAT'),
        level: this.config.lookup('NODE_CONFIG_LOG_LEVEL'),
      },
      postgres: {
        host: this.args.auroraPostgres.writeHost,
        hostRead: this.args.auroraPostgres.readHost,
        database: this.args.auroraPostgres.databaseName,
        databaseRead: this.args.auroraPostgres.databaseName,
        port: 5432,
        user: this.args.auroraPostgres.serviceUser,
        password: this.args.auroraPostgres.servicePassword,
        ...this.config.lookup('NODE_CONFIG_POSTGRES_POOL_OPTIONS'),
      },
      rmq: {
        hosts: this.config.lookup('NODE_CONFIG_RMQ_HOSTS'),
        disableSubscriptions:
          this.config.lookup('NODE_CONFIG_RMQ_DISABLE_SUBSCRIPTIONS') ??
          this.args.disableSubscriptions,
      },
      security: {
        apiKey: {
          keys: this.config.lookup('NODE_CONFIG_API_KEYS'),
        },
        jwt: {
          discoveryTTL: this.config.lookup('NODE_CONFIG_JWT_DISCOVERY_TTL'),
          issuerUrls: this.config.lookup('NODE_CONFIG_JWT_ISSUER_URLS'),
          publicKey: this.config.lookup('NODE_CONFIG_JWT_PUBLIC_KEY'),
        },
      },
      signedData: {
        jwtExpiry: '1h',
        privateKey: './private.pem',
        publicKey: './public.pem',
      },
      openSearch: {
        host: pulumi.interpolate`https://${this.args.opensearch.dnsRecord.fqdn}`,
        user: this.args.opensearch.serviceUser,
        pass: this.args.opensearch.servicePassword,
      },
      sqsConfig: {
        queueName: this.args.sharedSqsQueue.queueName,
        sqsEnabled: this.config.lookup('NODE_CONFIG_SQS_CONFIG_SQS_ENABLED'),
      },
      catalogLocalMedia: {
        catalogUseLocalMedia: this.config.lookup(
          'NODE_CONFIG_CATALOG_LOCAL_MEDIA_CATALOG_USE_LOCAL_MEDIA',
        ),
      },
      autoReviewV2DateSwitch: this.config.lookup(
        'NODE_CONFIG_AUTO_REVIEW_V2_DATE_SWITCH',
      ),
      autoReview: {
        concurrency: this.config.lookup('NODE_CONFIG_AUTO_REVIEW_CONCURRENCY'),
      },
    });
  }

  static envValidators(name: string): tp.Validators<NodeConfigEnv> {
    return {
      ...tp.Secret.envValidators(`${name}-node-config`),
      ...tp.Validators.makeLocal(name, {
        NODE_CONFIG_APM_SERVER: str({
          desc: 'Url to send elastic apm data',
        }),
        NODE_CONFIG_CACHE_TTLS: json({
          desc: 'Define cache parameters for in memory cache lengths',
          default: {
            ttlLong: 300,
            ttlMedium: 240,
            ttlMicro: 60,
            ttlShort: 180,
            ttlTiny: 120,
          },
          example: JSON.stringify({
            ttlLong: 300,
            ttlMedium: 240,
            ttlMicro: 60,
            ttlShort: 180,
            ttlTiny: 120,
          }),
        }),
        NODE_CONFIG_CACHE_TIER_1_SECONDS: num({
          desc: 'Seconds to live for tier 1 (in memory) cache',
          default: 180,
        }),
        NODE_CONFIG_CACHE_TIER_3_SECONDS: num({
          desc: 'Seconds to live for tier 3 (memcached) cache',
          default: 240,
        }),
        NODE_CONFIG_JWT_PUBLIC_KEY: str({
          default: './public.pem',
        }),
        NODE_CONFIG_JWT_ISSUER_URLS: json(),
        NODE_CONFIG_JWT_DISCOVERY_TTL: num({
          default: 3600,
        }),
        NODE_CONFIG_API_KEYS: json({
          default: ['API_KEY_DEV'],
        }),
        NODE_CONFIG_POSTGRES_POOL_OPTIONS: json({
          default: undefined,
          desc:
            'Provide additional options to the underlying pg.Pool.<br/>See here for available options:\n' +
            '<ul><li>https://node-postgres.com/apis/pool</li></ul>',
        }),
        NODE_CONFIG_RMQ_HOSTS: json(),
        NODE_CONFIG_LISTEN_PORT: port({
          desc:
            'Forcefully set the listen port.' +
            '<p>By default, the application determines the container listen ports based on the exposed ECS ports, but that can be overriden here.</p>',
          default: undefined,
        }),
        NODE_CONFIG_RMQ_DISABLE_SUBSCRIPTIONS: bool({
          desc:
            'Forcefully enable/disable RMQ subscriptions.' +
            '<p>By default, the application determines which containers should have subscriptions enabled, but that behavior can be overriden here.</p>',
          default: undefined,
        }),
        NODE_CONFIG_LOG_LEVEL: str({
          default: 'info',
        }),
        NODE_CONFIG_LOG_FORMAT: str({
          default: 'ecs',
        }),
        NODE_CONFIG_LOG_COLORIZE: bool({
          default: false,
        }),
        NODE_CONFIG_ELASTICSEARCH_CUSTOMER_URL: str({
          desc: 'The base url for the customer elasticsearch cluster',
        }),
        NODE_CONFIG_ELIGIBILITY_SERVICE_BASE_URL: str({
          desc: 'The base url for eligibility service',
          example: 'https://eligibility.dev.tp.stqlp.org',
        }),
        NODE_CONFIG_ELIGIBILITY_SERVICE_API_KEY: str({
          desc: 'The API key used to call eligibility service',
        }),
        NODE_CONFIG_INMATE_SERVICE_BASE_URL: str({
          desc: 'The base url for inmate service',
          example: 'https://inmate.dev.tp.stqlp.org',
        }),
        NODE_CONFIG_INMATE_SERVICE_API_KEY: str({
          desc: 'The API key used to call inmate service',
        }),
        NODE_CONFIG_SQS_CONFIG_SQS_ENABLED: bool({
          desc: 'Controls whether or not SQS-related features are enabled. For configuration of the queue itself, see `$SHARED_SQS_QUEUE_NAME`.',
          default: false,
        }),
        NODE_CONFIG_CATALOG_LOCAL_MEDIA_CATALOG_USE_LOCAL_MEDIA: bool({
          desc: 'Set to force the container to only serve locally cached products',
          default: false,
        }),
        NODE_CONFIG_AUTO_REVIEW_V2_DATE_SWITCH: str({
          default: undefined,
        }),
        NODE_CONFIG_AUTO_REVIEW_CONCURRENCY: num({
          default: 100,
        }),
        NODE_CONFIG_FEATURES_ELIGIBILITY: bool({
          default: false,
        }),
        NODE_CONFIG_FEATURES_ELIGIBILITY_BY_INMATE_SERVICE: bool({
          default: false,
        }),
      }),
    };
  }
}

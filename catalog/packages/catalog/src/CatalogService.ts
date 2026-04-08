import { Audit } from '@securustablets/libraries.audit-history';
import { CacheManager, Csi } from '@securustablets/libraries.cache';
import { LocalStore } from '@securustablets/libraries.cache-local';
import { MemcacheStore } from '@securustablets/libraries.cache-memcache';
import { SchemeFactory } from '@securustablets/libraries.httpsecurity';
import {
  InterfaceValidator,
  SchemaController,
} from '@securustablets/libraries.json-schema';
import { Logger, loggerFactory } from '@securustablets/libraries.logging';
import { Postgres } from '@securustablets/libraries.postgres';
import * as AWSXRay from 'aws-xray-sdk-core';
import * as AWSXRayExpress from 'aws-xray-sdk-express';
import * as cors from 'cors';
import * as express from 'express';
import * as path from 'path';
import {
  ApiApplication,
  ExpressApiIoc,
  Middleware,
} from 'securus.libraries.expressApi';
import * as swaggerUi from 'swagger-ui-express';
import { Container, Inject, Scope, Singleton } from 'typescript-ioc';
import { customSwagger } from './assets/CustomSwagger';
import { AppConfig } from './utils/AppConfig';

import { ContextConfiguration } from '@securustablets/libraries.context-config';
import { JsonSchemaParser } from '@securustablets/libraries.json-schema/dist/src/JsonSchemaParser';
import './controllers/BlockActionController';
import './controllers/BlockReasonController';
import './controllers/BlocklistTermController';
import './controllers/CatalogController';
import './controllers/DistinctProductValueController';
import './controllers/FeeController';
import './controllers/FilterController';
import './controllers/FutureProductChangesController';
import './controllers/HeartbeatController';
import './controllers/HomepageController';
import './controllers/LieController';
import './controllers/ProductAvailabilityController';
import './controllers/ProductController';
import { ProductFeeController } from './controllers/ProductFeeController';
import { ProductRuleController } from './controllers/ProductRuleController';
import './controllers/ProductSalesController';
import './controllers/ProductTypeAvailabilityController';
import './controllers/ProductTypeController';
import './controllers/RuleController';
import './controllers/SearchController';

@Singleton
export class CatalogService {
  @Inject
  private interfaceValidator!: InterfaceValidator;

  @Inject
  private config!: AppConfig;

  @Inject
  protected cacheManager: CacheManager;

  public app: express.Application;
  public api: ApiApplication;

  constructor() {
    this.config.init();
    this.app = express();
    this.api = new ApiApplication(this.app, { bodyParser: { limit: '50mb' } });
    this.configure();
  }

  private configure() {
    CatalogService.bindAll();

    ContextConfiguration.init({
      app: this.api,
      schema: JsonSchemaParser.getSchemaForInterface('Config'),
    });

    if (this.config.awsXrayEnabled) {
      AWSXRay.config([AWSXRay.plugins.ECSPlugin]);
      AWSXRay.setLogger(Container.get(Logger));
      AWSXRay.captureHTTPsGlobal(require('http'));
      this.app.use(AWSXRayExpress.openSegment('Catalog'));
    }

    this.api
      .use(cors())
      .use(Middleware.requestLogger())
      .use(Middleware.responseLogger())
      .error(Middleware.errorHandler())
      .useValidator(this.interfaceValidator)
      .useSecurity(
        SchemeFactory.create({
          apiKey: { keys: this.config.security.apiKey.keys },
          jwt: {
            publicKeyPath: this.config.security.jwt.publicKey,
            inmateJwt: true,
            corpJwt: true,
            facilityJwt: true,
            'facilityJwt:beta': true,
            issuerUrls: this.config.security.jwt.issuerUrls,
            discoveryTTL: this.config.security.jwt.discoveryTTL,
          },
        }),
      );

    Audit.init({ app: this.api });
    SchemaController.init({ app: this.api });
    ExpressApiIoc.init(Container, { logger: Logger });

    // swagger doc temporarily disabled ;(
    const swaggerDoc = {}; // require(path.join(process.cwd(), 'dist/swagger.json'));
    const options = {
      customSiteTitle: 'Catalog API Swagger Doc',
      customCss: customSwagger,
    };

    this.app.get('/swagger.json', (req, res) => {
      res.setHeader('Content-Type', 'application/json');
      res.send(swaggerDoc);
    });

    this.app.use(
      '/api-docs',
      swaggerUi.serve,
      swaggerUi.setup(swaggerDoc, options),
    );

    // /products/{productId}/rules and /products/{productId}/fees are shadowed by /products/{productId}/{purchaseType} unless we register them first.
    this.api.register(Container.get(ProductRuleController));
    this.api.register(Container.get(ProductFeeController));
    this.api.registerAll(
      path.join(__dirname, './controllers/**/!(*.d).@(js|ts)'),
    );

    if (this.config.awsXrayEnabled) {
      this.app.use(AWSXRayExpress.closeSegment());
    }

    const logger = Container.get(Logger);
    this.cacheManager.init(logger);
    this.cacheManager
      .addStore({
        cacheStoreIdentifier: Csi.Tier1,
        cacheStore: new LocalStore(),
        cacheStoreConfig: this.config.cache.tier1,
      })
      .then(
        () => logger.info('Initialized local cache'),
        (err) => logger.error('Local cache failure?!?!?!', err),
      );
    this.cacheManager
      .addStore({
        cacheStoreIdentifier: Csi.Tier3,
        cacheStore: new MemcacheStore(),
        cacheStoreConfig: this.config.cache.tier3,
      })
      .then(
        () => logger.info('Connected to memcache'),
        (err) => logger.error('Error connecting to memcache', err),
      );
  }

  public static bindAll() {
    const config = Container.get(AppConfig) as AppConfig;
    Container.bind(Logger)
      .provider({
        get: () =>
          loggerFactory({
            applicationName: 'catalog',
            logLevel: config.log.level,
            console: {
              enable: true,
              config: {
                format: config.log.format,
                colorize: config.log.colorize,
              },
            },
          }),
      })
      .scope(Scope.Singleton);
    Postgres.init({
      logger: Container.get(Logger),
      config,
    });
    Container.bind(Postgres).provider({ get: () => Postgres.getInstance() });
  }
}

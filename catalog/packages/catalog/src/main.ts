import * as apm from 'elastic-apm-node';
import { Container } from 'typescript-ioc';
import { AppConfig } from './utils/AppConfig';

const config = Container.get(AppConfig) as AppConfig;

if (require.main === module) {
  const serverUrl = config.apm.server;
  if (serverUrl) {
    apm.start({
      serviceName: 'catalog',
      serverUrl,
    });
  }
  if (config.ddTraceEnabled) {
    // tslint:disable-next-line:no-var-requires
    require('dd-trace').init();
  }
}

import { Logger } from '@securustablets/libraries.logging';
import { CatalogService } from './CatalogService';
import { MessagingConfig } from './messaging/MessagingConfig';

export const catalogService = Container.get(CatalogService) as CatalogService;
export const app = catalogService.app;

if (require.main === module) {
  const logger = Container.get(Logger) as Logger;
  const port = config.listenPort;

  app.listen(port, () => {
    logger.notice(`Node env: ${process.env.NODE_ENV}`);
    logger.notice('Listening on ' + port);
    logger.notice('ElasticSearch: ' + config.elastic);
    logger.notice(
      'Postgres: ' + config.postgres.host + ':' + config.postgres.port,
    );
    logger.notice('Security public key: ' + config.security.jwt.publicKey);
    logger.notice('Signed Data private: ' + config.signedData.privateKey);
    logger.notice('Signed Data public: ' + config.signedData.publicKey);
    logger.notice('Signed Data expiry: ' + config.signedData.jwtExpiry);

    Container.get(MessagingConfig)
      .registerAndStart()
      .catch((err) => {
        logger.error('Error starting message broker', err);
        process.exit(-1);
      });
  });
}

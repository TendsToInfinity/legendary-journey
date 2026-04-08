import { Logger } from '@securustablets/libraries.logging';
import { ElasticsearchTestClient } from 'securus.tablets.elasticsearch.utils';
import { Container } from 'typescript-ioc';
import { AppConfig } from '../../src/utils/AppConfig';

const config = Container.get(AppConfig) as AppConfig;
const logger = Container.get(Logger);
export const esTestClient = new ElasticsearchTestClient({
  host: config.elastic,
});
export const esClient = esTestClient.client;

import './global.spec';

logger.notice(config.elastic);

export function describeEsIntegration(description: string, spec: () => void) {
  describe(description, function () {
    this.timeout(8000);

    beforeEach(() => {
      return esTestClient.wipe();
    });

    spec();
  });
}

export function refresh() {
  return <any>(
    esTestClient.client.indices.refresh({ index: '_all', force: true })
  );
}

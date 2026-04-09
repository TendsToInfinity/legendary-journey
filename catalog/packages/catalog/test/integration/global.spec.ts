import { CacheManager } from '@securustablets/libraries.cache';
import { MessagingManager } from '@securustablets/libraries.messaging';
import { PgSandbox, Waiter } from '@securustablets/libraries.utils-test';
import * as isPortReachable from 'is-port-reachable';
import { ElasticsearchTestClient } from 'securus.tablets.elasticsearch.utils';
import { Container } from 'typescript-ioc';
import { CatalogService } from '../../src/CatalogService';
import { MessagingConfig } from '../../src/messaging/MessagingConfig';
import { AppConfig } from '../../src/utils/AppConfig';

// Make sure dependent services are reachable.
before(async function () {
  this.timeout(60000);

  Container.get(CatalogService);
  const messagingConfig = Container.get(MessagingConfig);
  const waiter = Container.get(Waiter);
  const config = Container.get(AppConfig);
  const esClient = new ElasticsearchTestClient({ host: config.elastic });
  const rmqHost = config.rmq.host.replace(
    /(?:[a-zA-Z]:\/\/)?(?:(?:[^:]*:)[^@]*@)?([^:/]*).*$/,
    '$1',
  );
  const cacheTier3Host = config.cache.tier3.hosts?.[0];

  await waiter.waitUntil(
    async () => {
      if (!(await isPortReachable(5672, { host: rmqHost }))) {
        throw new Error('rabbit is not available');
      }
    },
    {
      name: 'rabbit',
      timeout: 30000,
      interval: 1000,
    },
  );

  await waiter.waitUntil(
    async () => {
      if (
        !(await isPortReachable(cacheTier3Host.port, {
          host: cacheTier3Host.url,
        }))
      ) {
        throw new Error('Tier 3 cache is not available');
      }
    },
    {
      name: 'Tier 3 Cache',
      timeout: 30000,
      interval: 1000,
    },
  );

  await waiter.waitUntil(() => messagingConfig.registerAndStart(), {
    name: 'messagingManager',
    timeout: 30000,
    interval: 1000,
  });

  await waiter.waitUntil(
    () => esClient.client.cluster.health({ waitForStatus: 'yellow' }),
    {
      name: 'esClient',
      timeout: 30000,
      interval: 1000,
    },
  );

  Container.get(PgSandbox).tables = [
    'product',
    'rule',
    'homepage',
    'fee',
    'audit_history',
    'block_action',
    'block_reason',
    'blocklist_term',
    'distinct_product_value',
    'future_product_change',
    'large_impact_event',
  ];
});

beforeEach(async () => {
  await Container.get(PgSandbox).wipe();
  await Container.get(CacheManager).flush();
});

after(async function () {
  this.timeout(60000);

  try {
    await Container.get(MessagingManager).shutdown();
  } catch (err) {
    /**/
  }
  try {
    await Container.get(CacheManager).disconnect();
  } catch (err) {
    /**/
  }
});

import * as tp from '@securustablets/libraries.pulumi';
import { BiService } from './BiService';
import { HttpService } from './HttpService';
import { PostDeploy } from './PostDeploy';
import { RmqService } from './RmqService';
import { SharedApiGateway } from './SharedApiGateway';
import { SharedSecrets } from './SharedSecrets';
import { SharedSqsQueue } from './SharedSqsQueue';
import { getAliases } from './aliases';
import { loadEnv } from './environment';
import { getImports } from './imports';

export = async () => {
  const config = loadEnv();
  tp.Aliases.register(getAliases());
  tp.Imports.register(await getImports(config));

  const auroraPostgres = new tp.AuroraPostgres(tp.name('postgres'));
  const elasticache = new tp.Elasticache(tp.name('elasticache'));
  const rmqElasticache = config.lookup(
    'ELASTICACHE_DEDICATED_RMQ_CLUSTER_ENABLED',
  )
    ? new tp.Elasticache(tp.name('rmq'))
    : elasticache;
  const opensearch = new tp.Opensearch(tp.name('opensearch'));

  const catalogTaskImage = new tp.BundledContainerImage(
    tp.name('catalog-task'),
    {
      packageName: 'catalog-task',
    },
  );
  const ecsCluster = new tp.EcsCluster(tp.name('ecs-cluster'));
  const sharedSecrets = new SharedSecrets(tp.name('shared-secrets'));
  const sharedApiGateway = new SharedApiGateway(tp.name('shared-api-gateway'));
  const sharedSqsQueue = new SharedSqsQueue(tp.name('shared-sqs-queue'));
  const httpService = new HttpService(tp.name('http'), {
    ecsCluster,
    image: catalogTaskImage,
    auroraPostgres,
    elasticache,
    opensearch,
    sharedApiGateway,
    sharedSecrets,
    sharedSqsQueue,
  });
  const rmqService = new RmqService(tp.name('rmq'), {
    ecsCluster,
    image: catalogTaskImage,
    auroraPostgres,
    elasticache: rmqElasticache,
    opensearch,
    sharedApiGateway,
    sharedSecrets,
    sharedSqsQueue,
  });
  const biService = new BiService(tp.name('bi'), {
    ecsCluster,
    image: catalogTaskImage,
    auroraPostgres,
    elasticache,
    opensearch,
    sharedApiGateway,
    sharedSecrets,
    sharedSqsQueue,
  });
  const postDeploy = new PostDeploy(tp.name('post-deploy'), {
    ecsCluster,
    image: catalogTaskImage,
    auroraPostgres,
    elasticache,
    opensearch,
    sharedApiGateway,
    sharedSecrets,
    sharedSqsQueue,
  });

  return {
    domainName: httpService.alb.domainName,
    aurora: {
      writeHost: auroraPostgres.writeHost,
      readHost: auroraPostgres.readHost,
    },
    lambda: {
      bootstrap: postDeploy.lambdaBootstrap.lambda.name,
      migrate: postDeploy.lambdaMigrate.lambda.name,
    },
  };
};

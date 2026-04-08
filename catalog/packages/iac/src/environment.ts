import * as tp from '@securustablets/libraries.pulumi';
import * as dotenv from 'dotenv';
import { bool } from 'envalid';
import * as execa from 'execa';
import * as fs from 'fs';
import * as _ from 'lodash';
import * as path from 'path';
import { BiService } from './BiService';
import { HttpService } from './HttpService';
import { PostDeploy } from './PostDeploy';
import { RmqService } from './RmqService';
import { SharedApiGateway } from './SharedApiGateway';
import { SharedSecrets } from './SharedSecrets';
import { SharedSqsQueue } from './SharedSqsQueue';

export function loadEnv() {
  // We must manually parse this from process.env as it's needed before the call to dotenv/envsafe.
  const dotenvConfigPath =
    process.env.DOTENV_CONFIG_PATH ?? path.join(findProjectRoot(), '.env');
  dotenv.config({ path: dotenvConfigPath });

  // Initialize @securustablets/libraries.pulumi.
  return tp.Environment.load(process.env, validators());
}

export function cliValidators() {
  return tp.cli.validators();
}

export function validators() {
  return tp.Validators.merge(
    {
      ELASTICACHE_DEDICATED_RMQ_CLUSTER_ENABLED: bool({
        desc:
          'Enables a dedicated elasticache cluster for the RMQ ECS Service. ' +
          'When enabled, the `RMQ_ELASTICACHE_*` variables may be used to specifically configure this cluster, ' +
          'and the `ELASTICACHE_ELASTICACHE_*` variables may be used to specifically configure the other/default cluster.',
        default: false,
      }),
      ...tp.Global.envValidators(),
      ...tp.BundledContainerImage.envValidators('catalog-task'),
      ...tp.AuroraPostgres.envValidators('postgres'),
      ...tp.Elasticache.envValidators('elasticache'),
      ...tp.Elasticache.envValidators('rmq'),
      ...tp.Opensearch.envValidators('opensearch'),
      ...SharedApiGateway.envValidators('shared-api-gateway'),
      ...SharedSecrets.envValidators('shared-secrets'),
      ...SharedSqsQueue.envValidators('shared-sqs-queue'),
      ...HttpService.envValidators('http'),
      ...RmqService.envValidators('rmq'),
      ...BiService.envValidators('bi'),
      ...PostDeploy.envValidators('post-deploy'),
    },
    {
      APPLICATION_NAME: {
        default: 'catalog',
      },
      AURORA_CREATE_DATABASE: {
        default: false,
      },
      AURORA_DATABASE_NAME: {
        default: 'catalog',
      },
      AURORA_SERVICE_USER: {
        default: 'catalog_user',
      },
      ALB_ROUTE53_SUBDOMAIN: {
        default: 'catalog',
      },
      OPENSEARCH_ROUTE53_SUBDOMAIN: {
        default: 'catalogsearch',
      },
      AURORA_CDC_USER: {
        default: 'catalog_cdc_user',
      },
    },
  );
}

function getWorkspaces() {
  return execa
    .sync('yarn', ['workspaces', 'list', '--json'])
    .stdout.split('\n')
    .map((line) => JSON.parse(line));
}

function findProjectRoot() {
  const rootWorkspaceName = _.find(getWorkspaces(), { location: '.' }).name;
  let cwd = process.cwd();
  do {
    const thisPkgJsonPath = path.join(cwd, 'package.json');
    if (fs.existsSync(thisPkgJsonPath)) {
      const thisPkgJson = JSON.parse(
        fs.readFileSync(thisPkgJsonPath).toString(),
      );
      if (thisPkgJson.name === rootWorkspaceName) {
        return path.dirname(thisPkgJsonPath);
      }
    }
    cwd = path.dirname(cwd);
  } while (path.dirname(cwd) !== cwd);
  throw Error();
}

import * as pulumi from '@pulumi/pulumi';
import * as tp from '@securustablets/libraries.pulumi';
import { NodeConfig } from './NodeConfig';
import { SharedApiGateway } from './SharedApiGateway';
import { SharedSecrets } from './SharedSecrets';
import { SharedSqsQueue } from './SharedSqsQueue';

export interface RmqServiceEnv {}
export interface RmqServiceArgs {
  ecsCluster: tp.EcsCluster;
  image: tp.ContainerImage;
  auroraPostgres: tp.AuroraPostgres;
  elasticache: tp.Elasticache;
  opensearch: tp.Opensearch;
  sharedApiGateway: SharedApiGateway;
  sharedSecrets: SharedSecrets;
  sharedSqsQueue: SharedSqsQueue;
}

export class RmqService extends tp.TpComponentResource<
  RmqServiceArgs,
  RmqServiceEnv
> {
  constructor(
    name: string,
    args: RmqServiceArgs,
    opts?: pulumi.ComponentResourceOptions,
  ) {
    super('catalog:RmqService:RmqService', name, args, opts);
    const rmqNodeConfig = new NodeConfig(
      tp.name(this.shortName),
      {
        auroraPostgres: this.args.auroraPostgres,
        elasticache: this.args.elasticache,
        opensearch: this.args.opensearch,
        sharedSqsQueue: this.args.sharedSqsQueue,
        disableSubscriptions: false,
      },
      { parent: this },
    );

    const rmqTask = new tp.EcsTask(
      tp.name(this.shortName),
      {
        image: this.args.image,
        taskRoleManagedPolicyArns: [
          this.args.sharedApiGateway.accessPolicy.arn,
          this.args.sharedSqsQueue.accessPolicy.arn,
        ],
        secrets: [
          {
            name: 'NODE_CONFIG',
            value: rmqNodeConfig.secret,
            ...this.args.sharedSecrets.secrets,
          },
        ],
      },
      { parent: this },
    );

    const rmqService = new tp.EcsService(
      tp.name(this.shortName),
      {
        ecsCluster: this.args.ecsCluster.cluster,
        task: rmqTask,
      },
      { parent: this },
    );
  }

  static envValidators(name: string): tp.Validators<RmqServiceEnv> {
    return {
      ...NodeConfig.envValidators(name),
      ...tp.EcsTask.envValidators(name),
      ...tp.EcsService.envValidators(name),
    };
  }
}

import * as pulumi from '@pulumi/pulumi';
import * as tp from '@securustablets/libraries.pulumi';
import { NodeConfig } from './NodeConfig';
import { SharedApiGateway } from './SharedApiGateway';
import { SharedSecrets } from './SharedSecrets';
import { SharedSqsQueue } from './SharedSqsQueue';

export interface BiServiceEnv {}

export interface BiServiceArgs {
  ecsCluster: tp.EcsCluster;
  image: tp.ContainerImage;
  auroraPostgres: tp.AuroraPostgres;
  elasticache: tp.Elasticache;
  opensearch: tp.Opensearch;
  sharedApiGateway: SharedApiGateway;
  sharedSecrets: SharedSecrets;
  sharedSqsQueue: SharedSqsQueue;
}

export class BiService extends tp.TpComponentResource<
  BiServiceArgs,
  BiServiceEnv
> {
  public alb: tp.Alb;

  constructor(
    name: string,
    args: BiServiceArgs,
    opts?: pulumi.ComponentResourceOptions,
  ) {
    super('catalog:BiService:BiService', name, args, opts);
    const httpPort = new tp.EcsTaskExposePort(
      tp.name(this.shortName),
      undefined,
      { parent: this },
    );

    const biNodeConfig = new NodeConfig(
      tp.name(this.shortName),
      {
        auroraPostgres: this.args.auroraPostgres,
        elasticache: this.args.elasticache,
        opensearch: this.args.opensearch,
        sharedSqsQueue: this.args.sharedSqsQueue,
        disableSubscriptions: true,
        port: httpPort,
      },
      { parent: this },
    );

    const biTask = new tp.EcsTask(
      tp.name(this.shortName),
      {
        image: this.args.image,
        port: httpPort,
        taskRoleManagedPolicyArns: [
          this.args.sharedApiGateway.accessPolicy.arn,
          this.args.sharedSqsQueue.accessPolicy.arn,
        ],
        secrets: [
          {
            name: 'NODE_CONFIG',
            value: biNodeConfig.secret,
          },
          ...this.args.sharedSecrets.secrets,
        ],
      },
      { parent: this },
    );

    this.alb = new tp.Alb(
      tp.name(this.shortName),
      {
        task: biTask,
      },
      { parent: this },
    );

    const biService = new tp.EcsService(
      tp.name(this.shortName),
      {
        ecsCluster: this.args.ecsCluster.cluster,
        task: biTask,
        alb: this.alb,
      },
      { parent: this },
    );
  }

  static envValidators(name: string): tp.Validators<BiServiceEnv> {
    return tp.Validators.merge(
      {
        ...NodeConfig.envValidators(name),
        ...tp.EcsTaskExposePort.envValidators(name),
        ...tp.EcsTask.envValidators(name),
        ...tp.Alb.envValidators(name),
        ...tp.EcsService.envValidators(name),
      },
      {
        BI_ALB_ROUTE53_SUBDOMAIN: {
          default: 'bicatalog',
        },
      },
    );
  }
}

import * as pulumi from '@pulumi/pulumi';
import * as tp from '@securustablets/libraries.pulumi';
import { NodeConfig } from './NodeConfig';
import { SharedApiGateway } from './SharedApiGateway';
import { SharedSecrets } from './SharedSecrets';
import { SharedSqsQueue } from './SharedSqsQueue';

export interface HttpServiceEnv extends tp.AlbEnv {}
export interface HttpServiceArgs {
  ecsCluster: tp.EcsCluster;
  image: tp.ContainerImage;
  auroraPostgres: tp.AuroraPostgres;
  elasticache: tp.Elasticache;
  opensearch: tp.Opensearch;
  sharedApiGateway: SharedApiGateway;
  sharedSecrets: SharedSecrets;
  sharedSqsQueue: SharedSqsQueue;
}

export class HttpService extends tp.TpComponentResource<
  HttpServiceArgs,
  HttpServiceEnv
> {
  public alb: tp.Alb;

  constructor(
    name: string,
    args: HttpServiceArgs,
    opts?: pulumi.ComponentResourceOptions,
  ) {
    super('catalog:HttpService:HttpService', name, args, opts);

    const httpPort = new tp.EcsTaskExposePort(
      tp.name(this.shortName),
      undefined,
      { parent: this },
    );

    const httpNodeConfig = new NodeConfig(
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

    const httpTask = new tp.EcsTask(
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
            value: httpNodeConfig.secret,
          },
          ...this.args.sharedSecrets.secrets,
        ],
      },
      { parent: this },
    );

    this.alb = new tp.Alb(
      tp.name(this.shortName),
      {
        task: httpTask,
      },
      { parent: this },
    );

    const httpService = new tp.EcsService(
      tp.name(this.shortName),
      {
        ecsCluster: this.args.ecsCluster.cluster,
        task: httpTask,
        alb: this.alb,
      },
      { parent: this },
    );
  }

  static envValidators(name: string): tp.Validators<HttpServiceEnv> {
    return {
      ...NodeConfig.envValidators(name),
      ...tp.EcsTaskExposePort.envValidators(name),
      ...tp.EcsTask.envValidators(name),
      ...tp.Alb.envValidators(name),
      ...tp.EcsService.envValidators(name),
    };
  }
}

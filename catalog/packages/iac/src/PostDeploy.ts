import * as pulumi from '@pulumi/pulumi';
import * as tp from '@securustablets/libraries.pulumi';
import { DbMigrationTask } from './DbMigrationTask';
import { SharedApiGateway } from './SharedApiGateway';
import { SharedSecrets } from './SharedSecrets';
import { SharedSqsQueue } from './SharedSqsQueue';

export interface PostDeployEnv {}

export interface PostDeployArgs {
  ecsCluster: tp.EcsCluster;
  image: tp.ContainerImage;
  auroraPostgres: tp.AuroraPostgres;
  elasticache: tp.Elasticache;
  opensearch: tp.Opensearch;
  sharedApiGateway: SharedApiGateway;
  sharedSecrets: SharedSecrets;
  sharedSqsQueue: SharedSqsQueue;
}

export class PostDeploy extends tp.TpComponentResource<
  PostDeployArgs,
  PostDeployEnv
> {
  public lambdaBootstrap: tp.LambdaBootstrap;
  public lambdaMigrate: tp.LambdaMigrate;

  constructor(
    name: string,
    args: PostDeployArgs,
    opts?: pulumi.ComponentResourceOptions,
  ) {
    super('catalog:PostDeploy:PostDeploy', name, args, opts);

    const dbMigrationTask = new DbMigrationTask(
      tp.name('db-migration'),
      {
        image: this.args.image,
        auroraPostgres: this.args.auroraPostgres,
        elasticache: this.args.elasticache,
        opensearch: this.args.opensearch,
        sharedApiGateway: this.args.sharedApiGateway,
        sharedSecrets: this.args.sharedSecrets,
        sharedSqsQueue: this.args.sharedSqsQueue,
      },
      { parent: this },
    );

    this.lambdaBootstrap = new tp.LambdaBootstrap(
      tp.name('lambda-bootstrap'),
      {
        auroraPostgres: this.args.auroraPostgres,
      },
      { parent: this },
    );

    this.lambdaMigrate = new tp.LambdaMigrate(
      tp.name('lambda-migrate'),
      {
        cluster: this.args.ecsCluster,
        taskDefinition: dbMigrationTask.task,
      },
      { parent: this },
    );
  }

  static envValidators(name: string): tp.Validators<PostDeployEnv> {
    return {
      ...DbMigrationTask.envValidators('db-migration'),
      ...tp.LambdaBootstrap.envValidators('lambda-bootstrap'),
      ...tp.LambdaMigrate.envValidators('lambda-migrate'),
    };
  }
}

import * as pulumi from '@pulumi/pulumi';
import * as tp from '@securustablets/libraries.pulumi';
import { NodeConfig } from './NodeConfig';
import { SharedApiGateway } from './SharedApiGateway';
import { SharedSecrets } from './SharedSecrets';
import { SharedSqsQueue } from './SharedSqsQueue';

export interface DbMigrationTaskEnv {}
export interface DbMigrationTaskArgs {
  image: tp.ContainerImage;
  auroraPostgres: tp.AuroraPostgres;
  elasticache: tp.Elasticache;
  opensearch: tp.Opensearch;
  sharedApiGateway: SharedApiGateway;
  sharedSecrets: SharedSecrets;
  sharedSqsQueue: SharedSqsQueue;
}

export class DbMigrationTask extends tp.TpComponentResource<
  DbMigrationTaskArgs,
  DbMigrationTaskEnv
> {
  public task: tp.EcsTask;

  constructor(
    name: string,
    args: DbMigrationTaskArgs,
    opts?: pulumi.ComponentResourceOptions,
  ) {
    super('catalog:DbMigrationTask:DbMigrationTask', name, args, opts);
    const dbMigrationNodeConfig = new NodeConfig(
      tp.name(this.shortName),
      {
        auroraPostgres: this.args.auroraPostgres,
        elasticache: this.args.elasticache,
        opensearch: this.args.opensearch,
        sharedSqsQueue: this.args.sharedSqsQueue,
        disableSubscriptions: true,
      },
      { parent: this },
    );

    this.task = new tp.EcsTask(
      tp.name(this.shortName),
      {
        image: this.args.image,
        taskRoleManagedPolicyArns: [
          this.args.sharedApiGateway.accessPolicy.arn,
          this.args.sharedSqsQueue.accessPolicy.arn,
        ],
        command: ['yarn', 'db:init'],
        secrets: [
          {
            name: 'NODE_CONFIG',
            value: dbMigrationNodeConfig.secret,
            ...this.args.sharedSecrets.secrets,
          },
        ],
      },
      { parent: this },
    );
  }

  static envValidators(name: string): tp.Validators<DbMigrationTaskEnv> {
    return {
      ...NodeConfig.envValidators(name),
      ...tp.EcsTask.envValidators(name),
    };
  }
}

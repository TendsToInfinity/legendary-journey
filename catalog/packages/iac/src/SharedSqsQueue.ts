import * as aws from '@pulumi/aws';
import * as pulumi from '@pulumi/pulumi';
import * as tp from '@securustablets/libraries.pulumi';
import { str } from 'envalid';

export interface SharedSqsQueueEnv extends tp.GlobalEnv {
  SHARED_SQS_QUEUE_NAME: string | undefined;
}
export interface SharedSqsQueueArgs {}

export class SharedSqsQueue extends tp.TpComponentResource<
  SharedSqsQueueArgs,
  SharedSqsQueueEnv
> {
  public queueName: string;
  public accessPolicy: aws.iam.Policy;

  constructor(
    name: string,
    args: SharedSqsQueueArgs = {},
    opts?: pulumi.ComponentResourceOptions,
  ) {
    super('catalog:SharedSqsQueue:SharedSqsQueue', name, args, opts);

    const queueName =
      this.config.lookup('SHARED_SQS_QUEUE_NAME') ??
      `cidn-music-am-ingestion-song-sample-queue-${this.config.lookup('APPLICATION_ENVIRONMENT')}`;
    const sqsQue = aws.sqs.getQueueOutput({ name: queueName });
    const sqsPolicy = new aws.iam.Policy(
      tp.name('sqs'),
      {
        policy: aws.iam.getPolicyDocumentOutput({
          statements: [
            {
              actions: ['sqs:SendMessage'],
              resources: [sqsQue.arn],
            },
          ],
        }).json,
      },
      { parent: this },
    );

    this.queueName = queueName;
    this.accessPolicy = sqsPolicy;
  }

  static envValidators(name: string): tp.Validators<SharedSqsQueueEnv> {
    return {
      ...tp.Global.envValidators(),
      SHARED_SQS_QUEUE_NAME: str({
        desc:
          'Name of the SQS queue used by the application. Access to this queue is automatically added to the task roles for the ECS containers, and the ' +
          'value of this environment variable is sent to the ECS containers as `sqsConfig.queueName`. ' +
          'When not provided, defaults to `cidn-music-am-ingestion-song-sample-queue-${APPLICATION_ENVIRONMENT}`. ' +
          'To enable/disable SQS features within the container, see `$NODE_CONFIG_SQS_CONFIG_SQS_ENABLED`.',
        default: undefined,
      }),
    };
  }
}

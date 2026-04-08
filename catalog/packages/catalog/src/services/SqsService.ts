import { Logger } from '@securustablets/libraries.logging';
import * as AWS from 'aws-sdk';
import { Inject, Singleton } from 'typescript-ioc';
import { AppConfig } from '../utils/AppConfig';

@Singleton
export class SqsService {
  @Inject
  private logger!: Logger;

  @Inject
  private config!: AppConfig;

  private readonly aws = AWS;
  private sqs: AWS.SQS;
  private queueURL?: string;

  /**
   * Initialize the SQS connection
   */
  public async init() {
    this.logger.info(`Setting up aws sqs connection...`);

    if (!this.sqs) {
      this.logger.info(`Setting up aws sqs instance...`);
      const region = this.aws.config.region;
      this.sqs = new this.aws.SQS({
        region,
        apiVersion: '2012-11-05',
        ...(process.env.AWS_SQS_ENDPOINT && {
          endpoint: process.env.AWS_SQS_ENDPOINT,
        }), // localstack sqs this env should not be added in any formal envs
      });
    }

    if (!this.queueURL) {
      this.logger.info(`Getting queue URL by provided queue name...`);

      const { queueName } = this.config.sqsConfig;
      this.logger.info(`Queue name: ${queueName}`);

      const { QueueUrl } = await this.sqsGetQueueUrl({ QueueName: queueName });
      if (!QueueUrl) {
        throw new Error(`SQS Queue: ${queueName} does not exist!`);
      }

      this.logger.info(`Queue exists: ${QueueUrl}`);
      this.queueURL = QueueUrl;
    }
  }

  /**
   * Prepare a message for SQS.
   * It will use any object you pass here as a stringify message to AWS SQS
   * @param job
   * @returns
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public async sendJob(job: any) {
    if (!this.config.sqsConfig.sqsEnabled) {
      this.logger.error('SQS is disabled!');
      throw new Error('SQS is disabled!');
    }
    if (!this.queueURL) {
      this.logger.error('SQS queue url not ready! Restarting service...');
      await this.init().catch((err) => {
        this.logger.error(`Error initializing SQS: ${err.message}`, err);
        throw new Error(
          `SQS queue url not ready! Message not sent! Message ${JSON.stringify(job)}`,
        );
      });
    }
    const params: AWS.SQS.SendMessageRequest = {
      MessageAttributes: {},
      MessageBody: JSON.stringify(job),
      QueueUrl: this.queueURL,
    };
    return this.sqsSendMessage(params);
  }

  /**
   * Send a message to SQS
   * @param params
   * @returns
   */
  private async sqsSendMessage(params: AWS.SQS.SendMessageRequest) {
    this.logger.debug(
      `Begin sqs:"${params.QueueUrl}" args:${params.MessageBody}`,
    );
    return new Promise<AWS.SQS.SendMessageResult>((resolve, reject) => {
      this.sqs.sendMessage(params, (err, data) => {
        if (err) {
          this.logger.error(
            `sqsSendMessage - error. ${err}. Message URL: ${params.QueueUrl}, Message: ${params.MessageBody}`,
          );
          return reject(err);
        }
        return resolve(data);
      });
    });
  }

  /**
   * Retrieve SQS URL by queue name
   * @param params
   * @returns
   */
  private async sqsGetQueueUrl(params: AWS.SQS.GetQueueUrlRequest) {
    return new Promise<AWS.SQS.GetQueueUrlResult>((resolve, reject) => {
      this.sqs.getQueueUrl(params, (err, data) => {
        if (err) {
          this.logger.error(`sqsGetQueueUrl - error: ${err}`);
          return reject(err);
        }
        return resolve(data);
      });
    });
  }
}

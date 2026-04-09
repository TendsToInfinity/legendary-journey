import * as AWS from 'aws-sdk';
import { expect } from 'chai';
import * as sinon from 'sinon';
import { SqsService } from '../../../src/services/SqsService';

const queueName = 'test-queue';
const sqsResponse = { MessageId: '12345' };
const QueueUrl = 'https://sqs.us-east-1.amazonaws.com/123456789012/test-queue';
const job = { test: 'test' };

const messageParams: AWS.SQS.SendMessageRequest = {
  MessageAttributes: {},
  MessageBody: JSON.stringify(job),
  QueueUrl,
};

const getQueueUrlParams: AWS.SQS.GetQueueUrlRequest = {
  QueueName: queueName,
};
const sendMessageError = 'Error - sendMessage';

describe('SqsService - unit', () => {
  let sqsService: SqsService;
  let mockConfig: sinon.SinonMock;
  let mockLogger: sinon.SinonMock;
  let mockSqsService: sinon.SinonMock;

  const sqsMock = {
    getQueueUrl: (params: AWS.SQS.GetQueueUrlRequest, cb: any) => {
      // verify the params = const params
      expect(params).to.be.deep.equal(getQueueUrlParams);
      cb(null, { QueueUrl });
    },
    sendMessage: (params: AWS.SQS.SendMessageRequest, cb: any) => {
      expect(params).to.be.deep.equal(messageParams);
      cb(null, sqsResponse);
    },
  };

  const sqsMockReject = {
    getQueueUrl: (params: AWS.SQS.GetQueueUrlRequest, cb: any) => {
      expect(params).to.be.deep.equal(getQueueUrlParams);
      cb(null, { QueueUrl: undefined });
    },
    sendMessage: (params: AWS.SQS.SendMessageRequest, cb: any) => {
      expect(params).to.be.deep.equal(messageParams);
      cb(new Error(sendMessageError), null);
    },
  };

  beforeEach(() => {
    sqsService = new SqsService();
    mockSqsService = sinon.mock(sqsService as any);

    mockConfig = sinon.mock((sqsService as any).config);
    mockLogger = sinon.mock((sqsService as any).logger);
    (sqsService as any).aws.config.region = 'us-east-1';
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('constructor', () => {
    it('should create a new instance of SqsService', () => {
      expect(sqsService).to.be.instanceOf(SqsService);
    });
    it('should use local env to create an sqsInstance for local integration tests', () => {
      const localEnvs = { ...process.env };
      process.env.AWS_SQS_ENDPOINT = 'http://localhost:4566';
      sqsService = new SqsService();
      sqsService.init();
      expect((sqsService as any).sqs.config.endpoint).to.be.equal(
        process.env.AWS_SQS_ENDPOINT,
      );
      process.env = { ...localEnvs };
    });
  });

  describe('init', () => {
    it('should initialize the SQS connection only once', async () => {
      mockConfig
        .expects('get')
        .withExactArgs('sqsConfig')
        .returns({ queueName, sqsEnabled: true });

      mockLogger
        .expects('info')
        .twice()
        .withExactArgs('Setting up aws sqs connection...');
      mockLogger
        .expects('info')
        .withExactArgs('Setting up aws sqs instance...');
      mockLogger
        .expects('info')
        .withExactArgs('Getting queue URL by provided queue name...');
      mockSqsService
        .expects('sqsGetQueueUrl')
        .once()
        .withExactArgs({ QueueName: queueName })
        .resolves({ QueueUrl });
      mockLogger
        .expects('info')
        .once()
        .withExactArgs(`Queue name: ${queueName}`);
      mockLogger
        .expects('info')
        .once()
        .withExactArgs(`Queue exists: ${QueueUrl}`);

      await sqsService.init();
      // second time should not call the sqsGetQueueUrl or set up sqs instance
      await sqsService.init();

      mockLogger.verify();
      mockSqsService.verify();
    });

    it('should throw error if SQS queue does not exist', async () => {
      mockConfig
        .expects('get')
        .withExactArgs('sqsConfig')
        .returns({ queueName, sqsEnabled: true });

      mockSqsService
        .expects('sqsGetQueueUrl')
        .withExactArgs({ QueueName: queueName })
        .resolves({ QueueUrl: undefined });

      try {
        await sqsService.init();
      } catch (error) {
        expect(error).to.be.instanceOf(Error);
        expect(error.message).to.be.equal(
          `SQS Queue: ${queueName} does not exist!`,
        );
      }
    });
  });

  describe('sendJob', () => {
    it('should init the sqs service if not yet exist', async () => {
      // replace the method with success reply
      (sqsService as any).sqs = sqsMock;

      mockConfig
        .expects('get')
        .twice()
        .withExactArgs('sqsConfig')
        .returns({ queueName, sqsEnabled: true });

      mockLogger
        .expects('info')
        .once()
        .withExactArgs('Setting up aws sqs connection...');
      mockLogger
        .expects('info')
        .once()
        .withExactArgs('Getting queue URL by provided queue name...');
      mockLogger
        .expects('info')
        .once()
        .withExactArgs(`Queue name: ${queueName}`);
      mockLogger
        .expects('info')
        .once()
        .withExactArgs(`Queue exists: ${QueueUrl}`);

      const result = await sqsService.sendJob(job);
      mockLogger.verify();
      mockSqsService.verify();
      expect(result).to.be.deep.equal(sqsResponse);
    });

    it('should reuse the existing queue url', async () => {
      mockConfig
        .expects('get')
        .withExactArgs('sqsConfig')
        .returns({ queueName, sqsEnabled: true });
      mockSqsService.expects('sqsGetQueueUrl').never();
      mockSqsService
        .expects('sqsSendMessage')
        .withExactArgs(messageParams)
        .resolves({});

      (sqsService as any).queueURL = QueueUrl;
      await sqsService.sendJob(job);
      mockSqsService.verify();
    });

    it('should throw if sqs is disabled', async () => {
      mockConfig
        .expects('get')
        .withExactArgs('sqsConfig')
        .returns({ queueName, sqsEnabled: false });

      try {
        await sqsService.sendJob(job);
      } catch (error) {
        expect(error).to.be.instanceOf(Error);
        expect(error.message).to.be.equal('SQS is disabled!');
      }
    });

    it('should try to init the sqs service if not yet exist and log error if not available', async () => {
      mockConfig
        .expects('get')
        .twice()
        .withExactArgs('sqsConfig')
        .returns({ queueName, sqsEnabled: true });
      mockLogger.expects('error').atLeast(2);

      // getQueueUrl is not mocked and will fail for the test data
      try {
        await sqsService.sendJob(job);
      } catch (error) {
        expect(error).to.be.instanceOf(Error);
        expect(error.message).to.be.equal(
          `SQS queue url not ready! Message not sent! Message ${JSON.stringify(job)}`,
        );
      }
    });

    it('should try to send message and log error if send job failed', async () => {
      mockConfig
        .expects('get')
        .twice()
        .withExactArgs('sqsConfig')
        .returns({ queueName, sqsEnabled: true });

      (sqsService as any).queueURL = QueueUrl;
      (sqsService as any).sqs = sqsMockReject;
      mockLogger
        .expects('error')
        .once()
        .withExactArgs(
          `sqsSendMessage - error. Error: ${sendMessageError}. Message URL: ${QueueUrl}, Message: ${JSON.stringify(job)}`,
        );

      try {
        await sqsService.sendJob(job);
      } catch (error) {
        expect(error).to.be.instanceOf(Error);
        expect(error.message).to.be.equal(sendMessageError);
      }
    });
  });
});

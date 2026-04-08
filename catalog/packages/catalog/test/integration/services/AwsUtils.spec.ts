import * as awssdk from 'aws-sdk';
import { assert, expect } from 'chai';
import * as sinon from 'sinon';
import { AwsUtils } from '../../../src/services/AwsUtils';

describe('AwsUtils - Integration', () => {
  let awsUtils: AwsUtils;
  let mockAWSConfig: sinon.SinonMock;
  let mockLogger: sinon.SinonMock;

  beforeEach(() => {
    awsUtils = new AwsUtils();
    mockAWSConfig = sinon.mock((awsUtils as any).aws.config);
    mockLogger = sinon.mock((awsUtils as any).logger);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('#constructor', () => {
    it('should get aws config', () => {
      expect(awsUtils).to.be.instanceOf(AwsUtils);
      expect((awsUtils as any).aws.config).to.be.equal(awssdk.config);
    });
  });
  describe('getAWSCredentials', () => {
    it('should return aws credentials', async () => {
      mockAWSConfig.expects('getCredentials').yields(null, {
        accessKeyId: 'accessKeyId',
        secretAccessKey: 'secretAccessKey',
        sessionToken: 'sessionToken',
      });
      const credentials = await awsUtils.getAWSCredentials();
      expect(credentials).not.to.be.null;
      expect(credentials.accessKeyId).not.to.be.null;
      expect(credentials.secretAccessKey).not.to.be.null;
      expect(credentials.sessionToken).not.to.be.null;
      sinon.verify();
    });

    it('should handle error while getting aws credentials', async () => {
      const err = new Error('No IAM credentials provided for ART Approval API');
      mockAWSConfig.expects('getCredentials').yields(err, null);
      mockLogger
        .expects('error')
        .withExactArgs(`get aws credentials error: ${err.message}`, err);
      try {
        await awsUtils.getAWSCredentials();
        assert.fail('No IAM credentials provided for ART Approval API');
      } catch (error) {
        expect(error).to.be.instanceOf(Error);
        expect(error.message).to.be.equal(
          'No IAM credentials provided for ART Approval API',
        );
      }
      sinon.verify();
    });
  });
});

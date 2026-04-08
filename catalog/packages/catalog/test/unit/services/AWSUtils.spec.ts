import * as awssdk from 'aws-sdk';
import * as aws4 from 'aws4';
import { assert, expect } from 'chai';
import * as sinon from 'sinon';
import { AwsUtils } from '../../../src/services/AwsUtils';

describe('AwsUtils - unit', () => {
  let awsUtils: AwsUtils;
  let mockAWSConfig: sinon.SinonMock;
  let mockLogger: sinon.SinonMock;
  let mockAWSUtils: sinon.SinonMock;
  let mockAws4: sinon.SinonMock;

  beforeEach(() => {
    awsUtils = new AwsUtils();
    mockAWSConfig = sinon.mock((awsUtils as any).aws.config);
    mockLogger = sinon.mock((awsUtils as any).logger);
    mockAWSUtils = sinon.mock(awsUtils as any);
    mockAws4 = sinon.mock(aws4);
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
      expect(credentials).to.be.deep.equal({
        accessKeyId: 'accessKeyId',
        secretAccessKey: 'secretAccessKey',
        sessionToken: 'sessionToken',
      });
      sinon.verify();
    });

    it('should handle error while getting aws credentials', async () => {
      const err = new Error('should throw error');
      mockAWSConfig.expects('getCredentials').yields(err, null);
      mockLogger
        .expects('error')
        .withExactArgs(`get aws credentials error: ${err.message}`, err);
      try {
        await awsUtils.getAWSCredentials();
        assert.fail('No IAM credentials provided for ART Approval API');
      } catch (error) {
        expect(error).to.be.instanceOf(Error);
        expect(error.message).to.be.contains(
          'No IAM credentials provided for ART Approval API',
        );
      }
      sinon.verify();
    });
  });

  describe('awsSignedRequest', () => {
    it('should return aws signed request for axios', async () => {
      const awsIamConfig = {
        accessKeyId: 'accessKeyId',
        secretAccessKey: 'secretAccessKey',
        sessionToken: 'sessionToken',
      };
      const apiUrl = 'http://localhost:8080/api/v1/something';
      const data = { productId: 1 };
      const url = new URL(apiUrl);
      const request = {
        url: url.toString(),
        responseType: 'json',
        method: 'POST',
        data,
        host: url.host,
        body: JSON.stringify(data),
        path: url.pathname,
        headers: {
          'content-type': 'application/json',
        },
      };

      mockAWSUtils.expects('getAWSCredentials').resolves(awsIamConfig);
      mockAws4.expects('sign').withArgs(request, awsIamConfig).returns(request);

      const signedRequest = await awsUtils.awsSignedRequest(request);
      expect(signedRequest).to.be.deep.equal(request);
      mockAWSUtils.verify();
    });
  });
});

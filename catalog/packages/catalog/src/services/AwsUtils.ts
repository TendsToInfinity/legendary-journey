import { Logger } from '@securustablets/libraries.logging';
import * as AWS from 'aws-sdk';
import { CredentialsOptions } from 'aws-sdk/lib/credentials';
import * as aws4 from 'aws4';
import { Method, ResponseType } from 'axios';
import { Inject, Singleton } from 'typescript-ioc';
@Singleton
export class AwsUtils {
  @Inject
  private logger!: Logger;

  private readonly aws = AWS;

  /**
   * this method will only return credentials in AWS environment
   */
  public async getAWSCredentials(): Promise<CredentialsOptions> {
    const awsCreds: CredentialsOptions = await new Promise(
      (resolve, reject) => {
        this.aws.config.getCredentials((err, credentials) => {
          if (err) {
            this.logger.error(`get aws credentials error: ${err.message}`, err);
            reject(
              new Error('No IAM credentials provided for ART Approval API'),
            );
          }
          resolve(credentials);
        });
      },
    );
    return awsCreds;
  }

  /**
   * this method return a signed aws request for axios
   * @param request object for axios
   */
  public async awsSignedRequest(request: aws4.Request): Promise<aws4.Request> {
    const awsCredentials = await this.getAWSCredentials();
    const { accessKeyId, secretAccessKey, sessionToken } = awsCredentials;

    const signedRequest = aws4.sign(request, {
      secretAccessKey,
      accessKeyId,
      sessionToken,
    });
    return signedRequest;
  }

  /**
   * this method commonly used for aws request
   * @param data object to be post
   * @param apiUrl api endpoint
   */
  public adjustAxiosPostForAWS(data: object, apiUrl: string) {
    const url = new URL(apiUrl);
    return {
      url: url.toString(),
      responseType: 'json' as ResponseType,
      method: 'POST' as Method,
      data,
      host: url.host,
      body: JSON.stringify(data),
      path: url.pathname,
      headers: {
        'content-type': 'application/json',
      },
    };
  }
}

import * as aws from '@pulumi/aws';
import * as pulumi from '@pulumi/pulumi';
import * as tp from '@securustablets/libraries.pulumi';
import { str } from 'envalid';

export interface SharedSecretsEnv extends tp.GlobalEnv {
  SHARED_SECRETS_CDN_ORDER_FULFILLMENT_DISTRIBUTION_SECRETS_NAME: string;
  SHARED_SECRETS_CDN_ORDER_FULFILLMENT_ART_APPROVAL_SECRETS_NAME: string;
  SHARED_SECRETS_CATALOG_EBOOK_CLOUDFRONT_NAME: string;
}
export interface SharedSecretsArgs {}

export class SharedSecrets extends tp.TpComponentResource<
  SharedSecretsArgs,
  SharedSecretsEnv
> {
  public secrets: Array<{ name: string; value: pulumi.Input<string> }>;

  constructor(
    name: string,
    args: SharedSecretsArgs = {},
    opts?: pulumi.ComponentResourceOptions,
  ) {
    super('catalog:SharedSecrets:SharedSecrets', name, args, opts);

    this.secrets = [
      {
        name: 'AWSCONFIG_CDN_FULFILLMENT_ARTAPPROVAL_SECRETS',
        value: aws.secretsmanager.getSecretOutput({
          name: this.config.lookup(
            'SHARED_SECRETS_CDN_ORDER_FULFILLMENT_ART_APPROVAL_SECRETS_NAME',
          ),
        }).arn,
      },
      {
        name: 'AWSCONFIG_CDN_FULFILLMENT_DISTRIBUTION_SECRETS',
        value: aws.secretsmanager.getSecretOutput({
          name: this.config.lookup(
            'SHARED_SECRETS_CDN_ORDER_FULFILLMENT_DISTRIBUTION_SECRETS_NAME',
          ),
        }).arn,
      },
      {
        name: 'AWSCONFIG_EBOOK_CLOUDFRONT',
        value: aws.secretsmanager.getSecretOutput({
          name: this.config.lookup(
            'SHARED_SECRETS_CATALOG_EBOOK_CLOUDFRONT_NAME',
          ),
        }).arn,
      },
    ];
  }

  static envValidators(name: string): tp.Validators<SharedSecretsEnv> {
    return {
      ...tp.Global.envValidators(),
      SHARED_SECRETS_CDN_ORDER_FULFILLMENT_DISTRIBUTION_SECRETS_NAME: str({
        default: 'cdnOrderFulfillment/distributionSecrets',
      }),
      SHARED_SECRETS_CDN_ORDER_FULFILLMENT_ART_APPROVAL_SECRETS_NAME: str({
        default: 'cdnOrderFulfillment/artApprovalSecrets',
      }),
      SHARED_SECRETS_CATALOG_EBOOK_CLOUDFRONT_NAME: str({
        default: 'catalog/ebookCloudfront',
      }),
    };
  }
}

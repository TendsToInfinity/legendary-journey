import * as aws from '@pulumi/aws';
import * as pulumi from '@pulumi/pulumi';
import * as tp from '@securustablets/libraries.pulumi';

export interface SharedApiGatewayEnv {}
export interface SharedApiGatewayArgs {}

export class SharedApiGateway extends tp.TpComponentResource<
  SharedApiGatewayArgs,
  SharedApiGatewayEnv
> {
  public accessPolicy: aws.iam.Policy;
  constructor(
    name: string,
    args: SharedApiGatewayArgs = {},
    opts?: pulumi.ComponentResourceOptions,
  ) {
    super('catalog:SharedApiGateway:SharedApiGateway', name, args, opts);

    const region = aws.getRegionOutput({});
    const idenitity = aws.getCallerIdentityOutput({});

    const accessPolicy = new aws.iam.Policy(
      tp.name('api-gateway'),
      {
        policy: aws.iam.getPolicyDocumentOutput({
          statements: [
            {
              actions: ['execute-api:Invoke', 'execute-api:ManageConnections'],
              resources: [
                pulumi.interpolate`arn:aws:execute-api:${region.name}:${idenitity.accountId}:*`,
              ],
            },
          ],
        }).json,
      },
      { parent: this },
    );
    this.accessPolicy = accessPolicy;
  }

  static envValidators(name: string): tp.Validators<SharedApiGatewayEnv> {
    return {};
  }
}

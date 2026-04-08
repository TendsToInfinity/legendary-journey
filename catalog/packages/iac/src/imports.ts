import * as aws from '@pulumi/aws';
import * as tp from '@securustablets/libraries.pulumi';
import * as _ from 'lodash';
import { loadEnv } from './environment';

export async function getImports(
  config: ReturnType<typeof loadEnv>,
): Promise<tp.ImportDefinition[]> {
  // The library automatically handles enabling/disabling imports, but we also need to enable/disable this code
  // because it does resource lookups that should be toggled as well.
  if (!config.lookup('IMPORTS_ENABLED')) {
    return [];
  }
  const environment = getEnvironment(config);
  return [
    ...(await getAuroraPostgresImports(environment, config)),
    ...getEcsClusterImports(environment),
    ...(await getHttpServiceImports(environment, config)),
  ];
}

function getEnvironment(config: ReturnType<typeof loadEnv>): string {
  const value = config.lookup('APPLICATION_ENVIRONMENT');
  return value === 'prod' ? 'prd' : value;
}

export async function getAuroraPostgresImports(
  environment: string,
  config: ReturnType<typeof loadEnv>,
): Promise<tp.ImportDefinition[]> {
  return [
    {
      type: aws.secretsmanager.Secret,
      name: tp.name('postgres-master-credentials'),
      import: `cat-aurora-master-credentials-${environment}`,
    },
    {
      type: aws.secretsmanager.Secret,
      name: tp.name('postgres-service-credentials'),
      import: `cat-aurora-catalog-credentials-${environment}`,
    },
    {
      type: aws.rds.SubnetGroup,
      name: tp.name('postgres-subnet-group'),
      import: `cat-catalog-postgres-${environment}`,
    },
    // Importing this results in a "replace", so won't work unless we ignore some properties in libraries.pulumi.
    // {
    //   type: aws.ec2.SecurityGroup,
    //   name: tp.name('postgres-proxy-sg'),
    //   import: (
    //     await aws.ec2.getSecurityGroup({
    //       name: `cat-catalog-proxy-sg-${environment}`,
    //     })
    //   ).id,
    // },
    // Importing this results in a "replace", so won't work unless we ignore some properties in libraries.pulumi.
    // {
    //   type: aws.ec2.SecurityGroup,
    //   name: tp.name('postgres-from-proxy-sg'),
    //   import: (
    //     await aws.ec2.getSecurityGroup({
    //       tags: {
    //         Name: `cat-catalog-postgres-${environment}`,
    //       },
    //     })
    //   ).id,
    // },
    // Importing this results in a "replace", so won't work unless we ignore some properties in libraries.pulumi.
    // {
    //   type: aws.iam.Role,
    //   name: tp.name('postgres-monitoring-role'),
    //   import: `cat-aurora-enhanced-monitoring-${environment}`,
    // },
    {
      type: aws.rds.Cluster,
      name: tp.name('postgres'),
      import: `cat-catalog-postgres-${environment}`,
    },
    ..._.range(config.lookup('AURORA_DEFAULT_INSTANCE_COUNT')).map((i) => ({
      type: aws.rds.ClusterInstance,
      name: tp.name(`postgres-${i + 1}`),
      import: `cat-catalog-postgres-${environment}-${i + 1}`,
    })),
    {
      type: aws.rds.Proxy,
      name: tp.name(`postgres-proxy`),
      import: `cat-aurora-proxy-${environment}`,
    },
  ];
}

export function getEcsClusterImports(
  environment: string,
): tp.ImportDefinition[] {
  return [
    {
      type: aws.ecs.Cluster,
      name: tp.name('ecs-cluster'),
      import: `cat-ecs-cluster-${environment}`,
    },
    {
      type: aws.ecs.ClusterCapacityProviders,
      name: tp.name('ecs-cluster-capacity-provider'),
      import: `cat-ecs-cluster-${environment}`,
    },
  ];
}

export async function getHttpServiceImports(
  environment: string,
  config: ReturnType<typeof loadEnv>,
): Promise<tp.ImportDefinition[]> {
  const [loadBalancer, zone] = await Promise.all([
    aws.lb.getLoadBalancer({
      name: `cat-alb-${environment}`,
    }),
    aws.route53.getZone({
      zoneId: config.lookup('ALB_ROUTE53_ZONE_ID'),
    }),
  ]);
  const domain = `${config.lookup('ALB_ROUTE53_SUBDOMAIN')}.${zone.name}`;
  const [certificate, records] = await Promise.all([
    aws.acm.getCertificate({ domain }),
    aws.route53.getRecords({
      zoneId: zone.id,
      nameRegex: `^(.+\\.)?${config.lookup('ALB_ROUTE53_SUBDOMAIN')}\\.${zone.name.replace(/\./g, '\\.')}\\.$`,
    }),
  ]);
  const httpRecord = _.find(records.resourceRecordSets, {
    name: `${domain}.`,
    type: 'A',
  })!;
  const httpValidationRecord = _.find(records.resourceRecordSets, {
    type: 'CNAME',
  })!;

  return [
    {
      type: aws.lb.LoadBalancer,
      name: tp.name('http-alb'),
      import: loadBalancer.arn,
    },
    {
      type: aws.lb.Listener,
      name: tp.name('http-http-listener'),
      import: (
        await aws.lb.getListener({
          loadBalancerArn: loadBalancer.arn,
          port: 80,
        })
      ).arn,
    },
    {
      type: aws.lb.Listener,
      name: tp.name('http-https-listener'),
      import: (
        await aws.lb.getListener({
          loadBalancerArn: loadBalancer.arn,
          port: 443,
        })
      ).arn,
    },
    {
      type: aws.route53.Record,
      name: tp.name('http-record'),
      import: `${zone.id}_${httpRecord.name}_${httpRecord.type}`,
    },
    {
      type: aws.route53.Record,
      name: tp.name('http-validation-record'),
      import: `${zone.id}_${httpValidationRecord.name}_${httpValidationRecord.type}`,
    },
    {
      type: aws.acm.Certificate,
      name: tp.name('http-cert'),
      import: certificate.arn,
    },
  ];
}

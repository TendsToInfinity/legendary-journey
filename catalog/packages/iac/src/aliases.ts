import * as aws from '@pulumi/aws';
import * as tp from '@securustablets/libraries.pulumi';

export function getAliases(): tp.AliasesDefinition[] {
  return [
    ...getElasticacheAliases(),
    ...getOpensearchAliases(),
    ...getHttpServiceAliases(),
    ...getRmqServiceAliases(),
  ];
}

export function getElasticacheAliases(): tp.AliasesDefinition[] {
  return [
    {
      type: aws.elasticache.SubnetGroup,
      name: tp.name('elasticache-subnet-group'),
      aliases: [
        {
          name: tp.name('subnet-group'),
          parent: undefined,
        },
      ],
    },
    {
      type: aws.ec2.SecurityGroup,
      name: tp.name('elasticache-cluster-sg'),
      aliases: [
        {
          name: tp.name('cache-cluster-sg'),
          parent: undefined,
        },
      ],
    },
    {
      type: aws.elasticache.ParameterGroup,
      name: tp.name('elasticache-cluster-pg'),
      aliases: [
        {
          name: tp.name('cache-cluster-pg'),
          parent: undefined,
        },
      ],
    },
    {
      type: aws.elasticache.Cluster,
      name: tp.name('elasticache-cluster'),
      aliases: [
        {
          name: tp.name('cache-cluster'),
          parent: undefined,
        },
      ],
    },
  ];
}

export function getOpensearchAliases(): tp.AliasesDefinition[] {
  return [
    {
      type: aws.acm.Certificate,
      name: tp.name('opensearch-cert'),
      aliases: [
        {
          name: tp.name('opensearch-cert'),
          parent: undefined,
        },
      ],
    },
    {
      type: aws.acm.CertificateValidation,
      name: tp.name('opensearch-cert-validation'),
      aliases: [
        {
          name: tp.name('opensearch-cert-validation'),
          parent: undefined,
        },
      ],
    },
    {
      type: aws.route53.Record,
      name: tp.name('opensearch-validation-1'),
      aliases: [
        {
          name: tp.name('opensearch-validation-1'),
          parent: undefined,
        },
      ],
    },
    {
      type: aws.ec2.SecurityGroup,
      name: tp.name('opensearch-sg'),
      aliases: [
        {
          name: tp.name('opensearch-sg'),
          parent: undefined,
        },
      ],
    },
    {
      type: aws.opensearch.Domain,
      name: tp.name('opensearch'),
      aliases: [
        {
          name: tp.name('opensearch'),
          parent: undefined,
        },
      ],
    },
    {
      type: aws.route53.Record,
      name: tp.name('opensearch-fqdn'),
      aliases: [
        {
          name: tp.name('opensearch-fqdn'),
          parent: undefined,
        },
      ],
    },
  ];
}

export function getHttpServiceAliases(): tp.AliasesDefinition[] {
  return [
    {
      type: aws.iam.Role,
      name: tp.name('http-task-role'),
      aliases: [
        {
          name: tp.name('ecs-http-service-role'),
          parent: undefined,
        },
      ],
    },
    {
      type: aws.secretsmanager.Secret,
      name: tp.name('http-node-config'),
      aliases: [
        {
          name: tp.name('service-config'),
          parent: undefined,
        },
      ],
    },
    {
      type: aws.secretsmanager.SecretVersion,
      name: tp.name('http-node-config-value'),
      aliases: [
        {
          name: tp.name('service-config-value'),
          parent: undefined,
        },
      ],
    },
  ];
}

export function getRmqServiceAliases(): tp.AliasesDefinition[] {
  return [
    {
      type: aws.iam.Role,
      name: tp.name('rmq-task-role'),
      aliases: [
        {
          name: tp.name('ecs-rmq-service-role'),
          parent: undefined,
        },
      ],
    },
    {
      type: aws.secretsmanager.Secret,
      name: tp.name('rmq-node-config'),
      aliases: [
        {
          name: tp.name('rmq-config'),
          parent: undefined,
        },
      ],
    },
    {
      type: aws.secretsmanager.SecretVersion,
      name: tp.name('rmq-node-config-value'),
      aliases: [
        {
          name: tp.name('rmq-config-value'),
          parent: undefined,
        },
      ],
    },
  ];
}

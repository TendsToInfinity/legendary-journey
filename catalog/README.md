# Catalog Service

## Configuration
This application is configured through environment variables, as shown below.

Configuration loading using [dotenv](https://github.com/motdotla/dotenv) is supported.
This means, for persistent configuration, you can create a file `.env` in the root of the source tree with your configurations.
The location of this file may be changed by setting `DOTENV_CONFIG_PATH`.

### Global Configuration
Properties marked with an asterisk (**\***) are required.
| Variable Name | Description | Example | Default |
| ------------- | ----------- | ------- | ------- |
| <div style="white-space:pre">`APPLICATION_COMPLIANCE`  </div> | Sets the value for the "Compliance" tag for created resources | - | <pre style="white-space:pre">none</pre> |
| <div style="white-space:pre">`APPLICATION_COST_CENTER`  </div> | Sets the value for the "CostCenter" tag for created resources | - | <pre style="white-space:pre">177</pre> |
| <div style="white-space:pre">`APPLICATION_ENVIRONMENT`  </div> | Name of the environment into which the application is deployed. Must be 4 or fewer characters in length. Used for resource naming and tagging. If no value is provided, defaults to the name of the pulumi stack. | - | <pre style="white-space:pre">pulumi.getStack()</pre> |
| <div style="white-space:pre">`APPLICATION_NAME`  </div> | Name of the service being deployed. Must be 8 or fewer characters in length. Used for resource naming and tagging. | - | <pre style="white-space:pre">catalog</pre> |
| <div style="white-space:pre">`APPLICATION_OWNER`  </div> | Sets the value for the "Owner" tag for created resources | - | <pre style="white-space:pre">tabletplatform</pre> |
| <div style="white-space:pre">`APPLICATION_PRODUCT`  </div> | Sets the value for the "Product" tag for created resources | - | <pre style="white-space:pre">unity</pre> |
| <div style="white-space:pre">`ARTIFACT_BUCKET`  </div> | Specify the S3 bucket from which pre-published archives should be fetched (e.g. lambda code). This option is required when `LOCAL_DEPLOYMENT` is set to false. | - | <pre style="white-space:pre">tp-cicd-artifacts-cicd</pre> |
| <div style="white-space:pre">`DELETION_PROTECTION_ENABLED`  </div> | When enabled, deletion protection will be set for applicable resources | - | <pre style="white-space:pre">true</pre> |
| <div style="white-space:pre">`ECR_REGISTRY_ID`  </div> | Specify the ECR registry from which pre-published images should be fetched. The value should be the AWS account ID containing the ECR registry. This option is required when `LOCAL_DEPLOYMENT` is set to false. | - | <pre style="white-space:pre">335895905019</pre> |
| <div style="white-space:pre">`EXTRA_TAGS`  </div> | Define any additional tags you would like to attach to resources provisioned by this application.<br/><br>Provide tags as a json dictionary. | - | - |
| <div style="white-space:pre">`EXTRA_TAGS_CONFIG`  </div> | Provides more granular tagging control compared to `$EXTRA_TAGS`. Define configuration as an array of objects, with available properties:<ul><li>`name`: Match resources with these name(s). You can find available names by running `pulumi stack`. Exclude prefixes and suffixes when providing names.</li><li>`nameRegex`: Match with a regex</li><li>`type`: Match resources with these type(s). You can find available types by running `pulumi stack`.</li><li>`typeRegex`: Match with a regex</li><li>`tags`: Provide a dictionary of tags which should be added to matched resources</li></ul> | <pre style="white-space:pre">[<br/>  {<br/>    "type": [<br/>      "aws:rds/cluster:Cluster",<br/>      "aws:rds/proxy:Proxy"<br/>    ],<br/>    "tags": {<br/>      "db-map-migrated": "true"<br/>    }<br/>  }<br/>]</pre> | - |
| <div style="white-space:pre">`IMPORTS_ENABLED`  </div> | - | - | <pre style="white-space:pre">false</pre> |
| <div style="white-space:pre">`LOCAL_DEPLOYMENT`  </div> | Set to true to enable deployment using assets published from the local filesystem. When this value is set to false (the default) application artifacts are retrieved from remote sources. | - | <pre style="white-space:pre">false</pre> |
| <div style="white-space:pre">`WHITELIST_COUNTRIES`  </div> | Array of two-character country codes from the alpha-2 country ISO codes of the ISO 3166 international standard. Currently supported by CloudFrontDistribution and Waf components | <pre style="white-space:pre">[ 'US', 'CA' ]</pre> | <pre style="white-space:pre">[<br/>  "US",<br/>  "MX",<br/>  "CA"<br/>]</pre> |
### Pulumi Configuration
Properties marked with an asterisk (**\***) are required.
| Variable Name | Description | Example | Default |
| ------------- | ----------- | ------- | ------- |
| <div style="white-space:pre">**`PULUMI_BACKEND_URL`** **\*** </div> | Specify the pulumi backend URI that should be used for stack management. For information about backends, see https://www.pulumi.com/docs/intro/concepts/state/ | <pre style="white-space:pre">s3://my-pulumi-bucket/my-app</pre> | - |
| <div style="white-space:pre">**`PULUMI_SECRETS_PROVIDER`** **\*** </div> | Specify the secrets provider for use by pulumi. For available secrets providers, see https://www.pulumi.com/docs/intro/concepts/secrets/#available-encryption-providers | - | - |
| <div style="white-space:pre">**`PULUMI_STACK`** **\*** </div> | Specify the name of the pulumi stack that should be managed by this pipeline. For information about stacks, see https://www.pulumi.com/docs/intro/concepts/stack/ | <pre style="white-space:pre">dev</pre> | - |
### Aurora Configuration
Properties marked with an asterisk (**\***) are required.
| Variable Name | Description | Example | Default |
| ------------- | ----------- | ------- | ------- |
| <div style="white-space:pre">**`AURORA_MASTER_PASSWORD`** **\*** </div> | Password for the master account. | - | - |
| <div style="white-space:pre">**`AURORA_SERVICE_PASSWORD`** **\*** </div> | Password for the service (application) account | - | - |
| <div style="white-space:pre">`AURORA_ALLOWED_DIRECT_INGRESS_CIDRS`  </div> | Specify additional CIDR blocks which should be permitted ingress directly to the Aurora cluster, without using the RDS proxy. Everything should come through the proxy, unless the feature needed is not supported. Each range can be defined either as a raw string or as an object with a `cidr` and `description` property. | - | - |
| <div style="white-space:pre">`AURORA_ALLOWED_INGRESS_CIDRS`  </div> | Specify additional CIDR blocks which should be permitted ingress to the Aurora cluster through the RDS proxy. The private subnets of the workload account are automatically granted ingress and need not be added here. Each range can be defined either as a raw string or as an object with a `cidr` and `description` property. | - | - |
| <div style="white-space:pre">`AURORA_BACKUP_RETENTION_PERIOD`  </div> | Specify the retention period (in days) for automated backups | - | <pre style="white-space:pre">1</pre> |
| <div style="white-space:pre">`AURORA_CDC_PASSWORD`  </div> | Password for the cdc (application) account | - | - |
| <div style="white-space:pre">`AURORA_CDC_USER`  </div> | Username for the cdc (application) account | - | <pre style="white-space:pre">catalog_cdc_user</pre> |
| <div style="white-space:pre">`AURORA_CLUSTER_AVAILABILITY_ZONES`  </div> | - | - | - |
| <div style="white-space:pre">`AURORA_CLUSTER_PARAMETERS`  </div> | A dictionary of DB parameters to apply. Note that parameters may differ from a family to an other. Full list of all parameters can be discovered via [`aws rds describe-db-cluster-parameters`](https://docs.aws.amazon.com/cli/latest/reference/rds/describe-db-cluster-parameters.html) after initial creation of the group. Db parameters which require a reboot for application may not be added after the cluster has been created. Those parameters must be applied manually. | - | <pre style="white-space:pre">{<br/>  "work_mem": "2097152"<br/>}</pre> |
| <div style="white-space:pre">`AURORA_CREATE_DATABASE`  </div> | Controls automatic creation of the database named `$AURORA_DATABASE_NAME`. This configuration property was added to support an edge case for Catalog Service where the database should be named `catalog`, but the RDS engine refuses to create a database with that name. Instead, the database is created by the `LambdaBoostrap` component. | - | <pre style="white-space:pre">false</pre> |
| <div style="white-space:pre">`AURORA_DATABASE_NAME`  </div> | The name of the PostgreSQL database which should be created and managed. | - | <pre style="white-space:pre">catalog</pre> |
| <div style="white-space:pre">`AURORA_DEFAULT_INSTANCE_COUNT`  </div> | Number of RDS cluster instances to create. The first instance will be provisioned as a writer, and subsequent instances are provisioned as readers.<br/>The number of instances may be autoscaled using the `$PULUMI_AUTOSCALE_*` configurations below. | - | <pre style="white-space:pre">2</pre> |
| <div style="white-space:pre">`AURORA_ENGINE_VERSION`  </div> | Specify the engine version for the Aurora cluster.<br/> This setting is only applied during initial cluster creation. Cluster upgades must be handled externally. | - | <pre style="white-space:pre">16.1</pre> |
| <div style="white-space:pre">`AURORA_INSTANCE_CLASS`  </div> | Instance class to use. For details on CPU and memory, see [Scaling Aurora DB Instances](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Aurora.Managing.html). Aurora uses `db.*` instance classes/types. Please see [AWS Documentation](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Concepts.DBInstanceClass.html) for currently available instance classes and complete details. For Aurora Serverless v2 use `db.serverless`. | - | <pre style="white-space:pre">db.serverless</pre> |
| <div style="white-space:pre">`AURORA_INSTANCE_PARAMETERS`  </div> | A dictionary of DB parameters to apply. Note that parameters may differ from a family to an other. Full list of all parameters can be discovered via [`aws rds describe-db-parameters`](https://docs.aws.amazon.com/cli/latest/reference/rds/describe-db-parameters.html) after initial creation of the group. Db parameters which require a reboot for application may not be added after the cluster has been created. Those parameters must be applied manually. | - | <pre style="white-space:pre">{<br/>  "work_mem": "2097152"<br/>}</pre> |
| <div style="white-space:pre">`AURORA_MASTER_USER`  </div> | Username for the master account | - | <pre style="white-space:pre">postgres</pre> |
| <div style="white-space:pre">`AURORA_MONITORING_INTERVAL`  </div> | The interval, in seconds, between points when Enhanced Monitoring metrics are collected for the cluster instances. To disable collecting Enhanced Monitoring metrics, specify 0. Valid Values: 0, 1, 5, 10, 15, 30, 60. | - | <pre style="white-space:pre">60</pre> |
| <div style="white-space:pre">`AURORA_PERFORMANCE_INSIGHTS_ENABLED`  </div> | Enable/disable Performance Insights for cluster instances. | - | <pre style="white-space:pre">true</pre> |
| <div style="white-space:pre">`AURORA_SERVERLESS_MAX_ACU`  </div> | The maximum capacity for the Aurora DB cluster which runs in `serverless` DB engine mode. The maximum capacity must be greater than or equal to the minimum capacity.<br/>Valid Aurora PostgreSQL capacity values are (`2`, `4`, `8`, `16`, `32`, `64`, `192`, and `384`).This configuration is ignored if `$AURORA_INSTANCE_CLASS` is set to anything other than `db.serverless` | - | <pre style="white-space:pre">2</pre> |
| <div style="white-space:pre">`AURORA_SERVERLESS_MIN_ACU`  </div> | The minimum capacity for the Aurora DB cluster which runs in `serverless` DB engine mode. The minimum capacity must be lesser than or equal to the maximum capacity.<br/>Valid Aurora PostgreSQL capacity values are (`2`, `4`, `8`, `16`, `32`, `64`, `192`, and `384`).This configuration is ignored if `$AURORA_INSTANCE_CLASS` is set to anything other than `db.serverless` | - | <pre style="white-space:pre">1</pre> |
| <div style="white-space:pre">`AURORA_SERVICE_USER`  </div> | Username for the service (application) account | - | <pre style="white-space:pre">catalog_user</pre> |
### Aurora Autoscaling Configuration
Properties marked with an asterisk (**\***) are required.
| Variable Name | Description | Example | Default |
| ------------- | ----------- | ------- | ------- |
| <div style="white-space:pre">`AURORA_AUTOSCALING_ENABLED`  </div> | Enable autoscaling for Aurora.<br/>When this value is set to `false` (the default), the other aurora autoscaling parameters will have no effect. | - | <pre style="white-space:pre">false</pre> |
| <div style="white-space:pre">`AURORA_AUTOSCALING_MAX_CAPACITY`  </div> | Max capacity of the scalable target (Aurora Serverless v2 readers) | - | <pre style="white-space:pre">3</pre> |
| <div style="white-space:pre">`AURORA_AUTOSCALING_METRIC_TARGET_VALUE`  </div> | Set the target value for the chosen metric type.<br/>Be sure to coordinate this property with the value chosen for `$AURORA_AUTOSCALING_METRIC_TYPE` | - | <pre style="white-space:pre">45</pre> |
| <div style="white-space:pre">`AURORA_AUTOSCALING_METRIC_TYPE`  </div> | Pick from <ul><li>`RDSReaderAverageCPUUtilization`</li><li>`RDSReaderAverageDatabaseConnections`</li></ul> | - | <pre style="white-space:pre">RDSReaderAverageCPUUtilization</pre> |
| <div style="white-space:pre">`AURORA_AUTOSCALING_MIN_CAPACITY`  </div> | Min capacity of the scalable target (Aurora Serverless v2 readers) | - | <pre style="white-space:pre">1</pre> |
| <div style="white-space:pre">`AURORA_AUTOSCALING_SCALE_IN_COOLDOWN`  </div> | Amount of time, in seconds, after a scale in activity completes before another scale in activity can start | - | <pre style="white-space:pre">300</pre> |
| <div style="white-space:pre">`AURORA_AUTOSCALING_SCALE_OUT_COOLDOWN`  </div> | Amount of time, in seconds, after a scale out activity completes before another scale out activity can start | - | <pre style="white-space:pre">120</pre> |
### ECS Service Configuration
Properties marked with an asterisk (**\***) are required.
| Variable Name | Description | Example | Default |
| ------------- | ----------- | ------- | ------- |
| <div style="white-space:pre">`ECS_SERVICE_CONTINUE_BEFORE_STEADY_STATE`  <p><small>`HTTP_ECS_SERVICE_CONTINUE_BEFORE_STEADY_STATE`<br/>`RMQ_ECS_SERVICE_CONTINUE_BEFORE_STEADY_STATE`<br/>`BI_ECS_SERVICE_CONTINUE_BEFORE_STEADY_STATE`</small></p></div> | Toggle waiting for ECS cluster to reach steady state | - | <pre style="white-space:pre">false</pre> |
| <div style="white-space:pre">`ECS_SERVICE_DESIRED_COUNT`  <p><small>`HTTP_ECS_SERVICE_DESIRED_COUNT`<br/>`RMQ_ECS_SERVICE_DESIRED_COUNT`<br/>`BI_ECS_SERVICE_DESIRED_COUNT`</small></p></div> | Set the number of containers that that should be running.<br/>Changes to this value have no effect after the intial deployment. | - | <pre style="white-space:pre">1</pre> |
### ECS Service Autoscaling Configuration
Properties marked with an asterisk (**\***) are required.
| Variable Name | Description | Example | Default |
| ------------- | ----------- | ------- | ------- |
| <div style="white-space:pre">`ECS_SERVICE_AUTOSCALING_ENABLED`  <p><small>`HTTP_ECS_SERVICE_AUTOSCALING_ENABLED`<br/>`RMQ_ECS_SERVICE_AUTOSCALING_ENABLED`<br/>`BI_ECS_SERVICE_AUTOSCALING_ENABLED`</small></p></div> | Enable autoscaling for the ECS service.<br/>When this value is set to `false` (the default), the other ECS autoscaling parameters will have no effect. | - | <pre style="white-space:pre">false</pre> |
| <div style="white-space:pre">`ECS_SERVICE_AUTOSCALING_MAX_CAPACITY`  <p><small>`HTTP_ECS_SERVICE_AUTOSCALING_MAX_CAPACITY`<br/>`RMQ_ECS_SERVICE_AUTOSCALING_MAX_CAPACITY`<br/>`BI_ECS_SERVICE_AUTOSCALING_MAX_CAPACITY`</small></p></div> | Max capacity of the scalable target | - | <pre style="white-space:pre">3</pre> |
| <div style="white-space:pre">`ECS_SERVICE_AUTOSCALING_METRIC_TARGET_VALUE`  <p><small>`HTTP_ECS_SERVICE_AUTOSCALING_METRIC_TARGET_VALUE`<br/>`RMQ_ECS_SERVICE_AUTOSCALING_METRIC_TARGET_VALUE`<br/>`BI_ECS_SERVICE_AUTOSCALING_METRIC_TARGET_VALUE`</small></p></div> | Set the target value for the chosen metric type.<br/>Be sure to coordinate this property with the value chosen for `$ECS_SERVICE_AUTOSCALING_METRIC_TYPE` | - | <pre style="white-space:pre">45</pre> |
| <div style="white-space:pre">`ECS_SERVICE_AUTOSCALING_METRIC_TYPE`  <p><small>`HTTP_ECS_SERVICE_AUTOSCALING_METRIC_TYPE`<br/>`RMQ_ECS_SERVICE_AUTOSCALING_METRIC_TYPE`<br/>`BI_ECS_SERVICE_AUTOSCALING_METRIC_TYPE`</small></p></div> | Pick from <ul><li>`ALBRequestCountPerTarget`</li><li>`ECSServiceAverageCPUUtilization`</li><li>`ECSServiceAverageMemoryUtilization`</li></ul> | - | <pre style="white-space:pre">ECSServiceAverageCPUUtilization</pre> |
| <div style="white-space:pre">`ECS_SERVICE_AUTOSCALING_MIN_CAPACITY`  <p><small>`HTTP_ECS_SERVICE_AUTOSCALING_MIN_CAPACITY`<br/>`RMQ_ECS_SERVICE_AUTOSCALING_MIN_CAPACITY`<br/>`BI_ECS_SERVICE_AUTOSCALING_MIN_CAPACITY`</small></p></div> | Min capacity of the scalable target | - | <pre style="white-space:pre">1</pre> |
| <div style="white-space:pre">`ECS_SERVICE_AUTOSCALING_SCALE_IN_COOLDOWN`  <p><small>`HTTP_ECS_SERVICE_AUTOSCALING_SCALE_IN_COOLDOWN`<br/>`RMQ_ECS_SERVICE_AUTOSCALING_SCALE_IN_COOLDOWN`<br/>`BI_ECS_SERVICE_AUTOSCALING_SCALE_IN_COOLDOWN`</small></p></div> | Amount of time, in seconds, after a scale in activity completes before another scale in activity can start | - | <pre style="white-space:pre">300</pre> |
| <div style="white-space:pre">`ECS_SERVICE_AUTOSCALING_SCALE_OUT_COOLDOWN`  <p><small>`HTTP_ECS_SERVICE_AUTOSCALING_SCALE_OUT_COOLDOWN`<br/>`RMQ_ECS_SERVICE_AUTOSCALING_SCALE_OUT_COOLDOWN`<br/>`BI_ECS_SERVICE_AUTOSCALING_SCALE_OUT_COOLDOWN`</small></p></div> | Amount of time, in seconds, after a scale out activity completes before another scale out activity can start | - | <pre style="white-space:pre">120</pre> |
### ECS Task Configuration
Properties marked with an asterisk (**\***) are required.
| Variable Name | Description | Example | Default |
| ------------- | ----------- | ------- | ------- |
| <div style="white-space:pre">`ECS_TASK_CPU`  <p><small>`HTTP_ECS_TASK_CPU`<br/>`RMQ_ECS_TASK_CPU`<br/>`BI_ECS_TASK_CPU`<br/>`DB_MIGRATION_ECS_TASK_CPU`</small></p></div> | CPU units allocated to the ECS task and its single container | - | <pre style="white-space:pre">512</pre> |
| <div style="white-space:pre">`ECS_TASK_CPU_ARCHITECTURE`  <p><small>`HTTP_ECS_TASK_CPU_ARCHITECTURE`<br/>`RMQ_ECS_TASK_CPU_ARCHITECTURE`<br/>`BI_ECS_TASK_CPU_ARCHITECTURE`<br/>`DB_MIGRATION_ECS_TASK_CPU_ARCHITECTURE`</small></p></div> | <p>CPU architecture for the ECS task. Be sure to verify the container image associated with the task supports your chosen architecture before changing this value from its default.</p>  <p>Allowed values are `X86_64` and `ARM64`.</p>  <p>If `LOCAL_DEPLOYMENT` is set to `true`, this configuration property is ignored and the CPU architecture of the host machine is used. If the host CPU has an unsupported architecture, a runtime error will be thrown.</p> | - | <pre style="white-space:pre">X86_64</pre> |
| <div style="white-space:pre">`ECS_TASK_ENVIRONMENT`  <p><small>`HTTP_ECS_TASK_ENVIRONMENT`<br/>`RMQ_ECS_TASK_ENVIRONMENT`<br/>`BI_ECS_TASK_ENVIRONMENT`<br/>`DB_MIGRATION_ECS_TASK_ENVIRONMENT`</small></p></div> | <p>Specify additional environment variables to be configured in the task definition.</p>  <p>By default, the following variables are set: <ul> <li>`NODE_ENV=$APPLICATION_ENVIRONMENT`</li> </ul> </p>  <p>If you'd like APM integration, it is recommended you add these additional environment variables: <ul> <li>`ELASTIC_APM_SERVER_URL`</li> <li>`ELASTIC_APM_SERVICE_NAME`</li> <li>`ELASTIC_APM_ACTIVE`</li> <li>`ELASTIC_APM_LOG_UNCAUGHT_EXCEPTIONS`</li> </ul> </p> | <pre style="white-space:pre">{<br/>  "NODE_OPTIONS": "--max-old-space-size=8192",<br/>  "DEBUG": "true"<br/>}</pre> | - |
| <div style="white-space:pre">`ECS_TASK_EXPOSE_PORT`  <p><small>`HTTP_ECS_TASK_EXPOSE_PORT`<br/>`BI_ECS_TASK_EXPOSE_PORT`</small></p></div> | The port which should be exposed for the task. | - | <pre style="white-space:pre">8080</pre> |
| <div style="white-space:pre">`ECS_TASK_EXPOSE_PROTOCOL`  <p><small>`HTTP_ECS_TASK_EXPOSE_PROTOCOL`<br/>`BI_ECS_TASK_EXPOSE_PROTOCOL`</small></p></div> | The protocol of the exposed port for the task. | - | <pre style="white-space:pre">tcp</pre> |
| <div style="white-space:pre">`ECS_TASK_MEMORY`  <p><small>`HTTP_ECS_TASK_MEMORY`<br/>`RMQ_ECS_TASK_MEMORY`<br/>`BI_ECS_TASK_MEMORY`<br/>`DB_MIGRATION_ECS_TASK_MEMORY`</small></p></div> | Memory units allocated to the ECS task and its single container | - | <pre style="white-space:pre">1024</pre> |
### ALB Configuration
Properties marked with an asterisk (**\***) are required.
| Variable Name | Description | Example | Default |
| ------------- | ----------- | ------- | ------- |
| <div style="white-space:pre">**`ALB_ROUTE53_ZONE_ID`** **\*** <p><small>`HTTP_ALB_ROUTE53_ZONE_ID`<br/>`BI_ALB_ROUTE53_ZONE_ID`</small></p></div> | Specify the zone into which the DNS record should be provisioned | - | - |
| <div style="white-space:pre">`ALB_ALLOW_HTTP`  <p><small>`HTTP_ALB_ALLOW_HTTP`<br/>`BI_ALB_ALLOW_HTTP`</small></p></div> | If true will add an http listener | - | <pre style="white-space:pre">true</pre> |
| <div style="white-space:pre">`ALB_ALLOWED_INGRESS_CIDRS`  <p><small>`HTTP_ALB_ALLOWED_INGRESS_CIDRS`<br/>`BI_ALB_ALLOWED_INGRESS_CIDRS`</small></p></div> | Specify CIDR blocks which should be permitted ingress to the ALB. Each range can be defined either as a raw string or as an object with a `cidr` and `description` property. | - | - |
| <div style="white-space:pre">`ALB_ALLOWED_INGRESS_PREFIX_LISTS`  <p><small>`HTTP_ALB_ALLOWED_INGRESS_PREFIX_LISTS`<br/>`BI_ALB_ALLOWED_INGRESS_PREFIX_LISTS`</small></p></div> | Specify Prefix List IDs which should be permitted ingress to the ALB | - | - |
| <div style="white-space:pre">`ALB_BLOCK_API_DOCS`  <p><small>`HTTP_ALB_BLOCK_API_DOCS`<br/>`BI_ALB_BLOCK_API_DOCS`</small></p></div> | If true will add a listener rule to block the swagger api docs | - | <pre style="white-space:pre">false</pre> |
| <div style="white-space:pre">`ALB_HTTP_PORT`  <p><small>`HTTP_ALB_HTTP_PORT`<br/>`BI_ALB_HTTP_PORT`</small></p></div> | The port the http listener will listen on | - | <pre style="white-space:pre">80</pre> |
| <div style="white-space:pre">`ALB_HTTPS_PORT`  <p><small>`HTTP_ALB_HTTPS_PORT`<br/>`BI_ALB_HTTPS_PORT`</small></p></div> | The port the https listener will listen on | - | <pre style="white-space:pre">443</pre> |
| <div style="white-space:pre">`ALB_IP_TARGETS`  <p><small>`HTTP_ALB_IP_TARGETS`<br/>`BI_ALB_IP_TARGETS`</small></p></div> | Specify IPs that the ALB will route to. Can not be set if an EcsTask is provided to the Alb | - | - |
| <div style="white-space:pre">`ALB_ROUTE53_SUBDOMAIN`  </div> | Specify the name of the subdomain for the DNS record which is created | - | <pre style="white-space:pre">catalog</pre> |
| <div style="white-space:pre">`BI_ALB_ROUTE53_SUBDOMAIN`  </div> | Specify the name of the subdomain for the DNS record which is created | - | <pre style="white-space:pre">bicatalog</pre> |
| <div style="white-space:pre">`ALB_SSL_POLICY`  <p><small>`HTTP_ALB_SSL_POLICY`<br/>`BI_ALB_SSL_POLICY`</small></p></div> | Specify SSL Policy to be applied. See [here](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/describe-ssl-policies.html) for more information and allowed values | - | <pre style="white-space:pre">ELBSecurityPolicy-TLS13-1-2-2021-06</pre> |
| <div style="white-space:pre">`ALB_SUBNET_TYPE`  <p><small>`HTTP_ALB_SUBNET_TYPE`<br/>`BI_ALB_SUBNET_TYPE`</small></p></div> | Specify the type of subnet to attach to the ALB. Valid options are 'private' and 'public' | - | <pre style="white-space:pre">private</pre> |
| <div style="white-space:pre">`ALB_TARGET_GROUP_HEALTH_CHECK_PATH`  <p><small>`HTTP_ALB_TARGET_GROUP_HEALTH_CHECK_PATH`<br/>`BI_ALB_TARGET_GROUP_HEALTH_CHECK_PATH`</small></p></div> | The path on the target servers to perform a health check. Must start with a forward slash | - | <pre style="white-space:pre">/heartbeat?isAlive=true</pre> |
| <div style="white-space:pre">`ALB_TARGET_GROUP_PORT`  <p><small>`HTTP_ALB_TARGET_GROUP_PORT`<br/>`BI_ALB_TARGET_GROUP_PORT`</small></p></div> | The port number the ALB will route to. Can not be set if an EcsTask is provided to the Alb | - | - |
### Elasticache Configuration
Properties marked with an asterisk (**\***) are required.
| Variable Name | Description | Example | Default |
| ------------- | ----------- | ------- | ------- |
| <div style="white-space:pre">**`ELASTICACHE_ENGINE_VERSION`** **\*** <p><small>`ELASTICACHE_ELASTICACHE_ENGINE_VERSION`<br/>`RMQ_ELASTICACHE_ENGINE_VERSION`</small></p></div> | The version number of cache engine | - | - |
| <div style="white-space:pre">**`ELASTICACHE_NODE_COUNT`** **\*** <p><small>`ELASTICACHE_ELASTICACHE_NODE_COUNT`<br/>`RMQ_ELASTICACHE_NODE_COUNT`</small></p></div> | The total number of nodes, must be between 1 and 40 | - | - |
| <div style="white-space:pre">**`ELASTICACHE_NODE_TYPE`** **\*** <p><small>`ELASTICACHE_ELASTICACHE_NODE_TYPE`<br/>`RMQ_ELASTICACHE_NODE_TYPE`</small></p></div> | The instance class used. | - | - |
| <div style="white-space:pre">`ELASTICACHE_ALLOWED_INGRESS_CIDRS`  <p><small>`ELASTICACHE_ELASTICACHE_ALLOWED_INGRESS_CIDRS`<br/>`RMQ_ELASTICACHE_ALLOWED_INGRESS_CIDRS`</small></p></div> | An array of cidr ranges that are allowed to access the Elasticache cluster. Each range can be defined either as a raw string or as an object with a `cidr` and `description` property. | <pre style="white-space:pre">[<br/>  {<br/>    "cidr": "10.255.104.0/22",<br/>    "description": "Allow SSL VPN Midway users"<br/>  }<br/>]</pre> | <pre style="white-space:pre">[]</pre> |
| <div style="white-space:pre">`ELASTICACHE_DEDICATED_RMQ_CLUSTER_ENABLED`  </div> | Enables a dedicated elasticache cluster for the RMQ ECS Service. When enabled, the `RMQ_ELASTICACHE_*` variables may be used to specifically configure this cluster, and the `ELASTICACHE_ELASTICACHE_*` variables may be used to specifically configure the other/default cluster. | - | <pre style="white-space:pre">false</pre> |
| <div style="white-space:pre">`ELASTICACHE_PARAMETERS`  <p><small>`ELASTICACHE_ELASTICACHE_PARAMETERS`<br/>`RMQ_ELASTICACHE_PARAMETERS`</small></p></div> | Define parameters to customize settings on the memcached cluster.  See [memcached parameters](https://docs.aws.amazon.com/AmazonElastiCache/latest/mem-ug/ParameterGroups.Memcached.html) for supported parameters.<br/><br/>  Provide parameters as a yaml dictionary. | <pre style="white-space:pre">{<br/>  "FooTagKey": "bar-tag-value",<br/>  "BarTagKey": "quux-tag-value"<br/>}</pre> | <pre style="white-space:pre">{}</pre> |
| <div style="white-space:pre">`ELASTICACHE_PORT`  <p><small>`ELASTICACHE_ELASTICACHE_PORT`<br/>`RMQ_ELASTICACHE_PORT`</small></p></div> | The port number on which each of the cache nodes will accept connections. | - | <pre style="white-space:pre">11211</pre> |
### Opensearch Configuration
Properties marked with an asterisk (**\***) are required.
| Variable Name | Description | Example | Default |
| ------------- | ----------- | ------- | ------- |
| <div style="white-space:pre">**`OPENSEARCH_INSTANCE_TYPE`** **\*** </div> | Instance type of data nodes in the opensearch cluster. | <pre style="white-space:pre">r6g.large.search</pre> | - |
| <div style="white-space:pre">**`OPENSEARCH_MASTER_PASSWORD`** **\*** </div> | Password for the opensearch master user. | - | - |
| <div style="white-space:pre">**`OPENSEARCH_MASTER_USERNAME`** **\*** </div> | Username for the opensearch master user. | - | - |
| <div style="white-space:pre">**`OPENSEARCH_NODE_COUNT`** **\*** </div> | Number of data nodes in the opensearch cluster. | - | - |
| <div style="white-space:pre">**`OPENSEARCH_ROUTE53_ZONE_ID`** **\*** </div> | Specify the zone into which the DNS record should be provisioned for the Opensearch API endpoint | - | - |
| <div style="white-space:pre">**`OPENSEARCH_SERVICE_PASSWORD`** **\*** </div> | Password for opensearch, to be used by the service | - | - |
| <div style="white-space:pre">**`OPENSEARCH_SERVICE_USERNAME`** **\*** </div> | Username for opensearch, to be used by the service | - | - |
| <div style="white-space:pre">**`OPENSEARCH_STORAGE_SIZE`** **\*** </div> | Size of EBS volumes attached to opensearch data nodes (in GiB). | - | - |
| <div style="white-space:pre">`OPENSEARCH_ALLOWED_INGRESS_CIDRS`  </div> | An array of cidr ranges that are allowed to access the Opensearch cluster. Each range can be defined either as a raw string or as an object with a `cidr` and `description` property. | <pre style="white-space:pre">[<br/>  {<br/>    "cidr": "10.255.104.0/22",<br/>    "description": "Allow SSL VPN Midway users"<br/>  }<br/>]</pre> | <pre style="white-space:pre">[]</pre> |
| <div style="white-space:pre">`OPENSEARCH_AVAILABILITY_ZONE_COUNT`  </div> | Number of Availability Zones for the opensearch domain to use. | - | <pre style="white-space:pre">2</pre> |
| <div style="white-space:pre">`OPENSEARCH_ENGINE_VERSION`  </div> | Specifies the engine version for the Amazon OpenSearch Service domain. | <pre style="white-space:pre">OpenSearch_1.1</pre> | <pre style="white-space:pre">OpenSearch_2.3</pre> |
| <div style="white-space:pre">`OPENSEARCH_MAINTENANCE_CRON`  </div> | A cron expression specifying the recurrence pattern for an Auto-Tune maintenance schedule. | - | <pre style="white-space:pre">0 7 ? * 1 *</pre> |
| <div style="white-space:pre">`OPENSEARCH_MAINTENANCE_DURATION_HOURS`  </div> | The duration of the opensearch Auto-Tune maintenance window in hours. | - | <pre style="white-space:pre">2</pre> |
| <div style="white-space:pre">`OPENSEARCH_MASTER_INSTANCE_TYPE`  </div> | Instance type of the dedicated main nodes in the opensearch cluster. Has no affect if OPENSEARCH_MASTER_NODE_COUNT is 0. | <pre style="white-space:pre">r6g.large.search</pre> | - |
| <div style="white-space:pre">`OPENSEARCH_MASTER_NODE_COUNT`  </div> | Number of dedicated main nodes in the opensearch cluster. Must also specify OPENSEARCH_MASTER_INSTANCE_TYPE | - | <pre style="white-space:pre">0</pre> |
| <div style="white-space:pre">`OPENSEARCH_ROUTE53_SUBDOMAIN`  </div> | Specify the name of the subdomain for the DNS record which is created for the Opensearch API endpoint | - | <pre style="white-space:pre">catalogsearch</pre> |
| <div style="white-space:pre">`OPENSEARCH_STORAGE_IOPS`  </div> | Baseline input/output (I/O) performance of EBS volumes attached to data nodes. Number must be between 3000 & 16000 and should not be more than 500x the volume size. | - | <pre style="white-space:pre">0</pre> |
| <div style="white-space:pre">`OPENSEARCH_STORAGE_THROUGHPUT`  </div> | Specifies the throughput (in MiB/s) of the EBS volumes attached to data nodes. Valid values are between 125 and 1000. | - | <pre style="white-space:pre">125</pre> |
### Secret Configuration
Properties marked with an asterisk (**\***) are required.
| Variable Name | Description | Example | Default |
| ------------- | ----------- | ------- | ------- |
| <div style="white-space:pre">`SECRET_RECOVERY_WINDOW_DAYS`  <p><small>`POSTGRES_MASTER_CREDENTIALS_SECRET_RECOVERY_WINDOW_DAYS`<br/>`POSTGRES_SERVICE_CREDENTIALS_SECRET_RECOVERY_WINDOW_DAYS`<br/>`POSTGRES_CDC_CREDENTIALS_SECRET_RECOVERY_WINDOW_DAYS`<br/>`HTTP_NODE_CONFIG_SECRET_RECOVERY_WINDOW_DAYS`<br/>`RMQ_NODE_CONFIG_SECRET_RECOVERY_WINDOW_DAYS`<br/>`BI_NODE_CONFIG_SECRET_RECOVERY_WINDOW_DAYS`<br/>`DB_MIGRATION_NODE_CONFIG_SECRET_RECOVERY_WINDOW_DAYS`</small></p></div> | Specify the waiting period in days before secrets are permanently deleted. | - | <pre style="white-space:pre">30</pre> |
### Shared Infrastructure Configuration
Properties marked with an asterisk (**\***) are required.
| Variable Name | Description | Example | Default |
| ------------- | ----------- | ------- | ------- |
| <div style="white-space:pre">`SHARED_SECRETS_CATALOG_EBOOK_CLOUDFRONT_NAME`  </div> | - | - | <pre style="white-space:pre">catalog/ebookCloudfront</pre> |
| <div style="white-space:pre">`SHARED_SECRETS_CDN_ORDER_FULFILLMENT_ART_APPROVAL_SECRETS_NAME`  </div> | - | - | <pre style="white-space:pre">cdnOrderFulfillment/artApprovalSecrets</pre> |
| <div style="white-space:pre">`SHARED_SECRETS_CDN_ORDER_FULFILLMENT_DISTRIBUTION_SECRETS_NAME`  </div> | - | - | <pre style="white-space:pre">cdnOrderFulfillment/distributionSecrets</pre> |
| <div style="white-space:pre">`SHARED_SQS_QUEUE_NAME`  </div> | Name of the SQS queue used by the application. Access to this queue is automatically added to the task roles for the ECS containers, and the value of this environment variable is sent to the ECS containers as `sqsConfig.queueName`. When not provided, defaults to `cidn-music-am-ingestion-song-sample-queue-${APPLICATION_ENVIRONMENT}`. To enable/disable SQS features within the container, see `$NODE_CONFIG_SQS_CONFIG_SQS_ENABLED`. | - | - |
### NODE_CONFIG Configuration
Properties marked with an asterisk (**\***) are required.
| Variable Name | Description | Example | Default |
| ------------- | ----------- | ------- | ------- |
| <div style="white-space:pre">**`NODE_CONFIG_APM_SERVER`** **\*** <p><small>`HTTP_NODE_CONFIG_APM_SERVER`<br/>`RMQ_NODE_CONFIG_APM_SERVER`<br/>`BI_NODE_CONFIG_APM_SERVER`<br/>`DB_MIGRATION_NODE_CONFIG_APM_SERVER`</small></p></div> | Url to send elastic apm data | - | - |
| <div style="white-space:pre">**`NODE_CONFIG_ELASTICSEARCH_CUSTOMER_URL`** **\*** <p><small>`HTTP_NODE_CONFIG_ELASTICSEARCH_CUSTOMER_URL`<br/>`RMQ_NODE_CONFIG_ELASTICSEARCH_CUSTOMER_URL`<br/>`BI_NODE_CONFIG_ELASTICSEARCH_CUSTOMER_URL`<br/>`DB_MIGRATION_NODE_CONFIG_ELASTICSEARCH_CUSTOMER_URL`</small></p></div> | The base url for the customer elasticsearch cluster | - | - |
| <div style="white-space:pre">**`NODE_CONFIG_ELIGIBILITY_SERVICE_API_KEY`** **\*** <p><small>`HTTP_NODE_CONFIG_ELIGIBILITY_SERVICE_API_KEY`<br/>`RMQ_NODE_CONFIG_ELIGIBILITY_SERVICE_API_KEY`<br/>`BI_NODE_CONFIG_ELIGIBILITY_SERVICE_API_KEY`<br/>`DB_MIGRATION_NODE_CONFIG_ELIGIBILITY_SERVICE_API_KEY`</small></p></div> | The API key used to call eligibility service | - | - |
| <div style="white-space:pre">**`NODE_CONFIG_ELIGIBILITY_SERVICE_BASE_URL`** **\*** <p><small>`HTTP_NODE_CONFIG_ELIGIBILITY_SERVICE_BASE_URL`<br/>`RMQ_NODE_CONFIG_ELIGIBILITY_SERVICE_BASE_URL`<br/>`BI_NODE_CONFIG_ELIGIBILITY_SERVICE_BASE_URL`<br/>`DB_MIGRATION_NODE_CONFIG_ELIGIBILITY_SERVICE_BASE_URL`</small></p></div> | The base url for eligibility service | <pre style="white-space:pre">https://eligibility.dev.tp.stqlp.org</pre> | - |
| <div style="white-space:pre">**`NODE_CONFIG_INMATE_SERVICE_API_KEY`** **\*** <p><small>`HTTP_NODE_CONFIG_INMATE_SERVICE_API_KEY`<br/>`RMQ_NODE_CONFIG_INMATE_SERVICE_API_KEY`<br/>`BI_NODE_CONFIG_INMATE_SERVICE_API_KEY`<br/>`DB_MIGRATION_NODE_CONFIG_INMATE_SERVICE_API_KEY`</small></p></div> | The API key used to call inmate service | - | - |
| <div style="white-space:pre">**`NODE_CONFIG_INMATE_SERVICE_BASE_URL`** **\*** <p><small>`HTTP_NODE_CONFIG_INMATE_SERVICE_BASE_URL`<br/>`RMQ_NODE_CONFIG_INMATE_SERVICE_BASE_URL`<br/>`BI_NODE_CONFIG_INMATE_SERVICE_BASE_URL`<br/>`DB_MIGRATION_NODE_CONFIG_INMATE_SERVICE_BASE_URL`</small></p></div> | The base url for inmate service | <pre style="white-space:pre">https://inmate.dev.tp.stqlp.org</pre> | - |
| <div style="white-space:pre">**`NODE_CONFIG_JWT_ISSUER_URLS`** **\*** <p><small>`HTTP_NODE_CONFIG_JWT_ISSUER_URLS`<br/>`RMQ_NODE_CONFIG_JWT_ISSUER_URLS`<br/>`BI_NODE_CONFIG_JWT_ISSUER_URLS`<br/>`DB_MIGRATION_NODE_CONFIG_JWT_ISSUER_URLS`</small></p></div> | - | - | - |
| <div style="white-space:pre">**`NODE_CONFIG_RMQ_HOSTS`** **\*** <p><small>`HTTP_NODE_CONFIG_RMQ_HOSTS`<br/>`RMQ_NODE_CONFIG_RMQ_HOSTS`<br/>`BI_NODE_CONFIG_RMQ_HOSTS`<br/>`DB_MIGRATION_NODE_CONFIG_RMQ_HOSTS`</small></p></div> | - | - | - |
| <div style="white-space:pre">`NODE_CONFIG_API_KEYS`  <p><small>`HTTP_NODE_CONFIG_API_KEYS`<br/>`RMQ_NODE_CONFIG_API_KEYS`<br/>`BI_NODE_CONFIG_API_KEYS`<br/>`DB_MIGRATION_NODE_CONFIG_API_KEYS`</small></p></div> | - | - | <pre style="white-space:pre">[<br/>  "API_KEY_DEV"<br/>]</pre> |
| <div style="white-space:pre">`NODE_CONFIG_AUTO_REVIEW_CONCURRENCY`  <p><small>`HTTP_NODE_CONFIG_AUTO_REVIEW_CONCURRENCY`<br/>`RMQ_NODE_CONFIG_AUTO_REVIEW_CONCURRENCY`<br/>`BI_NODE_CONFIG_AUTO_REVIEW_CONCURRENCY`<br/>`DB_MIGRATION_NODE_CONFIG_AUTO_REVIEW_CONCURRENCY`</small></p></div> | - | - | <pre style="white-space:pre">100</pre> |
| <div style="white-space:pre">`NODE_CONFIG_AUTO_REVIEW_V2_DATE_SWITCH`  <p><small>`HTTP_NODE_CONFIG_AUTO_REVIEW_V2_DATE_SWITCH`<br/>`RMQ_NODE_CONFIG_AUTO_REVIEW_V2_DATE_SWITCH`<br/>`BI_NODE_CONFIG_AUTO_REVIEW_V2_DATE_SWITCH`<br/>`DB_MIGRATION_NODE_CONFIG_AUTO_REVIEW_V2_DATE_SWITCH`</small></p></div> | - | - | - |
| <div style="white-space:pre">`NODE_CONFIG_CACHE_TIER_1_SECONDS`  <p><small>`HTTP_NODE_CONFIG_CACHE_TIER_1_SECONDS`<br/>`RMQ_NODE_CONFIG_CACHE_TIER_1_SECONDS`<br/>`BI_NODE_CONFIG_CACHE_TIER_1_SECONDS`<br/>`DB_MIGRATION_NODE_CONFIG_CACHE_TIER_1_SECONDS`</small></p></div> | Seconds to live for tier 1 (in memory) cache | - | <pre style="white-space:pre">180</pre> |
| <div style="white-space:pre">`NODE_CONFIG_CACHE_TIER_3_SECONDS`  <p><small>`HTTP_NODE_CONFIG_CACHE_TIER_3_SECONDS`<br/>`RMQ_NODE_CONFIG_CACHE_TIER_3_SECONDS`<br/>`BI_NODE_CONFIG_CACHE_TIER_3_SECONDS`<br/>`DB_MIGRATION_NODE_CONFIG_CACHE_TIER_3_SECONDS`</small></p></div> | Seconds to live for tier 3 (memcached) cache | - | <pre style="white-space:pre">240</pre> |
| <div style="white-space:pre">`NODE_CONFIG_CACHE_TTLS`  <p><small>`HTTP_NODE_CONFIG_CACHE_TTLS`<br/>`RMQ_NODE_CONFIG_CACHE_TTLS`<br/>`BI_NODE_CONFIG_CACHE_TTLS`<br/>`DB_MIGRATION_NODE_CONFIG_CACHE_TTLS`</small></p></div> | Define cache parameters for in memory cache lengths | <pre style="white-space:pre">{<br/>  "ttlLong": 300,<br/>  "ttlMedium": 240,<br/>  "ttlMicro": 60,<br/>  "ttlShort": 180,<br/>  "ttlTiny": 120<br/>}</pre> | <pre style="white-space:pre">{<br/>  "ttlLong": 300,<br/>  "ttlMedium": 240,<br/>  "ttlMicro": 60,<br/>  "ttlShort": 180,<br/>  "ttlTiny": 120<br/>}</pre> |
| <div style="white-space:pre">`NODE_CONFIG_CATALOG_LOCAL_MEDIA_CATALOG_USE_LOCAL_MEDIA`  <p><small>`HTTP_NODE_CONFIG_CATALOG_LOCAL_MEDIA_CATALOG_USE_LOCAL_MEDIA`<br/>`RMQ_NODE_CONFIG_CATALOG_LOCAL_MEDIA_CATALOG_USE_LOCAL_MEDIA`<br/>`BI_NODE_CONFIG_CATALOG_LOCAL_MEDIA_CATALOG_USE_LOCAL_MEDIA`<br/>`DB_MIGRATION_NODE_CONFIG_CATALOG_LOCAL_MEDIA_CATALOG_USE_LOCAL_MEDIA`</small></p></div> | Set to force the container to only serve locally cached products | - | <pre style="white-space:pre">false</pre> |
| <div style="white-space:pre">`NODE_CONFIG_FEATURES_ELIGIBILITY`  <p><small>`HTTP_NODE_CONFIG_FEATURES_ELIGIBILITY`<br/>`RMQ_NODE_CONFIG_FEATURES_ELIGIBILITY`<br/>`BI_NODE_CONFIG_FEATURES_ELIGIBILITY`<br/>`DB_MIGRATION_NODE_CONFIG_FEATURES_ELIGIBILITY`</small></p></div> | - | - | <pre style="white-space:pre">false</pre> |
| <div style="white-space:pre">`NODE_CONFIG_FEATURES_ELIGIBILITY_BY_INMATE_SERVICE`  <p><small>`HTTP_NODE_CONFIG_FEATURES_ELIGIBILITY_BY_INMATE_SERVICE`<br/>`RMQ_NODE_CONFIG_FEATURES_ELIGIBILITY_BY_INMATE_SERVICE`<br/>`BI_NODE_CONFIG_FEATURES_ELIGIBILITY_BY_INMATE_SERVICE`<br/>`DB_MIGRATION_NODE_CONFIG_FEATURES_ELIGIBILITY_BY_INMATE_SERVICE`</small></p></div> | - | - | <pre style="white-space:pre">false</pre> |
| <div style="white-space:pre">`NODE_CONFIG_JWT_DISCOVERY_TTL`  <p><small>`HTTP_NODE_CONFIG_JWT_DISCOVERY_TTL`<br/>`RMQ_NODE_CONFIG_JWT_DISCOVERY_TTL`<br/>`BI_NODE_CONFIG_JWT_DISCOVERY_TTL`<br/>`DB_MIGRATION_NODE_CONFIG_JWT_DISCOVERY_TTL`</small></p></div> | - | - | <pre style="white-space:pre">3600</pre> |
| <div style="white-space:pre">`NODE_CONFIG_JWT_PUBLIC_KEY`  <p><small>`HTTP_NODE_CONFIG_JWT_PUBLIC_KEY`<br/>`RMQ_NODE_CONFIG_JWT_PUBLIC_KEY`<br/>`BI_NODE_CONFIG_JWT_PUBLIC_KEY`<br/>`DB_MIGRATION_NODE_CONFIG_JWT_PUBLIC_KEY`</small></p></div> | - | - | <pre style="white-space:pre">./public.pem</pre> |
| <div style="white-space:pre">`NODE_CONFIG_LISTEN_PORT`  <p><small>`HTTP_NODE_CONFIG_LISTEN_PORT`<br/>`RMQ_NODE_CONFIG_LISTEN_PORT`<br/>`BI_NODE_CONFIG_LISTEN_PORT`<br/>`DB_MIGRATION_NODE_CONFIG_LISTEN_PORT`</small></p></div> | Forcefully set the listen port.<p>By default, the application determines the container listen ports based on the exposed ECS ports, but that can be overriden here.</p> | - | - |
| <div style="white-space:pre">`NODE_CONFIG_LOG_COLORIZE`  <p><small>`HTTP_NODE_CONFIG_LOG_COLORIZE`<br/>`RMQ_NODE_CONFIG_LOG_COLORIZE`<br/>`BI_NODE_CONFIG_LOG_COLORIZE`<br/>`DB_MIGRATION_NODE_CONFIG_LOG_COLORIZE`</small></p></div> | - | - | <pre style="white-space:pre">false</pre> |
| <div style="white-space:pre">`NODE_CONFIG_LOG_FORMAT`  <p><small>`HTTP_NODE_CONFIG_LOG_FORMAT`<br/>`RMQ_NODE_CONFIG_LOG_FORMAT`<br/>`BI_NODE_CONFIG_LOG_FORMAT`<br/>`DB_MIGRATION_NODE_CONFIG_LOG_FORMAT`</small></p></div> | - | - | <pre style="white-space:pre">ecs</pre> |
| <div style="white-space:pre">`NODE_CONFIG_LOG_LEVEL`  <p><small>`HTTP_NODE_CONFIG_LOG_LEVEL`<br/>`RMQ_NODE_CONFIG_LOG_LEVEL`<br/>`BI_NODE_CONFIG_LOG_LEVEL`<br/>`DB_MIGRATION_NODE_CONFIG_LOG_LEVEL`</small></p></div> | - | - | <pre style="white-space:pre">info</pre> |
| <div style="white-space:pre">`NODE_CONFIG_POSTGRES_POOL_OPTIONS`  <p><small>`HTTP_NODE_CONFIG_POSTGRES_POOL_OPTIONS`<br/>`RMQ_NODE_CONFIG_POSTGRES_POOL_OPTIONS`<br/>`BI_NODE_CONFIG_POSTGRES_POOL_OPTIONS`<br/>`DB_MIGRATION_NODE_CONFIG_POSTGRES_POOL_OPTIONS`</small></p></div> | Provide additional options to the underlying pg.Pool.<br/>See here for available options: <ul><li>https://node-postgres.com/apis/pool</li></ul> | - | - |
| <div style="white-space:pre">`NODE_CONFIG_RMQ_DISABLE_SUBSCRIPTIONS`  <p><small>`HTTP_NODE_CONFIG_RMQ_DISABLE_SUBSCRIPTIONS`<br/>`RMQ_NODE_CONFIG_RMQ_DISABLE_SUBSCRIPTIONS`<br/>`BI_NODE_CONFIG_RMQ_DISABLE_SUBSCRIPTIONS`<br/>`DB_MIGRATION_NODE_CONFIG_RMQ_DISABLE_SUBSCRIPTIONS`</small></p></div> | Forcefully enable/disable RMQ subscriptions.<p>By default, the application determines which containers should have subscriptions enabled, but that behavior can be overriden here.</p> | - | - |
| <div style="white-space:pre">`NODE_CONFIG_SQS_CONFIG_SQS_ENABLED`  <p><small>`HTTP_NODE_CONFIG_SQS_CONFIG_SQS_ENABLED`<br/>`RMQ_NODE_CONFIG_SQS_CONFIG_SQS_ENABLED`<br/>`BI_NODE_CONFIG_SQS_CONFIG_SQS_ENABLED`<br/>`DB_MIGRATION_NODE_CONFIG_SQS_CONFIG_SQS_ENABLED`</small></p></div> | Controls whether or not SQS-related features are enabled. For configuration of the queue itself, see `$SHARED_SQS_QUEUE_NAME`. | - | <pre style="white-space:pre">false</pre> |
### VPC Configuration
Properties marked with an asterisk (**\***) are required.
| Variable Name | Description | Example | Default |
| ------------- | ----------- | ------- | ------- |
| <div style="white-space:pre">**`VPC_ID`** **\*** </div> | The VPC into which application components should be provisioned. | - | - |
| <div style="white-space:pre">`VPC_DATABASE_SUBNET_TYPE`  </div> | Used in the query to find database subnets. This should be set to the value of the "subnet_type" tag which should be present on all database subnets | - | <pre style="white-space:pre">database</pre> |
| <div style="white-space:pre">`VPC_PRIVATE_SUBNET_TYPE`  </div> | Used in the query to find private subnets. This should be set to the value of the "subnet_type" tag which should be present on all private subnets | - | <pre style="white-space:pre">private</pre> |
| <div style="white-space:pre">`VPC_PUBLIC_SUBNET_TYPE`  </div> | Used in the query to find public subnets. This should be set to the value of the "subnet_type" tag which should be present on all public subnets | - | <pre style="white-space:pre">public</pre> |

## Externals
This service relies on the following external services. To run locally, be sure these are running and this service is configured appropriately
* SLPAPI
* Eligibility
* Inmate

## Important OpenSearch host machine configuration
This project uses the OpenSearch docker image which requires a host machine (your machine) configuration to be set.
Follow the instructions at the following link to properly configure your machine to run the docker-compose:
https://opensearch.org/docs/latest/install-and-configure/install-opensearch/docker/#important-host-settings

Add file docker-compose.override.yml with following code to expose port 7259 to localhost:7259 (check default.json if port was changed)
```
version: '3'
services:
  services.catalog:
    build: .
    user: "1000"
    volumes:
      - .:/code
    ports:
      - 7259:7259
  catalog.postgres:
    volumes:
      - .:/code
    ports:
      - 5432:5432
```

# Basic Commands Used
```
npm install
npm run build
docker-compose build
docker-compose up -d

# run the unit test
npm run unit-test
# run the integration-test
npm run integration-test
# get the test coverage report
npm run coverage-report
```
* Swagger Documentation - http://localhost:7259/api-docs/#/

# Service Performance Improvements
 
  **Product end points yielding faster responses when millions of products are available**
 
| End Points Affected| HTTP Verb |
| -------------------------- |----------:|
| products/search | post|
| products/{productId}/search | post |
| products | get |

 **Post Requests**

| Requests | Fast/Slow/Not Recommended | Example | Explanation/Reason |
| -------- | ------------------------- | ------- | ------------------ |
| only productTypeId | fast | {"match": { "productTypeId": "music" }} | btree index for the productTypeId exist, which makes the query run better |
| only productId | fast | {"match": { "productId": 1 }} | product_id being the primary key primary key index kicks in which makes the query run better |
| combination of ProductTypeId and ProductId, with some other fields as well | fast | {"match": { "productId": 1, "productTypeId": "music", "source": {"vendorName":"name","vendorProductId": "1" }}} | product_id being the primary key primary key index kicks in which makes the query run better |
| any of the above requests with order by including - meta.startDate | fast |  | btree index for startdate is created,in combination with productTypeId, which makes the query run better, with anything else the query wouldn't be performing that well |
| any of the above requests with order by including - meta.name or meta.year | fast |  | btree index for meta.year is created, in combination with productTypeId, which makes the query run better, with anything else the query wouldn't be performing that well |
| any of the above requests with order by including - meta.basePrice.purchase | fast |  | btree index for meta.basePrice.purchase is created,in combination with productTypeId, which makes the query run better, with anything else the query wouldn't be performing that well |
| any of the above requests with order by including - meta.basePrice.subscription | fast |  | btree index for meta.basePrice.subscription is created, in combination with productTypeId, which makes the query run better, with anything else the query wouldn't be performing that well |
| any of the above requests with order by including - meta.basePrice.rental | fast |  | btree index for meta.basePrice.rental is created, in combination with productTypeId, which makes the query run better, with anything else the query wouldn't be performing that well |


**Any above requests when totals are included in the requests the response would be a little slow.**

| Requests | Fast/Slow/Not Recommended | Example |
| -------- | ------------------------- | ------- |
| productTypeId, with total - true | slow | {"match": { "productTypeId": "music" },"total": true} | as the total involves the entire table is scanned which makes the query perform a bit slower |
| productId, with total - true | slow | {"match": { "productId": 1 },"total": true} | as the total involves the entire table is scanned which makes the query perform a bit slower |


 **Few Recommended examples of the post query**
```
{
    "match": { "productTypeId": "album", "source": { "vendorName": "Audible Magic", "vendorProductId": "567808887" }, "meta": { "genres": "Pop" } }
}
{
    "query": { "productTypeId": "track", "clauses": { "meta.genres": [ "Pop" ] } }, "orderBy": [ { "meta.startDate": "DESC" } ]
}
{
    "query": { "productTypeId": "game", "clauses": { "meta.category": [ "JP5" ] } }, "orderBy": [ { "meta.basePrice.purchase": "DESC" } ]
}
```

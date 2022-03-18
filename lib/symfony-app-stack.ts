import * as cdk from '@aws-cdk/core';
import { 
  InstanceClass, 
  InstanceSize, 
  InstanceType, 
  SubnetType, 
  Vpc 
} from '@aws-cdk/aws-ec2';
import { 
  Credentials, 
  DatabaseInstance, 
  StorageType,
  DatabaseInstanceEngine,
  MariaDbEngineVersion
 } from '@aws-cdk/aws-rds';
import { 
  AwsLogDriver, 
  Cluster, 
  ContainerDefinition, 
  ContainerImage, 
  FargateTaskDefinition, 
  PropagatedTagSource, 
  Secret
} from '@aws-cdk/aws-ecs';
import { 
  LogGroup, 
  RetentionDays 
} from '@aws-cdk/aws-logs';
import { 
  RemovalPolicy,
  Duration
} from '@aws-cdk/core';

import path = require('path');
import { HostedZone } from '@aws-cdk/aws-route53';
import { DnsValidatedCertificate } from '@aws-cdk/aws-certificatemanager';
import { ApplicationLoadBalancedFargateService } from '@aws-cdk/aws-ecs-patterns';


interface SymfonyAppProps extends cdk.StackProps {
  readonly dev: boolean;
}

export class SymfonyAppStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props: SymfonyAppProps) {
    super(scope, id, props);

    // Default VPC
    const vpc = Vpc.fromLookup(this, "Vpc", {
      isDefault: true,
    });

    // Database
    const db = new DatabaseInstance(this, "Database", {
      removalPolicy: props.dev ? cdk.RemovalPolicy.DESTROY : cdk.RemovalPolicy.SNAPSHOT,
      multiAz: false,
      engine: DatabaseInstanceEngine.mariaDb({
        version: MariaDbEngineVersion.VER_10_5,
      }),
      // optional, defaults to m5.large
      instanceType: InstanceType.of(InstanceClass.T3, InstanceSize.MICRO),
      allocatedStorage: 5,
      storageType: StorageType.STANDARD,
      deleteAutomatedBackups: props.dev,
      vpc,

      publiclyAccessible: false,
      vpcSubnets: {
        subnetType: SubnetType.PUBLIC,
      },
      databaseName: "db",
      credentials: Credentials.fromGeneratedSecret("db_user"),
    });

    if (!db.secret) {
      throw new Error("No Secret on RDS Database");
    }

    const cluster = new Cluster(this, "Cluster", { vpc });
    const taskDefinition = new FargateTaskDefinition(this, "TaskDefinition", { 
      cpu: 512,
      memoryLimitMiB: 1024
    });

    const logging = new AwsLogDriver({
      streamPrefix: "symfony-app",
      logGroup: new LogGroup(this, "LogGroup", { 
        removalPolicy: RemovalPolicy.DESTROY,
        retention: RetentionDays.ONE_MONTH,
      }),
    });

    /**
     * This one serves on internet
     */
    const nginxContainer = new ContainerDefinition(this, "nginx", { 
      image: ContainerImage.fromAsset(path.resolve(__dirname, "..", "app"), {
        file: "docker/nginx/Dockerfile",
      }),
      taskDefinition,
      logging,
      environment: {
        PHP_HOST: "localhost",
      },
    });

    nginxContainer.addPortMappings({
      containerPort: 80,
    });

    const image = ContainerImage.fromAsset(path.resolve(__dirname, "..", "app"), {
      file: "docker/php-fpm/Dockerfile",
    });

    const phpContainer = new ContainerDefinition(this, "php", {
      image,
      taskDefinition,
      logging,
      environment: {
        // set the correct Symfony env
        APP_ENV: "prod",
        // set the correct DB driver
        DB_DRIVER: "pdo_mysql",
      },
      secrets: {
        DB_USER: Secret.fromSecretsManager(db.secret, "username"),
        DB_PASS: Secret.fromSecretsManager(db.secret, "password"),
        DB_HOST: Secret.fromSecretsManager(db.secret, "host"),
        DB_NAME: Secret.fromSecretsManager(db.secret, "dbname"),
        DB_PORT: Secret.fromSecretsManager(db.secret, "port")
      },
    });

    // get the hostedZone
    const hostedZone = HostedZone.fromLookup(this, "Zone", {
      domainName: "bradlatham.com"
    });

    // full domain name for
    const domainName = "app.bradlatham.com";

    // create the https certificate
    const certificate = new DnsValidatedCertificate(this, "SiteCertificate", {
      domainName,
      hostedZone,
      region: cdk.Aws.REGION,
    });

    // then create ALB and Fargate Service HTTPS
    const application = new ApplicationLoadBalancedFargateService(this, "Service", {
      cluster,
      certificate,
      domainName,
      domainZone: hostedZone,
      taskDefinition,
      // how many tasks do you want to run ?
      desiredCount: 1,
      propagateTags: PropagatedTagSource.SERVICE,
      redirectHTTP: true,
      // following is needed as we are on a public subnet.
      assignPublicIp: true,
    });

    application.targetGroup.configureHealthCheck({
      healthyHttpCodes: "200,307",
      interval: Duration.minutes(5),
    });

    db.connections.allowDefaultPortFrom(application.service);
  }
}

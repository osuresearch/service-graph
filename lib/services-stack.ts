import * as path from 'path';
import { Duration, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Code, Function, FunctionProps, Runtime, Tracing } from 'aws-cdk-lib/aws-lambda';
import { LambdaRestApi } from 'aws-cdk-lib/aws-apigateway';
import { User } from 'aws-cdk-lib/aws-iam';
import { Vpc, SecurityGroup, ISecurityGroup, IVpc } from 'aws-cdk-lib/aws-ec2';
import { BlockPublicAccess, Bucket, BucketEncryption } from 'aws-cdk-lib/aws-s3';
import { Queue } from 'aws-cdk-lib/aws-sqs';
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import * as dotenv from 'dotenv';

function env(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required envvar: ${name}`);
  }

  return value;
}

export class ServicesStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    dotenv.config();
    const vpc = Vpc.fromVpcAttributes(this, 'Services VPC', {
      vpcId: env('VPC_ID'),
      availabilityZones: [env('AZ')],
      privateSubnetIds: process.env.SUBNET_ID
        ? [process.env.SUBNET_ID]
        : undefined
    });

    const securityGroup = SecurityGroup.fromSecurityGroupId(
      this,
      'Common services security group',
      env('SECURITY_GROUP_ID'),
    );

    this.addService('graphqlSearch', 'search');

    this.addIngestService(vpc, securityGroup);
  }

  /**
   * Generic service setup that's an API gateway + Lambda GraphQL Subgraph resolver
   *
   * @param name
   * @param dirname
   * @param props
   */
  addService(name: string, dirname: string, props?: Partial<FunctionProps>) {
    const serviceLambda = new Function(this, name, {
      code: Code.fromAsset(path.join(__dirname, '../packages/' + dirname)),
      handler: 'dist/index.handler',
      runtime: Runtime.NODEJS_16_X,
      tracing: Tracing.ACTIVE, // XRAY

      // Give services a WIDE timeout, since many still
      // depend on backends that aren't super performant
      // (lookin' at you, MSSQL)
      timeout: Duration.seconds(15),
      ...props
    });

    const api = new LambdaRestApi(this, name + 'Endpoint', {
      handler: serviceLambda,
      deployOptions: {
        tracingEnabled: true, // XRAY things
      }
    });
  }

  addIngestService(vpc: IVpc, securityGroup: ISecurityGroup) {
    const code = Code.fromAsset(path.join(__dirname, '../packages/ingest'));

    const ingestFunction = new Function(this, 'graphqlIngest', {
      code,
      handler: 'dist/ingest.handler',
      runtime: Runtime.NODEJS_16_X,
      tracing: Tracing.ACTIVE, // XRAY
      timeout: Duration.seconds(15),
      vpc,
      securityGroups: [securityGroup]
    });

    const api = new LambdaRestApi(this, 'graphqlIngestEndpoint', {
      handler: ingestFunction,
      deployOptions: {
        tracingEnabled: true, // XRAY things
      }
    });

    const ingestQueue = new Queue(this, 'ingestQueue', {
      queueName: 'GraphQLIngestQueue',
    });

    // TODO: Will need credentials to OpenSearch
    const batchFunction = new Function(this, 'ingestBatching', {
      code,
      handler: 'dist/batch.handler',
      runtime: Runtime.NODEJS_16_X,
      tracing: Tracing.ACTIVE,
      // Note that timeout cannot exceed the connected SQS
      // service's visibility timeout (default to 30s)
      timeout: Duration.seconds(30),
      vpc,
      securityGroups: [securityGroup],
    });

    batchFunction.addEventSource(new SqsEventSource(ingestQueue));

    ingestQueue.grantSendMessages(ingestFunction);
    ingestQueue.grantConsumeMessages(batchFunction);

    // TODO: Dead letter queue for reporting batching issues.
  }
}

import * as path from 'path';
import { Duration, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Code, Function, Runtime, Tracing } from 'aws-cdk-lib/aws-lambda';
import { LambdaRestApi } from 'aws-cdk-lib/aws-apigateway';
import { Effect, Policy, PolicyStatement, User } from 'aws-cdk-lib/aws-iam';

export interface GatewayStackProps extends StackProps {

}

/**
 * Deploy a GraphQL federated gateway (aka router) service
 */
export class GatewayStack extends Stack {
  constructor(scope: Construct, id: string, props?: GatewayStackProps) {
    super(scope, id, props);

    const name = 'graphqlGateway';
    const serviceLambda = new Function(this, name, {
      code: Code.fromAsset(path.join(__dirname, '../packages/gateway')),
      handler: 'dist/index.handler',
      runtime: Runtime.NODEJS_16_X,
      tracing: Tracing.ACTIVE, // XRAY

      // Give the gateway a WIDE timeout - on cold boot we
      // need to introspect all the subgraph services.
      // This won't scale, so I'll be building some cache solution.
      timeout: Duration.seconds(15),

      environment: {
        NODE_ENV: 'development',
      },
    });

    // The gateway service needs to be able to search for
    // and aggregate deployed subgraph services via tags.
    const policy = new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ['tag:GetResources'],
      /*
        xray:PutTraceSegments
        xray:PutTelemetryRecords
      */
      resources: ['*'],
    });

    serviceLambda.addToRolePolicy(policy);

    const api = new LambdaRestApi(this, name + 'Endpoint', {
      handler: serviceLambda,
      deployOptions: {
        tracingEnabled: true, // XRAY things
      }
    });

    // TODO: Also deploy a task that periodically pings the
    // gateway for health checks to keep it warmed up during
    // business hours. Otherwise, schema loading impacts
    // boot time by ~5-10 seconds.
  }
}

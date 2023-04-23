#!/usr/bin/env node
import 'source-map-support/register'
import { App, Tags } from 'aws-cdk-lib'
import { GatewayStack } from '../lib/gateway-stack';
import { ServicesStack } from '../lib/services-stack';

const app = new App();

// Setup subgraph services first 
const services = new ServicesStack(app, 'GraphQLServicesStack');

// Tag all API gateways in the services stack.
// This will allow the gateway to locate services dynamically later.
Tags.of(services).add('ResearchAPIServiceType', 'Subgraph', {
  includeResourceTypes: ['AWS::ApiGateway::RestApi'],
});

// Setup the gateway / ingress to support GraphQL federation
new GatewayStack(app, 'GraphQLGatewayStack');

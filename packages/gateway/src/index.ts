import XRay, { Subsegment } from 'aws-xray-sdk';
import { createSchema, createYoga, maskError } from 'graphql-yoga'
import { ApolloGateway } from '@apollo/gateway'
import { useApolloFederation } from '@envelop/apollo-federation'
import { useApolloTracing } from '@envelop/apollo-tracing'
import { useApolloInlineTrace } from '@graphql-yoga/plugin-apollo-inline-trace'
import { APIGatewayEvent, APIGatewayProxyResult, Context, Handler } from 'aws-lambda'
import { ResourceGroupsTaggingAPIClient, GetResourcesCommand } from '@aws-sdk/client-resource-groups-tagging-api';

async function loadGateway(tries: number): Promise<ApolloGateway> {
  // Locate all services deployed on AWS.
  // This includes not just our own local services
  // but services that other apps may have deployed.
  const client = new ResourceGroupsTaggingAPIClient({
    region: 'us-east-2'
  });

  const cmd = new GetResourcesCommand({
    TagFilters: [
      {
        Key: 'ResearchAPIServiceType',
        Values: ['Subgraph'],
      }
    ]
  });

  const response = await client.send(cmd);

  const serviceList = (response.ResourceTagMappingList ?? [])
    .filter((tag) => tag.ResourceARN)
    .map((tag) => {
      const arnParts = (tag.ResourceARN as string).split(':');
      const region = arnParts[3];
      const apiId = arnParts[5].split('/')[2];

      // TODO: Human readable service names?
      return {
        name: 'service-' + apiId,
        url: `https://${apiId}.execute-api.${region}.amazonaws.com/prod/graphql`,
      }
    });

  console.log(serviceList);

  // Initialize the gateway.
  // TODO: Since we're using introspection, this will
  // call out to every service to grab the schema which
  // won't scale well as we add more services.
  const gateway = new ApolloGateway({
    debug: true,
    serviceList,
  })

  const subsegment = XRay.getSegment()?.addNewSubsegment('Load gateway');

  try {
    await gateway.load();
    return gateway;
  }
  catch (err) {
    if (tries > 0) {
      return loadGateway(tries - 1);
    }
    throw err;
  }
  finally {
    subsegment?.close();
  }
}

async function createHandler() {
  // Try to load services 2 times.
  // This handles cold boot timeout issues with Lambda functions
  // or other intermittent failures.
  const gateway = await loadGateway(2);

  return createYoga<{
    event: APIGatewayEvent
    lambdaContext: Context
  }>({
    graphqlEndpoint: '/graphql',
    landingPage: false,
    schema: createSchema({
      typeDefs: /* GraphQL */`
        type Query {
          greetings: String
        }
      `,
      resolvers: {
        Query: {
          greetings: () => 'Hello world'
        }
      }
    }),

    maskedErrors: {
      // Allow subgraphs to bubble up errors to the gateway.
      // TODO: This is for a dev mode and not for production.

      maskError(error: any, message, isDev) {
        if (error?.extensions?.code === 'DOWNSTREAM_SERVICE_ERROR') {
          return error
        }

        return maskError(error, message, isDev)
      }
    },

    plugins: [
      useApolloInlineTrace(),
      useApolloTracing(),
      useApolloFederation({
        gateway,
        metrics: {
          captureTraces: true,
          persistedQueryHit: true,
          persistedQueryRegister: true,
          responseCacheHit: true,
          forbiddenOperation: true,
          registeredOperation: true
        }
      })
    ]
  })
}

// Create Yoga and federation gateway during first execution
// of the handler container and cache it in a promise
let cachedHandler = createHandler();

export async function handler(
  event: APIGatewayEvent,
  lambdaContext: Context
): Promise<APIGatewayProxyResult> {

  XRay.captureAWS(require("aws-sdk"));
  XRay.captureHTTPsGlobal(require("http"), true);
  XRay.captureHTTPsGlobal(require("https"), true);
  XRay.capturePromise();

  if (!cachedHandler) {
    cachedHandler = createHandler();
  }

  // TODO: Handle situations where an upstream is misconfigured
  // so it doesn't take down the entire gateway.

  const yoga = await cachedHandler;

  const segment = XRay.getSegment()?.addNewSubsegment("Yoga fetch");
  if (!segment) {
    throw new Error('Could not instantiate X-ray segment');
  }

  try {
    const urlStr = event.path + '?' + new URLSearchParams(
      (event.queryStringParameters as Record<string, string>) || {}
    ).toString();

    const response = await yoga.fetch(
      urlStr,
      {
        method: event.httpMethod,
        headers: event.headers as HeadersInit,
        body: event.body
          ? Buffer.from(event.body, event.isBase64Encoded ? 'base64' : 'utf-8')
          : undefined,
      },
      { event, lambdaContext }
    );

    const responseHeaders = Object.fromEntries(response.headers.entries());
    return {
      statusCode: response.status,
      headers: responseHeaders,
      body: await response.text(),
      isBase64Encoded: false,
    }
  }
  catch (e) {
    console.error(e);
    throw e;
  }
  finally {
    if (!segment.isClosed()) {
      segment.close();
    }
  }
}

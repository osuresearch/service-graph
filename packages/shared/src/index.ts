import { DocumentNode } from "graphql";
import { buildSubgraphSchema } from "@apollo/subgraph";
import { GraphQLResolverMap } from '@apollo/subgraph/dist/schema-helper';
import { APIGatewayEvent, Context, APIGatewayProxyResult } from "aws-lambda";
import { createYoga, YogaServerInstance } from "graphql-yoga";
import { useApolloInlineTrace } from '@graphql-yoga/plugin-apollo-inline-trace'
import { useApolloTracing } from '@envelop/apollo-tracing'

export type BaseGraphQLServiceContext = {
  event: APIGatewayEvent
  lambdaContext: Context
}

export function createYogaSubgraph<TContext extends BaseGraphQLServiceContext>(
  typeDefs: DocumentNode,
  resolvers: GraphQLResolverMap<TContext>
): YogaServerInstance<TContext, {}> {
  return createYoga<TContext>({
    graphqlEndpoint: '/graphql',
    landingPage: false,
    schema: buildSubgraphSchema({
      typeDefs,
      resolvers: resolvers as GraphQLResolverMap<any>,
    }),
    plugins: [
      useApolloInlineTrace(),
      useApolloTracing(),
    ],
  });
}

/**
 * Factory to create a new Lambda function handler
 * for a federated GraphQL subgraph using GraphQL Yoga.
 *
 * @param yoga    GraphQL Yoga server instance created through
 *                `createYogaSubgraph`.
 *
 * @param context Context values specific to this subgraph service.
 *                Typically this will contain data loaders or some
 *                sort of shared state.
 *
 *                The Lambda-specific context values will be automatically
 *                injected while handling a request routed from the API gateway.
 *
 * @returns       A lambda handler function for routing API Gateway requests
 *                to GraphQL Yoga.
 */
export async function createSubgraphHandler<TContext extends BaseGraphQLServiceContext>(
  yoga: YogaServerInstance<TContext, {}>,
  context: Omit<TContext, 'event' | 'lambdaContext'>
) {
  return async (
    event: APIGatewayEvent,
    lambdaContext: Context
  ): Promise<APIGatewayProxyResult> => {

    const urlStr = event.path + '?' + new URLSearchParams(
      (event.queryStringParameters as Record<string, string>) || {}
    ).toString();

    const url = new URL(urlStr);

    const response = await yoga.fetch(
      url,
      {
        method: event.httpMethod,
        headers: event.headers as HeadersInit,
        body: event.body
          ? Buffer.from(event.body, event.isBase64Encoded ? 'base64' : 'utf-8')
          : undefined,
      },
      { event, lambdaContext, ...context } as TContext
    );

    const responseHeaders = Object.fromEntries(response.headers.entries());
    return {
      statusCode: response.status,
      headers: responseHeaders,
      body: await response.text(),
      isBase64Encoded: false,
    }
  }
}

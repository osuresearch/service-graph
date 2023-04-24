import { GraphQLResolverMap } from '@apollo/subgraph/dist/schema-helper';
import { GetQueueUrlCommand, SendMessageCommand, SQSClient } from '@aws-sdk/client-sqs';
import { Resource, IngestServiceContext } from './types';

const sqs = new SQSClient({
  region: process.env.AWS_REGION,
});

function validate(resources: Resource[]) {
  // TODO: Check and throw.
}

export const resolvers: GraphQLResolverMap<IngestServiceContext> = {
  Mutation: {
    ingest: async (_, { documents, priority }, { foo }) => {
      console.log(documents, priority);

      validate(documents);

      // TODO: Only need to do this once. 
      const queue = await sqs.send(new GetQueueUrlCommand({
        QueueName: 'GraphQLIngestQueue'
      }));

      sqs.send(new SendMessageCommand({
        QueueUrl: queue.QueueUrl,
        MessageAttributes: {
          Author: {
            DataType: 'String',
            StringValue: 'Foobar',
          }
        },
        // Let the batch process sort it out
        MessageBody: JSON.stringify(documents),
      }));
    },
    bulk: async(_, { name }, { foo }) => {
      console.log('Bulk', name);
    },
  },
}

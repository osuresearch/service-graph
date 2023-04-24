import { createSubgraphHandler, createYogaSubgraph } from '@osuresearch/api-shared'
import { resolvers } from './resolvers'
import { typeDefs } from './typedefs';
import { IngestServiceContext } from './types';

const yoga = createYogaSubgraph<IngestServiceContext>(
  typeDefs,
  resolvers
);

export const handler = createSubgraphHandler<IngestServiceContext>(
  yoga, {
    foo: 'bar',
  }
);

import { parse, DocumentNode } from 'graphql'

export const typeDefs: DocumentNode = parse(/* GraphQL */ `  
  scalar DateTime

  type Mutation {
    """
    Feed one or more searchable documents into 
    the search indices. If there is a conflict with
    an existing document, the ingested document will
    replace the old copy. 

    This is a queued process and searchability
    is not immediate unless \`priority\` is specified. 
    """
    ingest(
      documents: [Document!]!

      """
      If this is a priority ingestion, the 
      documents will be made available immediately
      after execution.

      Do not abuse this, as it's a blocking process
      on the OpenSearch service that forces reindexing
      of all applicable indices. 
      """
      priority: Boolean

      # TODO: Merge flag? Can I do that?
    ): [Document!]!

    """
    Perform backend bulk indexing operation for
    the given process name. 
    
    Use cases:
    - Reindexing data that changes outside of our
      control (e.g. financials and HR imports)
    - Scheduled sync jobs
    """
    bulk(name: string): BulkResults!
  }

  type BulkResults {
    status: Boolean!
  }

  # Stub resolved by the search service
  type Document @key(fields: "id", resolvable: false) {
    id: ID!
  }
`);


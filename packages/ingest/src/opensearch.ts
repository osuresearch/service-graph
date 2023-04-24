import { Client } from '@opensearch-project/opensearch';
// import { AwsSigv4Signer } from '@opensearch-project/opensearch/aws';
// import { defaultProvider } from '@aws-sdk/credential-provider-node';
import { Resource } from './types';
import { OPENSEARCH_INDEX_MAPPINGS, OPENSEARCH_INDEX_SETTINGS } from './config';

/**
 * OpenSearch client instance
 */
let client: Client | undefined;

/**
 * Setup a connection between services for ETL
 */
export async function connect() {
  if (client) {
    return client;
  }

  client = new Client({
    node: process.env.OPENSEARCH_SERVER,
    // ...AwsSigv4Signer({
    //   region: 'us-east-2',
    //   getCredentials: () => {
    //     // Any other method to acquire a new Credentials object can be used.
    //     const credentialsProvider = defaultProvider();
    //     return credentialsProvider();
    //   },
    // }),
    auth: {
      username: process.env.OPENSEARCH_USER as string,
      password: process.env.OPENSEARCH_PASS as string,
    },
  });

  // TODO: Validate connections

  // Pull in rules for attributes
  // loadRules()

  return client;
}

export async function disconnect() {
  await client?.close();
  client = undefined;
}

/**
 * Destroy and re-create an index.
 *
 * If index mappings need to change or we're bulk
 * indexing the entire index, this should be called.
 *
 * @param index
 */
export async function rebuild(index: string)
{
  const client = await connect();

  console.log(`Deleting index ${index}...`);

  let response = await client.indices.delete({
    index
  }, { ignore: [400, 404] }); // 404 seems to be NOT ignored in the latest update.

  if (!response.body.acknowledged && response.body.status !== 404) {
    console.error('Unexpected response', response.body);
    throw new Error('Failed to delete index');
  }

  console.log(`Creating index ${index}...`);

  response = await client.indices.create({
    index,
    body: {
      settings: OPENSEARCH_INDEX_SETTINGS,
      mappings: OPENSEARCH_INDEX_MAPPINGS,
    }
  });

  if (!response.body.acknowledged) {
    console.error('Unexpected response', response.body);
    throw new Error('Failed to create index');
  }
}

/**
 * Perform a bulk import of the given resources into OpenSearch
 *
 * @param index     Destination index that the service account has write access
 * @param resources List of resources to bulk import
 *
 * @return number of successful resources indexed
 */
export async function bulk(index: string, resources: Resource[])
{
  const client = await connect();

  console.log(`Bulk indexing ${resources.length} resource to ${index}...`);

  const response = await client.helpers.bulk<Resource>({
    datasource: resources,
    onDocument(doc) {
      if (!doc.id) {
        console.error('Document missing required id field', doc);
        throw new Error('Document missing required id field');
      }
      return [
        { update: {
          _index: index,
          _id: doc.id
        }},
        { doc_as_upsert: true }
      ];
    },
    onDrop(doc) {
      console.error(doc);
    },
  });

  console.log('bulk response', response);

  if (response.failed > 0) {
    throw new Error(
      `${response.failed} / ${response.total} failed to index`
    );
  }

  return response.successful;
}

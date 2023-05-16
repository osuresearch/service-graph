import { Context, Handler, SQSBatchItemFailure, SQSBatchResponse, SQSEvent } from 'aws-lambda';
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from '@aws-sdk/client-secrets-manager';
import middy from '@middy/core';
import secretsManager from '@middy/secrets-manager';

const SECRET_ID = 'dev/service-graph/ingest';

type QueuedBatch = Record<string, { index: string, ids: string[] }>;

async function processQueue(queue: QueuedBatch): Promise<SQSBatchItemFailure[]> {
  console.log('process queue', queue);
  return [];
}

async function batch(event: SQSEvent, context: Context): Promise<SQSBatchResponse> {
  
  console.log('EVENT: \n' + JSON.stringify(event, null, 2));

  // Mapping of Table -> Index & IDs. Allowing multiple 
  // tables to load into the same index. 
  let queued: QueuedBatch = {};
  let batchItemFailures: SQSBatchItemFailure[] = [];

  event.Records.forEach((record) => {
    console.log('Record', record);
    const index = record.messageAttributes.Index.stringValue;
    const table = record.messageAttributes.Table.stringValue;
    const ids = record.body.split(',').filter((id) => id);

    if (!index || !table || ids.length < 1) {
      console.error('Malformed record', record);
      batchItemFailures.push({
        itemIdentifier: record.messageId
      });
      return;
    }

    if (!queued[table]) {
      queued[table] = { index, ids };
      return;
    }
  
    if (queued[table].index !== index) {
      console.error('Cannot batch a table into multiple indices', record);
      batchItemFailures.push({
        itemIdentifier: record.messageId
      });
      return;
    }

    // TODO: DLQ for any of the above conditions?

    queued[table].ids.push(...ids);
  });

  const failures = await processQueue(queued);
  batchItemFailures.push(...failures);

  return {
    batchItemFailures
  };
}

const handler = middy(batch).use([
  secretsManager({
    fetchData: {
      serviceAccounts: 'dev/service-graph/ingest'
    },
    awsClientOptions: {
      region: 'us-east-2'
    },
    setToContext: true
  })
]);

export default handler;

/**
 * Load and validate secrets from Secrets Manager.
 *  
 * TODO: Replace all this with something like Middy instead
 * https://middy.js.org/docs/
 * 
 * @throws on any error while loading and parsing secrets
 */
// async function loadSecrets() {
//   const client = new SecretsManagerClient({
//     region: "us-east-2",
//   });

//   let response;

//   try {
//     response = await client.send(
//       new GetSecretValueCommand({
//         SecretId: SECRET_ID
//       })
//     );
//   } catch (e) {
//     console.error('Failed to retrieve secrets', e);
//     throw e;
//   }

//   try {
//     const secrets = JSON.parse(response.SecretString as string);

//     // TODO: Validate. Keys expected: OPENSEARCH_USER/PASS, DATABASE_USER/PASS
//     return secrets;
//   }
//   catch (e) {
//     console.error('Malformed secret value', e);
//     throw e;
//   }
// }

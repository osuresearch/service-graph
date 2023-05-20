import { Context as LambdaContext, Handler, SQSBatchItemFailure, SQSBatchResponse, SQSEvent } from 'aws-lambda';
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from '@aws-sdk/client-secrets-manager';
import middy from '@middy/core';
import secretsManager from '@middy/secrets-manager';
import errorLogger from '@middy/error-logger';
import { bulkUpsert } from './bulk';
import { connect as MSSQLConnect } from './mssql';
import { connect as OSConnect, disconnect } from './opensearch';

// Mapping of table/view to a target index with IDs to load in.
type BatchInfo = {
  index: string
  ids: string[]
  batchId: string
}

type TableName = string;

type QueuedBatch = Record<TableName, BatchInfo>;

async function processQueue(queue: QueuedBatch): Promise<SQSBatchItemFailure[]> {
  console.log('process queue', queue);

  const failures: SQSBatchItemFailure[] = [];

  for (const table in queue) {
    const index = queue[table].index;
    const ids = queue[table].ids;

    try {
      await bulkUpsert(index, table, ids);
    } 
    catch (e) {
      failures.push({ 
        itemIdentifier: queue[table].batchId
      });
    }
  }

  return failures;
}

type Context = LambdaContext & {
  // Provided by Middy
  serviceAccounts: {
    openSearchServer: string
    openSearchUser: string 
    openSearchPass: string 
    sqlServer: string 
    sqlUser: string
    sqlPass: string
    sqlDatabase: string
  };
}

async function batch(event: SQSEvent, context: Context): Promise<SQSBatchResponse> {
  
  console.log('EVENT: \n' + JSON.stringify(event, null, 2));

  // Mapping of Table -> Index & IDs. Allowing multiple 
  // tables to load into the same index. 
  let queued: QueuedBatch = {};
  let batchItemFailures: SQSBatchItemFailure[] = [];

  console.log(context.serviceAccounts);

  // TODO: Use middy-rds or similar.
  // Credential management will be a bit iffy though.

  // Also don't do this synchronously.

  await MSSQLConnect(
    context.serviceAccounts.sqlServer,
    context.serviceAccounts.sqlUser,
    context.serviceAccounts.sqlPass,
    context.serviceAccounts.sqlDatabase
  );

  // working around a potential timeout issue for long polling.
  disconnect();
  await OSConnect(
    context.serviceAccounts.openSearchServer,
    context.serviceAccounts.openSearchUser,
    context.serviceAccounts.openSearchPass
  );

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
      queued[table] = { index, ids, batchId: record.messageId };
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
  errorLogger(),
  secretsManager({
    fetchData: {
      serviceAccounts: process.env.INTEGRATION_SECRETS_ID ?? '',
    },
    awsClientOptions: {
      region: 'us-east-2'
    },
    setToContext: true
  })
]);

exports.handler = handler;

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

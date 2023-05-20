import path from 'path';
import * as dotenv from 'dotenv';
import { bulkRebuild } from './bulk';

// Load .env from monorepo root.
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

/**
 * One-shot on demand ETL
 */
async function run() {
  if (!process.env.OPENSEARCH_SERVER) {
    throw new Error('Missing required envvars. Check your .env at the monorepo root.');
  }

  const index = process.argv[2];
  const table = process.argv[3];

  if (!index || !table) {
    throw new Error('Missing command line args. Expected "ondemand indexName tableName"')
  }

  console.log('Running bulk rebuild', index, table);

  await bulkRebuild(index, table);
}

run();

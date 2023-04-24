import fs from 'fs';
import path from 'path';
import sql from 'mssql';
import { connect as OSConnect, disconnect as OSDisconnect, rebuild, bulk } from './opensearch';
import { connect as MSSQLConnect, disconnect as MSSQLDisconnect, batch } from './mssql';
import { Resource } from './types';

import * as dotenv from 'dotenv';
import { Atom } from '@osuresearch/types';
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

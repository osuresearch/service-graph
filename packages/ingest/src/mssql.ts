import XRay from 'aws-xray-sdk';
import sql, { ConnectionPool } from 'mssql';
import { GraphQLError } from 'graphql';
import { resolve } from 'path';

// Connection pool used for subsequent requests
let connectionPool: ConnectionPool | undefined;

export async function connect() {
  if (connectionPool?.connected) {
    return connectionPool;
  }

  const server = process.env.DATABASE_HOST as string;
  const user = process.env.DATABASE_USER as string;
  const password = process.env.DATABASE_PASS as string;
  const database = process.env.DATABASE_NAME as string;
  const xrayEnabled = process.env.AWS_XRAY_ENABLED === 'true';

  const config: sql.config = {
    server,
    user,
    password,
    database,
    pool: {
      max: 10,
      min: 0,
      idleTimeoutMillis: 30000
    },
    options: {
      // Certain platforms do not support encrypted connections.
      encrypt: false,
    },
    // See: https://www.npmjs.com/package/mssql#json-support
    parseJSON: true
  }

  const segment = xrayEnabled && XRay.getSegment();
  const subsegment = segment && segment.addNewSubsegment('MSSQL Connect');

  try {
    connectionPool = await sql.connect(config);
    return connectionPool;
  }
  catch (err) {
    // ... error checks
    console.error(err);

    // TODO: Some kind of CloudWatch trace ID... thing?
    // Digging for it sucks.
    throw new GraphQLError(
      'Failed to connect to MSSQL backend. See CloudWatch for details'
    );
  }
  finally {
    subsegment && subsegment.close();
  }
}

export async function disconnect() {
  connectionPool?.close();
  connectionPool = undefined;
}


export type BatchCallback = (rows: any[]) => Promise<void>

/**
 * Batch process rows coming from a SQL query to stream large
 * datasets through services.
 *
 * @param query     SQL query to execute against the current connection.
 * @param onBatch   Callback to process up to `batchSize` rows.
 * @param rowCount  Maximum rows per batch.
 * @returns
 */
export async function batch(query: string, onBatch: BatchCallback, batchSize: number = 1000) {
  const promise = new Promise<void>(async (resolve, reject) => {
    const conn = await connect();

    const request = conn.request();
    request.stream = true;
    request.query(query);

    let rows: any[] = [];

    const process = async () => {
      try {
        await onBatch(rows);
      } catch (err) {
        reject(`Error from batch callback: ${err}`);
      }

      rows = [];
      request.resume();
    }

    request.on('error', (err) => {
      reject(`Error from sql.Request: ${err}`);
    });

    // Aggregate and run the processor in bulk
    request.on('row', async (row) => {
      rows.push(row);
      if (rows.length >= batchSize) {
        request.pause();
        await process();
      }
    });

    // flush remaining rows
    request.on('done', async () => {
      if (rows.length > 0) {
        await process();
      }

      resolve();
    });
  });

  await promise;
}

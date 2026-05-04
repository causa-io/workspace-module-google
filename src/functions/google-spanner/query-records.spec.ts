import { WorkspaceContext } from '@causa/workspace';
import { DatabaseQueryRecords } from '@causa/workspace-core';
import { DockerEmulatorService } from '@causa/workspace-core/services';
import { NoImplementationFoundError } from '@causa/workspace/function-registry';
import { createContext } from '@causa/workspace/testing';
import { Spanner } from '@google-cloud/spanner';
import { grpc } from 'google-gax';
import 'jest-extended';
import {
  DatabaseQueryRecordsForSpanner,
  SPANNER_QUERY_RECORDS_LIMIT,
} from './query-records.js';

const SPANNER_IMAGE = 'gcr.io/cloud-spanner-emulator/emulator:latest';
const SPANNER_HOST_GRPC_PORT = 19010;
const SPANNER_HOST_HTTP_PORT = 19020;
const SPANNER_CONTAINER_NAME = 'causa-test-spanner-query-records';
const PROJECT_ID = 'demo-spanner-query-records';
const INSTANCE_NAME = 'local';
const DATABASE_NAME = 'my-db';

describe('DatabaseQueryRecordsForSpanner', () => {
  let context: WorkspaceContext;
  let dockerEmulatorService: DockerEmulatorService;

  beforeAll(async () => {
    ({ context } = createContext({
      configuration: {
        workspace: { name: 'spanner-query-records-test' },
        google: {
          project: PROJECT_ID,
          spanner: { instance: { name: INSTANCE_NAME } },
        },
      },
      functions: [DatabaseQueryRecordsForSpanner],
    }));
    dockerEmulatorService = context.service(DockerEmulatorService);
    await dockerEmulatorService.start(SPANNER_IMAGE, SPANNER_CONTAINER_NAME, [
      { host: '127.0.0.1', local: SPANNER_HOST_GRPC_PORT, container: 9010 },
      { host: '127.0.0.1', local: SPANNER_HOST_HTTP_PORT, container: 9020 },
    ]);
    await dockerEmulatorService.waitForAvailability(
      SPANNER_CONTAINER_NAME,
      `http://127.0.0.1:${SPANNER_HOST_HTTP_PORT}/v1/projects/${PROJECT_ID}/instances`,
    );
    process.env.SPANNER_EMULATOR_HOST = `127.0.0.1:${SPANNER_HOST_GRPC_PORT}`;
    const spanner = new Spanner({
      servicePath: '127.0.0.1',
      port: SPANNER_HOST_GRPC_PORT,
      projectId: PROJECT_ID,
      sslCreds: grpc.credentials.createInsecure(),
    });
    const [instance, instanceOp] = await spanner.createInstance(INSTANCE_NAME, {
      config: 'emulator-config',
      displayName: INSTANCE_NAME,
      processingUnits: 100,
    });
    await instanceOp.promise();
    const [database, databaseOp] = await instance.createDatabase(
      DATABASE_NAME,
      {
        schema: [
          'CREATE TABLE Singers (id INT64 NOT NULL, name STRING(MAX)) PRIMARY KEY (id)',
        ],
      },
    );
    await databaseOp.promise();
    await database.table('Singers').insert([
      { id: 1, name: 'Eddie' },
      { id: 2, name: 'Wilson' },
    ]);
    await database.close();
    spanner.close();
  }, 300000);

  afterAll(async () => {
    delete process.env.SPANNER_EMULATOR_HOST;
    await dockerEmulatorService.stop(SPANNER_CONTAINER_NAME);
  });

  it('should not support a different engine', () => {
    expect(() =>
      context.call(DatabaseQueryRecords, {
        engine: 'other.engine',
        database: DATABASE_NAME,
        query: 'SELECT 1',
      }),
    ).toThrow(NoImplementationFoundError);
  });

  it('should throw when the database is not provided', async () => {
    const actualPromise = context.call(DatabaseQueryRecords, {
      engine: 'google.spanner',
      query: 'SELECT 1',
    });

    await expect(actualPromise).rejects.toThrow(
      `The 'database' input is required for the 'google.spanner' engine.`,
    );
  });

  it('should throw when the query is not provided', async () => {
    const actualPromise = context.call(DatabaseQueryRecords, {
      engine: 'google.spanner',
      database: DATABASE_NAME,
    });

    await expect(actualPromise).rejects.toThrow(
      `The 'query' input is required for the 'google.spanner' engine.`,
    );
  });

  it('should return the rows from a query', async () => {
    const actualRows = await context.call(DatabaseQueryRecords, {
      engine: 'google.spanner',
      database: DATABASE_NAME,
      query: 'SELECT id, name FROM Singers ORDER BY id',
    });

    expect(actualRows).toEqual([
      { id: 1, name: 'Eddie' },
      { id: 2, name: 'Wilson' },
    ]);
  });

  it('should return an empty array when the query returns no rows', async () => {
    const actualRows = await context.call(DatabaseQueryRecords, {
      engine: 'google.spanner',
      database: DATABASE_NAME,
      query: 'SELECT id, name FROM Singers WHERE id = 999',
    });

    expect(actualRows).toEqual([]);
  });

  it('should propagate query errors', async () => {
    const actualPromise = context.call(DatabaseQueryRecords, {
      engine: 'google.spanner',
      database: DATABASE_NAME,
      query: 'NOT VALID SQL',
    });

    await expect(actualPromise).rejects.toThrow(/INVALID_ARGUMENT/);
  }, 10000);

  it('should truncate results at the safety limit', async () => {
    const actualRows = await context.call(DatabaseQueryRecords, {
      engine: 'google.spanner',
      database: DATABASE_NAME,
      query: `
        SELECT a * 1000 + b AS n
        FROM UNNEST(GENERATE_ARRAY(1, 101)) AS a
        CROSS JOIN UNNEST(GENERATE_ARRAY(1, 1000)) AS b`,
    });

    expect(actualRows).toHaveLength(SPANNER_QUERY_RECORDS_LIMIT);
  });

  it('should convert Spanner-specific types to JSON-friendly equivalents', async () => {
    const actualRows = await context.call(DatabaseQueryRecords, {
      engine: 'google.spanner',
      database: DATABASE_NAME,
      query: `
        SELECT
          NUMERIC '1.5' AS num,
          ARRAY<NUMERIC>[NUMERIC '0.1', NUMERIC '0.2'] AS nums,
          TIMESTAMP '2026-04-30 10:00:00+00' AS ts,
          DATE '2026-04-30' AS d,
          B'abc' AS bytes,
          1 AS i,
          1.5 AS f,
          JSON '{"nested": {"pi": 3.14}}' AS j`,
    });

    expect(actualRows).toEqual([
      {
        num: '1.5',
        nums: ['0.1', '0.2'],
        ts: new Date('2026-04-30T10:00:00.000Z'),
        d: '2026-04-30',
        bytes: Buffer.from('abc'),
        i: 1,
        f: 1.5,
        j: { nested: { pi: 3.14 } },
      },
    ]);
  });
});

import { WorkspaceContext } from '@causa/workspace';
import {
  DockerEmulatorService,
  DockerService,
  EmulatorStart,
  EmulatorStop,
} from '@causa/workspace-core';
import {
  FunctionRegistry,
  NoImplementationFoundError,
} from '@causa/workspace/function-registry';
import {
  WorkspaceFunctionCallMock,
  createContext,
  registerMockFunction,
} from '@causa/workspace/testing';
import { Spanner } from '@google-cloud/spanner';
import { credentials } from '@grpc/grpc-js';
import { jest } from '@jest/globals';
import 'jest-extended';
import { GoogleSpannerListDatabases } from '../google-spanner/index.js';
import { EmulatorStartForSpanner } from './start-spanner.js';
import { EmulatorStopForSpanner } from './stop-spanner.js';

describe('EmulatorStartForSpanner', () => {
  let context: WorkspaceContext;
  let functionRegistry: FunctionRegistry<WorkspaceContext>;
  let dockerService: DockerService;
  let listDatabasesMock: WorkspaceFunctionCallMock<GoogleSpannerListDatabases>;

  beforeEach(async () => {
    ({ context, functionRegistry } = createContext({
      configuration: { workspace: { name: 'spanner-test' } },
      functions: [EmulatorStartForSpanner, EmulatorStopForSpanner],
    }));

    listDatabasesMock = registerMockFunction(
      functionRegistry,
      GoogleSpannerListDatabases,
      async () => [],
    );

    // Actually downloading the Spanner emulator image takes a long time, but it makes it much easier to test the
    // function... And is a more thorough test than mocking everything.
    dockerService = context.service(DockerService);
    await dockerService.docker('pull', [
      'gcr.io/cloud-spanner-emulator/emulator:latest',
    ]);
  }, 300000);

  afterEach(async () => {
    await context.call(EmulatorStop, { name: 'google.spanner' });
  });

  afterAll(async () => {
    await dockerService.docker('network', [
      'rm',
      '-f',
      dockerService.networkName,
    ]);
  });

  it('should not handle an emulator other than Spanner', async () => {
    expect(() =>
      context.call(EmulatorStart, { name: 'otherEmulator' }),
    ).toThrow(NoImplementationFoundError);
  });

  it('should not start the emulator for a dry run', async () => {
    const dockerEmulatorService = context.service(DockerEmulatorService);
    jest.spyOn(dockerEmulatorService, 'start');

    const actualResult = await context.call(EmulatorStart, {
      dryRun: true,
    });

    expect(actualResult.name).toEqual('google.spanner');
    expect(actualResult.configuration).toEqual({});
    expect(dockerEmulatorService.start).not.toHaveBeenCalled();
  });

  it('should start the emulator without creating any database', async () => {
    const actualResult = await context.call(EmulatorStart, {});

    expect(actualResult.name).toEqual('google.spanner');
    expect(actualResult.configuration).toEqual({
      SPANNER_EMULATOR_HOST: `127.0.0.1:9010`,
      GOOGLE_CLOUD_PROJECT: 'demo-spanner-test',
      GCP_PROJECT: 'demo-spanner-test',
      GCLOUD_PROJECT: 'demo-spanner-test',
      SPANNER_INSTANCE: 'local',
    });
    expect(await getSpannerDatabases()).toEqual({});
  }, 120000);

  it('should start the emulator and create databases', async () => {
    listDatabasesMock.mockResolvedValueOnce([
      {
        id: 'first-db',
        ddlFiles: [],
        ddls: [
          'CREATE TABLE MyTable (id INT64 NOT NULL) PRIMARY KEY (id)',
          'ALTER TABLE MyTable ADD COLUMN otherColumn STRING(MAX)',
        ],
      },
      {
        id: 'second-db',
        ddlFiles: [],
        ddls: [
          'CREATE TABLE MyOtherTable (id INT64 NOT NULL) PRIMARY KEY (id)',
        ],
      },
    ]);

    const actualResult = await context.call(EmulatorStart, {});

    expect(actualResult.name).toEqual('google.spanner');
    expect(actualResult.configuration).toEqual({
      SPANNER_EMULATOR_HOST: `127.0.0.1:9010`,
      GOOGLE_CLOUD_PROJECT: 'demo-spanner-test',
      GCP_PROJECT: 'demo-spanner-test',
      GCLOUD_PROJECT: 'demo-spanner-test',
      SPANNER_INSTANCE: 'local',
      SPANNER_DATABASE: 'first-db|second-db',
    });
    expect(await getSpannerDatabases()).toEqual({
      'projects/demo-spanner-test/instances/local/databases/first-db': [
        `CREATE TABLE MyTable (
  id INT64 NOT NULL,
  otherColumn STRING(MAX),
) PRIMARY KEY(id)`,
      ],
      'projects/demo-spanner-test/instances/local/databases/second-db': [
        `CREATE TABLE MyOtherTable (
  id INT64 NOT NULL,
) PRIMARY KEY(id)`,
      ],
    });
  }, 120000);

  async function getSpannerDatabases(): Promise<Record<string, string[]>> {
    const spanner = new Spanner({
      servicePath: '127.0.0.1',
      port: 9010,
      projectId: 'demo-spanner-test',
      sslCreds: credentials.createInsecure(),
    });
    const [databases] = await spanner.instance('local').getDatabases();
    const idsAndDdls = await Promise.all(
      databases.map(async (database) => {
        const [ddls] = await database.getSchema();
        return { id: database.formattedName_, ddls };
      }),
    );
    return idsAndDdls.reduce(
      (databases, { id, ddls }) => {
        databases[id] = ddls;
        return databases;
      },
      {} as Record<string, string[]>,
    );
  }
});

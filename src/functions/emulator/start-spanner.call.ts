import type { WorkspaceContext } from '@causa/workspace';
import type { EmulatorStartResult } from '@causa/workspace-core';
import { DockerEmulatorService } from '@causa/workspace-core/services';
import { Instance, Spanner } from '@google-cloud/spanner';
// The Spanner client depends on `google-gax` rather than `@grpc/grpc-js` directly. By ensuring `google-gax` is kept in
// sync with the version required by Spanner, and importing `grpc` from `google-gax`, the correct `grpc.credentials`
// version can be loaded.
import { grpc } from 'google-gax';
import {
  type GoogleConfiguration,
  getLocalGcpProject,
} from '../../configurations/index.js';
import {
  SPANNER_EMULATOR_NAME,
  SPANNER_GRPC_PORT,
  SPANNER_HTTP_PORT,
  SPANNER_IMAGE,
  getSpannerContainerName,
} from '../../emulators/index.js';
import { GoogleSpannerListDatabases } from '../google-spanner/index.js';
import type { EmulatorStartForSpanner } from './start-spanner.js';

export default async function call(
  this: EmulatorStartForSpanner,
  context: WorkspaceContext,
): Promise<EmulatorStartResult> {
  const configuration = await startSpanner(this, context);

  return { name: SPANNER_EMULATOR_NAME, configuration };
}

async function startSpanner(
  self: EmulatorStartForSpanner,
  context: WorkspaceContext,
): Promise<Record<string, string>> {
  if (self.dryRun) {
    return {};
  }

  const emulatorConf = await startSpannerEmulator(context);
  const instanceAndDatabaseConf = await initializeEmulator(context);

  context.logger.info('🗃️ Successfully initialized Spanner emulator.');

  return { ...emulatorConf, ...instanceAndDatabaseConf };
}

async function startSpannerEmulator(
  context: WorkspaceContext,
): Promise<Record<string, string>> {
  context.logger.info('🗃️ Starting Spanner emulator.');

  const gcpProject = getLocalGcpProject(context);
  const containerName = getSpannerContainerName(context);
  const imageVersion =
    context
      .asConfiguration<GoogleConfiguration>()
      .get('google.spanner.emulator.version') ?? 'latest';

  const dockerEmulatorService = context.service(DockerEmulatorService);
  await dockerEmulatorService.start(
    `${SPANNER_IMAGE}:${imageVersion}`,
    containerName,
    [SPANNER_GRPC_PORT, SPANNER_HTTP_PORT].map((p) => ({
      host: '127.0.0.1',
      local: p,
      container: p,
    })) as any,
  );

  await dockerEmulatorService.waitForAvailability(
    containerName,
    `http://127.0.0.1:${SPANNER_HTTP_PORT}/v1/projects/${gcpProject}/instances`,
  );

  return {
    SPANNER_EMULATOR_HOST: `127.0.0.1:${SPANNER_GRPC_PORT}`,
    GOOGLE_CLOUD_PROJECT: gcpProject,
    GCP_PROJECT: gcpProject,
    GCLOUD_PROJECT: gcpProject,
  };
}

async function initializeEmulator(
  context: WorkspaceContext,
): Promise<Record<string, string>> {
  const spanner = new Spanner({
    servicePath: '127.0.0.1',
    port: SPANNER_GRPC_PORT,
    projectId: getLocalGcpProject(context),
    sslCreds: grpc.credentials.createInsecure(),
  });

  const { instance, instanceConf } = await createInstance(spanner, context);
  const databaseConf = await createDatabases(instance, context);

  spanner.close();

  return { ...instanceConf, ...databaseConf };
}

async function createInstance(
  spanner: Spanner,
  context: WorkspaceContext,
): Promise<{ instance: Instance; instanceConf: Record<string, string> }> {
  const instanceName =
    context
      .asConfiguration<GoogleConfiguration>()
      .get('google.spanner.emulator.instanceName') ?? 'local';

  context.logger.info(
    `🗃️ Creating Spanner emulator instance '${instanceName}'.`,
  );

  const [instance, operation] = await spanner.createInstance(instanceName, {
    config: 'emulator-config',
    displayName: instanceName,
    processingUnits: 100,
  });
  await operation.promise();

  return { instance, instanceConf: { SPANNER_INSTANCE: instanceName } };
}

async function createDatabases(
  instance: Instance,
  context: WorkspaceContext,
): Promise<Record<string, string>> {
  const databases = await context.call(GoogleSpannerListDatabases, {});

  await Promise.all(
    databases.map(async (database) => {
      context.logger.info(
        `🗃️ Creating Spanner emulator database '${database.id}'.`,
      );

      // Discarding `DROP TABLE` statements as the emulator does not seem to handle them properly.
      const ddls = database.ddls.filter(
        (statement) => !statement.toUpperCase().startsWith('DROP TABLE'),
      );

      const [db, operation] = await instance.createDatabase(database.id, {
        schema: ddls,
      });

      // While unlikely, the database object might emit errors, e.g "The client has already been closed.".
      // These errors could simply be ignored, as awaiting on the operation should be enough to ensure the database is
      // created. However they are logged as warnings for completeness.
      db.on('error', (error: Error) => {
        context.logger.warn(
          `⚠️ Uncaught Spanner database error: '${error.message}'.`,
        );
      });

      await operation.promise();
      await db.close();
    }),
  );

  return databases.length === 0
    ? {}
    : {
        SPANNER_DATABASE: databases.map((database) => database.id).join('|'),
      };
}

import { WorkspaceContext } from '@causa/workspace';
import {
  DockerEmulatorService,
  EmulatorStart,
  EmulatorStartResult,
} from '@causa/workspace-core';
import { Instance, Spanner } from '@google-cloud/spanner';
// The Spanner client depends on `google-gax` rather than `@grpc/grpc-js` directly. By ensuring `google-gax` is kept in
// sync with the version required by Spanner, and importing `grpc` from `google-gax`, the correct `grpc.credentials`
// version can be loaded.
import { grpc } from 'google-gax';
import {
  GoogleConfiguration,
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

/**
 * Implements {@link EmulatorStart} for the Spanner emulator.
 * This starts the emulator, creates a local instance, and creates the databases using the DDLs found in the workspace.
 */
export class EmulatorStartForSpanner extends EmulatorStart {
  async _call(context: WorkspaceContext): Promise<EmulatorStartResult> {
    const configuration = await this.startSpanner(context);

    return { name: SPANNER_EMULATOR_NAME, configuration };
  }

  _supports(): boolean {
    return this.name === undefined || this.name === SPANNER_EMULATOR_NAME;
  }

  /**
   * Starts the Spanner emulator, and creates the instance and databases within it.
   *
   * @param context The {@link WorkspaceContext}.
   * @returns The configuration for the emulator, instance and databases.
   */
  private async startSpanner(
    context: WorkspaceContext,
  ): Promise<Record<string, string>> {
    if (this.dryRun) {
      return {};
    }

    const emulatorConf = await this.startSpannerEmulator(context);
    const instanceAndDatabaseConf = await this.initializeEmulator(context);

    context.logger.info('🗃️ Successfully initialized Spanner emulator.');

    return { ...emulatorConf, ...instanceAndDatabaseConf };
  }

  /**
   * Starts the Spanner emulator.
   * The emulator is defined in a separate Docker image, not part of the `gcloud` CLI emulators.
   *
   * @param context The {@link WorkspaceContext}.
   * @returns The configuration for the Spanner emulator.
   */
  private async startSpannerEmulator(
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

  /**
   * Creates the Spanner instance and databases within the emulator.
   *
   * @param context The {@link WorkspaceContext}.
   * @returns The configuration for the created instance and databases.
   */
  private async initializeEmulator(
    context: WorkspaceContext,
  ): Promise<Record<string, string>> {
    const spanner = new Spanner({
      servicePath: '127.0.0.1',
      port: SPANNER_GRPC_PORT,
      projectId: getLocalGcpProject(context),
      sslCreds: grpc.credentials.createInsecure(),
    });

    const { instance, instanceConf } = await this.createInstance(
      spanner,
      context,
    );
    const databaseConf = await this.createDatabases(instance, context);

    spanner.close();

    return { ...instanceConf, ...databaseConf };
  }

  /**
   * Creates a local instance within the Spanner emulator.
   *
   * @param spanner The {@link Spanner} client.
   * @param context The {@link WorkspaceContext}.
   * @returns The created Spanner {@link Instance} and the corresponding client configuration.
   */
  private async createInstance(
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

  /**
   * Creates the Spanner databases within the given instance, along with their DDL statements found in the workspace.
   *
   * @param instance The Spanner {@link Instance} in which the databases should be created.
   * @param context The {@link WorkspaceContext}.
   * @returns The configuration for the created databases.
   */
  private async createDatabases(
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
}

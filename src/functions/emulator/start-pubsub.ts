import { WorkspaceContext } from '@causa/workspace';
import {
  EmulatorStart,
  type EmulatorStartResult,
  EventTopicList,
} from '@causa/workspace-core';
import { PubSub } from '@google-cloud/pubsub';
import { getLocalGcpProject } from '../../configurations/utils.js';
import {
  PUBSUB_EMULATOR_NAME,
  PUBSUB_PORT,
  formatPubSubTopicAsEnvironmentVariable,
  getPubSubContainerName,
} from '../../emulators/index.js';
import { GcloudEmulatorService } from '../../services/index.js';

/**
 * Implements {@link EmulatorStart} for the Pub/Sub emulator.
 * This first starts the Pub/Sub emulator, and then creates the topics defined in the workspace (if the workspace is
 * configured with Pub/Sub as its event broker).
 */
export class EmulatorStartForPubSub extends EmulatorStart {
  async _call(context: WorkspaceContext): Promise<EmulatorStartResult> {
    const configuration = await this.startPubSub(context);

    return { name: PUBSUB_EMULATOR_NAME, configuration };
  }

  _supports(): boolean {
    return this.name === undefined || this.name === PUBSUB_EMULATOR_NAME;
  }

  /**
   * Starts the Pub/Sub emulator and creates the topics defined in the workspace.
   *
   * @param context The {@link WorkspaceContext}.
   * @returns The configuration for the emulator and the local Pub/Sub topics.
   */
  private async startPubSub(
    context: WorkspaceContext,
  ): Promise<Record<string, string>> {
    if (this.dryRun) {
      return {};
    }

    const emulatorConf = await this.startPubSubEmulator(context);
    const topicsConf = await this.createTopicsIfNeeded(context);

    context.logger.info('📫 Successfully initialized Pub/Sub emulator.');

    return { ...emulatorConf, ...topicsConf };
  }

  /**
   * Starts the Pub/Sub emulator.
   *
   * @param context The {@link WorkspaceContext}.
   * @returns The configuration for the Pub/Sub emulator.
   */
  private async startPubSubEmulator(
    context: WorkspaceContext,
  ): Promise<Record<string, string>> {
    context.logger.info('📫 Starting Pub/Sub emulator.');

    const gcpProject = getLocalGcpProject(context);
    const containerName = getPubSubContainerName(context);

    const gcloudEmulatorService = context.service(GcloudEmulatorService);
    await gcloudEmulatorService.start(
      'pubsub',
      containerName,
      [{ host: '127.0.0.1', local: PUBSUB_PORT, container: PUBSUB_PORT }],
      {
        availabilityEndpoint: `http://127.0.0.1:${PUBSUB_PORT}/v1/projects/${gcpProject}/topics`,
      },
    );

    return {
      PUBSUB_EMULATOR_HOST: `127.0.0.1:${PUBSUB_PORT}`,
      GOOGLE_CLOUD_PROJECT: gcloudEmulatorService.localGcpProject,
      GCP_PROJECT: gcloudEmulatorService.localGcpProject,
      GCLOUD_PROJECT: gcloudEmulatorService.localGcpProject,
    };
  }

  /**
   * Creates the Pub/Sub topics corresponding to the event topics defined in the workspace.
   * This is only performed if Pub/Sub is defined as the broker for the workspace.
   *
   * @param context The {@link WorkspaceContext}.
   * @returns The configuration listing the local Pub/Sub topics.
   */
  private async createTopicsIfNeeded(
    context: WorkspaceContext,
  ): Promise<Record<string, string>> {
    if (context.get('events.broker') !== 'google.pubSub') {
      context.logger.warn(
        '📫️ Pub/Sub is not set as the event broker. Skipping event topics setup.',
      );
      return {};
    }

    const topics = await context.call(EventTopicList, {});

    const gcpProject = getLocalGcpProject(context);

    const pubSub = new PubSub({
      projectId: gcpProject,
      apiEndpoint: `127.0.0.1:${PUBSUB_PORT}`,
    });

    const envVars = await Promise.all(
      topics.map(async ({ id }) => {
        context.logger.info(`📫 Creating Pub/Sub emulator topic '${id}'.`);

        const [topic] = await pubSub.topic(id).create();

        return {
          envVar: formatPubSubTopicAsEnvironmentVariable(id),
          pubSubTopic: topic.name,
        };
      }),
    );

    return envVars.reduce(
      (vars, { envVar, pubSubTopic }) => {
        vars[envVar] = pubSubTopic;
        return vars;
      },
      {} as Record<string, string>,
    );
  }
}

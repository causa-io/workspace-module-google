import type { WorkspaceContext } from '@causa/workspace';
import {
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
import { GcloudEmulatorService } from '../../services/gcloud-emulator.js';
import type { EmulatorStartForPubSub } from './start-pubsub.js';

export default async function call(
  this: EmulatorStartForPubSub,
  context: WorkspaceContext,
): Promise<EmulatorStartResult> {
  const configuration = await startPubSub(this, context);

  return { name: PUBSUB_EMULATOR_NAME, configuration };
}

async function startPubSub(
  self: EmulatorStartForPubSub,
  context: WorkspaceContext,
): Promise<Record<string, string>> {
  if (self.dryRun) {
    return {};
  }

  const emulatorConf = await startPubSubEmulator(context);
  const topicsConf = await createTopicsIfNeeded(context);

  context.logger.info('📫 Successfully initialized Pub/Sub emulator.');

  return { ...emulatorConf, ...topicsConf };
}

async function startPubSubEmulator(
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

async function createTopicsIfNeeded(
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

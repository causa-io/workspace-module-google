import { WorkspaceContext } from '@causa/workspace';
import { GoogleConfiguration } from '../configurations/index.js';

/**
 * The name of the Pub/Sub emulator.
 */
export const PUBSUB_EMULATOR_NAME = 'google.pubSub';

/**
 * Gets the name of the Pub/Sub emulator Docker container from the configuration.
 *
 * @param context The {@link WorkspaceContext}.
 * @returns The name of the Pub/Sub emulator Docker container.
 */
export function getPubSubContainerName(context: WorkspaceContext): string {
  const googleConf = context.asConfiguration<GoogleConfiguration>();

  const containerName = googleConf.get('google.pubSub.emulator.containerName');
  if (containerName) {
    return containerName;
  }

  const workspaceName = googleConf.getOrThrow('workspace.name');
  return `${workspaceName}-pubsub`;
}

/**
 * The port on which the Pub/Sub emulator is listening.
 */
export const PUBSUB_PORT = 8085;

/**
 * Formats the name of a Pub/Sub topic as an environment variable.
 * The value of the corresponding environment variable is expected to be the Pub/Sub topic ID, e.g.
 * `projects/my-project/topics/my-topic`.
 *
 * @param topicId The ID of the event topic.
 * @returns The name of the environment variable that should be used to configure the Pub/Sub topic.
 */
export function formatPubSubTopicAsEnvironmentVariable(
  topicId: string,
): string {
  const formattedTopicName = topicId.toUpperCase().replace(/[-\.]/g, '_');
  return `PUBSUB_TOPIC_${formattedTopicName}`;
}

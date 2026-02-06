import type { WorkspaceContext } from '@causa/workspace';
import type { GoogleConfiguration } from '../../configurations/index.js';
import { PubSubService } from '../../services/index.js';
import type { EventTopicBrokerCreateTopicForPubSub } from './broker-create-topic-pubsub.js';

export default async function call(
  this: EventTopicBrokerCreateTopicForPubSub,
  context: WorkspaceContext,
): Promise<string> {
  const googleConf = context.asConfiguration<GoogleConfiguration>();
  const projectId = googleConf.getOrThrow('google.project');
  const region = googleConf.get('google.region');

  const topicId = `projects/${projectId}/topics/${this.name}`;

  context.logger.info(`📫 Creating Pub/Sub topic '${topicId}'.`);
  await context.service(PubSubService).pubSub.createTopic({
    name: topicId,
    ...(region
      ? { messageStoragePolicy: { allowedPersistenceRegions: [region] } }
      : {}),
  });

  return topicId;
}

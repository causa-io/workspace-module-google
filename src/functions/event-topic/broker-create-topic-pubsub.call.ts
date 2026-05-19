import type { GoogleConfiguration } from '../../configurations/index.js';
import { PubSubService } from '../../services/pubsub.js';
import type { EventTopicBrokerCreateTopicForPubSub } from './broker-create-topic-pubsub.js';

export default async function call(
  this: EventTopicBrokerCreateTopicForPubSub,
): Promise<string> {
  const googleConf = this._context.asConfiguration<GoogleConfiguration>();
  const projectId = googleConf.getOrThrow('google.project');
  const region = googleConf.get('google.region');

  const topicId = `projects/${projectId}/topics/${this.name}`;

  this._context.logger.info(`📫 Creating Pub/Sub topic '${topicId}'.`);
  await this._context.service(PubSubService).pubSub.createTopic({
    name: topicId,
    ...(region
      ? { messageStoragePolicy: { allowedPersistenceRegions: [region] } }
      : {}),
  });

  return topicId;
}

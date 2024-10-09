import { WorkspaceContext } from '@causa/workspace';
import {
  EventTopicBrokerCreateTopic,
  type EventsConfiguration,
} from '@causa/workspace-core';
import type { GoogleConfiguration } from '../../configurations/index.js';
import { PubSubService } from '../../services/index.js';

/**
 * Implements {@link EventTopicBrokerCreateTopic} for Pub/Sub.
 * Topics are created in the GCP project set in the `google.project` configuration.
 * If a `google.region` configuration is set, the message storage policy for the topic is set accordingly.
 */
export class EventTopicBrokerCreateTopicForPubSub extends EventTopicBrokerCreateTopic {
  async _call(context: WorkspaceContext): Promise<string> {
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

  _supports(context: WorkspaceContext): boolean {
    return (
      context.asConfiguration<EventsConfiguration>().get('events.broker') ===
      'google.pubSub'
    );
  }
}

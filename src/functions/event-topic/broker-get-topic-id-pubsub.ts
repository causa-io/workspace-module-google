import { WorkspaceContext } from '@causa/workspace';
import {
  EventTopicBrokerGetTopicId,
  EventsConfiguration,
} from '@causa/workspace-core';
import { GoogleConfiguration } from '../../configurations/index.js';

/**
 * Implements {@link EventTopicBrokerGetTopicId} for Pub/Sub.
 * The returned topic ID is a full Pub/Sub topic ID, e.g. `projects/<projectId>/topics/<topicId>`.
 */
export class EventTopicBrokerGetTopicIdForPubSub extends EventTopicBrokerGetTopicId {
  async _call(context: WorkspaceContext): Promise<string> {
    const googleConf = context.asConfiguration<GoogleConfiguration>();
    const projectId = googleConf.getOrThrow('google.project');

    return `projects/${projectId}/topics/${this.eventTopic}`;
  }

  _supports(context: WorkspaceContext): boolean {
    return (
      context.asConfiguration<EventsConfiguration>().get('events.broker') ===
      'google.pubSub'
    );
  }
}

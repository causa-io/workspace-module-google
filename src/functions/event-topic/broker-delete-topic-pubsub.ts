import { WorkspaceContext } from '@causa/workspace';
import {
  EventTopicBrokerDeleteTopic,
  type EventsConfiguration,
} from '@causa/workspace-core';
import { callDeferred } from '../utils.js';

/**
 * Implements {@link EventTopicBrokerDeleteTopic} for Pub/Sub.
 * The `id` argument should be a full Pub/Sub topic ID, e.g. `projects/<projectId>/topics/<topicId>`.
 */
export class EventTopicBrokerDeleteTopicForPubSub extends EventTopicBrokerDeleteTopic {
  async _call(context: WorkspaceContext): Promise<void> {
    return await callDeferred(this, context, import.meta.url);
  }

  _supports(context: WorkspaceContext): boolean {
    return (
      context.asConfiguration<EventsConfiguration>().get('events.broker') ===
      'google.pubSub'
    );
  }
}

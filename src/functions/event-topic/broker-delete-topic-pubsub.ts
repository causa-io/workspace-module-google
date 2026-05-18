import { callDeferred } from '@causa/workspace';
import {
  EventTopicBrokerDeleteTopic,
  type EventsConfiguration,
} from '@causa/workspace-core';

/**
 * Implements {@link EventTopicBrokerDeleteTopic} for Pub/Sub.
 * The `id` argument should be a full Pub/Sub topic ID, e.g. `projects/<projectId>/topics/<topicId>`.
 */
export class EventTopicBrokerDeleteTopicForPubSub extends EventTopicBrokerDeleteTopic {
  async _call(): Promise<void> {
    return await callDeferred(this, import.meta.url);
  }

  _supports(): boolean {
    return (
      this._context
        .asConfiguration<EventsConfiguration>()
        .get('events.broker') === 'google.pubSub'
    );
  }
}

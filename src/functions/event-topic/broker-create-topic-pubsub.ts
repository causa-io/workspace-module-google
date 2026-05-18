import { callDeferred } from '@causa/workspace';
import {
  EventTopicBrokerCreateTopic,
  type EventsConfiguration,
} from '@causa/workspace-core';

/**
 * Implements {@link EventTopicBrokerCreateTopic} for Pub/Sub.
 * Topics are created in the GCP project set in the `google.project` configuration.
 * If a `google.region` configuration is set, the message storage policy for the topic is set accordingly.
 */
export class EventTopicBrokerCreateTopicForPubSub extends EventTopicBrokerCreateTopic {
  async _call(): Promise<string> {
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

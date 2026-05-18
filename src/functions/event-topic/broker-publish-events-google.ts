import { callDeferred } from '@causa/workspace';
import {
  EventTopicBrokerPublishEvents,
  type EventsConfiguration,
} from '@causa/workspace-core';

/**
 * Implements {@link EventTopicBrokerPublishEvents} for a Google / GCP stack.
 * The supported message broker is Pub/Sub.
 */
export class EventTopicBrokerPublishEventsForGoogle extends EventTopicBrokerPublishEvents {
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

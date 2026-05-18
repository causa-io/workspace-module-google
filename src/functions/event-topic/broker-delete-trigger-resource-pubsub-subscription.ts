import { callDeferred } from '@causa/workspace';
import {
  EventTopicBrokerDeleteTriggerResource,
  type EventsConfiguration,
} from '@causa/workspace-core';

/**
 * Implements {@link EventTopicBrokerDeleteTriggerResource} for Pub/Sub subscriptions.
 * Pub/Sub subscriptions are for example used when creating Cloud Run triggers.
 */
export class EventTopicBrokerDeleteTriggerResourceForPubSubSubscription extends EventTopicBrokerDeleteTriggerResource {
  async _call(): Promise<void> {
    return await callDeferred(this, import.meta.url);
  }

  _supports(): boolean {
    return (
      this.id.match(/^projects\/[\w-]+\/subscriptions\/[\w-]+$/) != null &&
      this._context
        .asConfiguration<EventsConfiguration>()
        .get('events.broker') === 'google.pubSub'
    );
  }
}

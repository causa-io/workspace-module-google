import { callDeferred } from '@causa/workspace';
import {
  EventTopicBrokerDeleteTriggerResource,
  type EventsConfiguration,
} from '@causa/workspace-core';
import { PUBSUB_SUBSCRIPTION_ID_REGEX } from '../../services/pubsub.utils.js';

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
      PUBSUB_SUBSCRIPTION_ID_REGEX.test(this.id) &&
      this._context
        .asConfiguration<EventsConfiguration>()
        .get('events.broker') === 'google.pubSub'
    );
  }
}

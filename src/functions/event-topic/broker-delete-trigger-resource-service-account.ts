import { callDeferred } from '@causa/workspace';
import {
  EventTopicBrokerDeleteTriggerResource,
  type EventsConfiguration,
} from '@causa/workspace-core';

/**
 * Implements {@link EventTopicBrokerDeleteTriggerResource} for GCP service accounts.
 * Service accounts are used by Pub/Sub push subscriptions to authenticate requests when pushing messages (e.g. to Cloud
 * Run services).
 */
export class EventTopicBrokerDeleteTriggerResourceForServiceAccount extends EventTopicBrokerDeleteTriggerResource {
  async _call(): Promise<void> {
    return await callDeferred(this, import.meta.url);
  }

  _supports(): boolean {
    return (
      this.id.match(/^projects\/[\w-]+\/serviceAccounts\/[^/]+$/) != null &&
      this._context
        .asConfiguration<EventsConfiguration>()
        .get('events.broker') === 'google.pubSub'
    );
  }
}

import { callDeferred } from '@causa/workspace';
import {
  EventTopicBrokerWaitForProcessing,
  type EventsConfiguration,
} from '@causa/workspace-core';

/**
 * Implements {@link EventTopicBrokerWaitForProcessing} for Pub/Sub temporary subscriptions.
 *
 * Only backfills that created temporary push subscriptions are supported: at least one entry of
 * {@link BackfillTemporaryData.temporaryTriggerResourceIds} must match a subscription ID. If none does, the function
 * throws — there is no observable signal for backfills that publish into existing topics with existing subscriptions.
 *
 * Completion is decided per-subscription from Cloud Monitoring time series (`subscription/ack_message_count`,
 * `subscription/num_undelivered_messages`, `subscription/oldest_unacked_message_age`). See the call file for the exact
 * decision logic.
 */
export class EventTopicBrokerWaitForProcessingForPubSub extends EventTopicBrokerWaitForProcessing {
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

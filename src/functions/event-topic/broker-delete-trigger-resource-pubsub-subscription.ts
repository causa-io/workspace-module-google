import { WorkspaceContext } from '@causa/workspace';
import {
  EventTopicBrokerDeleteTriggerResource,
  type EventsConfiguration,
} from '@causa/workspace-core';
import { callDeferred } from '../utils.js';

/**
 * Implements {@link EventTopicBrokerDeleteTriggerResource} for Pub/Sub subscriptions.
 * Pub/Sub subscriptions are for example used when creating Cloud Run triggers.
 */
export class EventTopicBrokerDeleteTriggerResourceForPubSubSubscription extends EventTopicBrokerDeleteTriggerResource {
  async _call(context: WorkspaceContext): Promise<void> {
    return await callDeferred(this, context, import.meta.url);
  }

  _supports(context: WorkspaceContext): boolean {
    return (
      this.id.match(/^projects\/[\w-]+\/subscriptions\/[\w-]+$/) != null &&
      context.asConfiguration<EventsConfiguration>().get('events.broker') ===
        'google.pubSub'
    );
  }
}

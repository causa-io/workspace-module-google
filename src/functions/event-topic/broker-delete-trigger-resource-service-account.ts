import { WorkspaceContext } from '@causa/workspace';
import {
  EventTopicBrokerDeleteTriggerResource,
  type EventsConfiguration,
} from '@causa/workspace-core';
import { callDeferred } from '../utils.js';

/**
 * Implements {@link EventTopicBrokerDeleteTriggerResource} for GCP service accounts.
 * Service accounts are used by Pub/Sub push subscriptions to authenticate requests when pushing messages (e.g. to Cloud
 * Run services).
 */
export class EventTopicBrokerDeleteTriggerResourceForServiceAccount extends EventTopicBrokerDeleteTriggerResource {
  async _call(context: WorkspaceContext): Promise<void> {
    return await callDeferred(this, context, import.meta.url);
  }

  _supports(context: WorkspaceContext): boolean {
    return (
      this.id.match(/^projects\/[\w-]+\/serviceAccounts\/[^/]+$/) != null &&
      context.asConfiguration<EventsConfiguration>().get('events.broker') ===
        'google.pubSub'
    );
  }
}

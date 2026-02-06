import { WorkspaceContext } from '@causa/workspace';
import {
  EventTopicBrokerPublishEvents,
  type EventsConfiguration,
} from '@causa/workspace-core';
import { callDeferred } from '../utils.js';

/**
 * Implements {@link EventTopicBrokerPublishEvents} for a Google / GCP stack.
 * The supported message broker is Pub/Sub.
 */
export class EventTopicBrokerPublishEventsForGoogle extends EventTopicBrokerPublishEvents {
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

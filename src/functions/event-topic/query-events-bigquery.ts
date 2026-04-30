import { callDeferred, WorkspaceContext } from '@causa/workspace';
import {
  EventTopicQueryEvents,
  type EventsConfiguration,
  type QueriedEvent,
} from '@causa/workspace-core';
import type { GoogleConfiguration } from '../../configurations/index.js';

/**
 * Implements {@link EventTopicQueryEvents} for Pub/Sub topics whose events are stored in BigQuery via a BigQuery
 * subscription. The events are read from the dataset configured at `google.pubSub.bigQueryStorage.rawEventsDatasetId`.
 */
export class EventTopicQueryEventsForBigQuery extends EventTopicQueryEvents {
  async _call(context: WorkspaceContext): Promise<QueriedEvent[]> {
    return await callDeferred(this, context, import.meta.url);
  }

  _supports(context: WorkspaceContext): boolean {
    const conf = context.asConfiguration<
      EventsConfiguration & GoogleConfiguration
    >();
    return (
      conf.get('events.broker') === 'google.pubSub' &&
      conf.get('events.format') === 'json' &&
      !!conf.get('google.pubSub.bigQueryStorage.rawEventsDatasetId')
    );
  }
}

import { callDeferred } from '@causa/workspace';
import {
  EventTopicCountEvents,
  type EventsConfiguration,
  type RecordCounts,
} from '@causa/workspace-core';
import type { GoogleConfiguration } from '../../configurations/index.js';

/**
 * Implements {@link EventTopicCountEvents} for Pub/Sub topics whose events are stored in BigQuery via a BigQuery
 * subscription. The events are read from the dataset configured at `google.pubSub.bigQueryStorage.rawEventsDatasetId`,
 * whose `data` column is expected to be of the `JSON` type.
 * Events are counted once per Pub/Sub message ID, and the time range applies to their publish time.
 */
export class EventTopicCountEventsForBigQuery extends EventTopicCountEvents {
  async _call(): Promise<RecordCounts> {
    return await callDeferred(this, import.meta.url);
  }

  _supports(): boolean {
    const conf = this._context.asConfiguration<
      EventsConfiguration & GoogleConfiguration
    >();
    return (
      conf.get('events.broker') === 'google.pubSub' &&
      conf.get('events.format') === 'json' &&
      !!conf.get('google.pubSub.bigQueryStorage.rawEventsDatasetId')
    );
  }
}

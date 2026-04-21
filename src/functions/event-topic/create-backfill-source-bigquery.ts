import { callDeferred, WorkspaceContext } from '@causa/workspace';
import {
  type BackfillEvent,
  EventTopicCreateBackfillSource,
  type EventsConfiguration,
} from '@causa/workspace-core';
import type { GoogleConfiguration } from '../../configurations/index.js';

/**
 * The regular expression used to parse a `bq://<tableId>` source string.
 */
export const BIGQUERY_SOURCE_REGEX = /^bq:\/\/(?<tableId>.+)$/;

/**
 * Implements {@link EventTopicCreateBackfillSource} for BigQuery tables.
 *
 * Two cases are supported:
 * - The `source` is a `bq://<projectId>.<datasetId>.<tableId>` URI.
 * - The `source` is omitted and the broker is `google.pubSub` with `google.pubSub.bigQueryStorage.rawEventsDatasetId`
 *   configured: events are read from the default BigQuery storage for the topic.
 *
 * The returned async iterable pages through the query results and yields each row as a {@link BackfillEvent}.
 */
export class EventTopicCreateBackfillSourceForBigQuery extends EventTopicCreateBackfillSource {
  async _call(
    context: WorkspaceContext,
  ): Promise<AsyncIterable<BackfillEvent>> {
    return await callDeferred(this, context, import.meta.url);
  }

  _supports(context: WorkspaceContext): boolean {
    if (this.source?.match(BIGQUERY_SOURCE_REGEX)) {
      return true;
    }

    if (this.source) {
      return false;
    }

    const conf = context.asConfiguration<
      EventsConfiguration & GoogleConfiguration
    >();
    return (
      conf.get('events.broker') === 'google.pubSub' &&
      !!conf.get('google.pubSub.bigQueryStorage.rawEventsDatasetId')
    );
  }
}

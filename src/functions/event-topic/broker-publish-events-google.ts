import { WorkspaceContext } from '@causa/workspace';
import {
  BackfillEventsSource,
  EventTopicBrokerPublishEvents,
  EventsConfiguration,
  JsonFilesEventSource,
} from '@causa/workspace-core';
import {
  BigQueryEventsSource,
  PubSubBackfillEventPublisher,
} from '../../backfilling/index.js';
import { GoogleConfiguration } from '../../index.js';

/**
 * Implements {@link EventTopicBrokerPublishEvents} for a Google / GCP stack.
 * The supported message broker is Pub/Sub.
 */
export class EventTopicBrokerPublishEventsForGoogle extends EventTopicBrokerPublishEvents {
  /**
   * Tries to create a {@link BackfillEventsSource} from the provided `source` and `filter`.
   *
   * @param context The {@link WorkspaceContext}.
   * @returns The {@link BackfillEventsSource} to use for backfilling.
   */
  private async createSource(
    context: WorkspaceContext,
  ): Promise<BackfillEventsSource> {
    if (!this.source) {
      const googleConf = context.asConfiguration<GoogleConfiguration>();
      const projectId = googleConf.getOrThrow('google.project');
      const rawEventsDatasetId = googleConf.get(
        'google.pubSub.bigQueryStorage.rawEventsDatasetId',
      );
      if (!rawEventsDatasetId) {
        throw new Error(
          'Cannot use the default event source because BigQuery storage is not configured.',
        );
      }

      const tableName = this.eventTopic.replace(/[-\.]/g, '_');
      const tableId = `${projectId}.${rawEventsDatasetId}.${tableName}`;
      return new BigQueryEventsSource(context, tableId);
    }

    const bqSource = await BigQueryEventsSource.fromSourceAndFilter(
      context,
      this.source,
      this.filter,
    );
    if (bqSource) {
      return bqSource;
    }

    const jsonFilesSource = await JsonFilesEventSource.fromSourceAndFilter(
      context,
      this.source,
      this.filter,
    );
    if (jsonFilesSource) {
      return jsonFilesSource;
    }

    throw new Error(`The event source '${this.source}' is not supported.`);
  }

  async _call(context: WorkspaceContext): Promise<void> {
    const source = await this.createSource(context);
    const publisher = new PubSubBackfillEventPublisher(context, this.topicId);
    await publisher.publishFromSource(source);
  }

  _supports(context: WorkspaceContext): boolean {
    return (
      context.asConfiguration<EventsConfiguration>().get('events.broker') ===
      'google.pubSub'
    );
  }
}

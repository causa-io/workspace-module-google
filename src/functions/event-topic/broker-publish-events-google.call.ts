import type { WorkspaceContext } from '@causa/workspace';
import {
  type BackfillEventsSource,
  JsonFilesEventSource,
} from '@causa/workspace-core/backfill';
import {
  BigQueryEventsSource,
  PubSubBackfillEventPublisher,
} from '../../backfilling/index.js';
import type { GoogleConfiguration } from '../../index.js';
import type { EventTopicBrokerPublishEventsForGoogle } from './broker-publish-events-google.js';

async function createSource(
  self: EventTopicBrokerPublishEventsForGoogle,
  context: WorkspaceContext,
): Promise<BackfillEventsSource> {
  if (!self.source) {
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

    const tableName = self.eventTopic.replace(/[-\.]/g, '_');
    const tableId = `${projectId}.${rawEventsDatasetId}.${tableName}`;
    return new BigQueryEventsSource(context, tableId);
  }

  const bqSource = await BigQueryEventsSource.fromSourceAndFilter(
    context,
    self.source,
    self.filter,
  );
  if (bqSource) {
    return bqSource;
  }

  const jsonFilesSource = await JsonFilesEventSource.fromSourceAndFilter(
    context,
    self.source,
    self.filter,
  );
  if (jsonFilesSource) {
    return jsonFilesSource;
  }

  throw new Error(`The event source '${self.source}' is not supported.`);
}

export default async function call(
  this: EventTopicBrokerPublishEventsForGoogle,
  context: WorkspaceContext,
): Promise<void> {
  const source = await createSource(this, context);
  const publisher = new PubSubBackfillEventPublisher(context, this.topicId);
  await publisher.publishFromSource(source);
}

import { WorkspaceContext } from '@causa/workspace';
import {
  BackfillEventsSource,
  EventTopicBrokerPublishEvents,
  EventsConfiguration,
  JsonFilesEventSource,
} from '@causa/workspace-core';
import { PubSubBackfillEventPublisher } from '../../backfilling/index.js';

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
      throw new Error('The event source is required.');
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

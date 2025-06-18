import { WorkspaceContext } from '@causa/workspace';
import {
  type BackfillEvent,
  BackfillEventPublisher,
} from '@causa/workspace-core';
import type { PublishOptions } from '@google-cloud/pubsub';
import { FlowControlledPublisher } from '@google-cloud/pubsub/build/src/publisher/flow-publisher.js';
import { PubSubService } from '../services/index.js';

/**
 * Options when publishing events in batches to Pub/Sub.
 */
const PUBLISH_OPTIONS: PublishOptions = {
  flowControlOptions: {
    maxOutstandingBytes: 10 * 1024 * 1024,
    maxOutstandingMessages: 1000,
  },
  batching: {
    maxBytes: 10 * 1024 * 1024,
    maxMessages: 1000,
    maxMilliseconds: 1000,
  },
};

/**
 * A publisher that publishes events to backfill to a Pub/Sub topic.
 */
export class PubSubBackfillEventPublisher extends BackfillEventPublisher {
  /**
   * The actual publisher, which handles batching and flow control.
   */
  private readonly publisher: FlowControlledPublisher;

  /**
   * Creates a new {@link PubSubBackfillEventPublisher}.
   *
   * @param context The {@link WorkspaceContext}.
   * @param topicId The ID of the Pub/Sub topic to publish to.
   *   This should be a full Pub/Sub topic ID, e.g. `projects/<projectId>/topics/<topicId>`.
   */
  constructor(
    context: WorkspaceContext,
    readonly topicId: string,
  ) {
    super(context);

    this.publisher = context
      .service(PubSubService)
      .pubSub.topic(topicId, PUBLISH_OPTIONS)
      .flowControlled();
  }

  /**
   * Publishes an event to the Pub/Sub topic.
   * Publishing actually occurs asynchronously. {@link PubSubBackfillEventPublisher.flush} must be called to wait for
   * all events to be published.
   *
   * @param event The event to publish.
   * @returns A promise that resolves when the publisher has caught up with publishing, or `null` if other events can be
   *   published immediately.
   */
  protected publishEvent(event: BackfillEvent): Promise<void> | null {
    return this.publisher.publish({
      data: event.data,
      attributes: event.attributes,
      orderingKey: event.key,
    });
  }

  /**
   * Waits for all events to be published.
   */
  protected async flush(): Promise<void> {
    await this.publisher.all();
  }
}

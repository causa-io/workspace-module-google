import type { WorkspaceContext } from '@causa/workspace';
import type { PublishOptions } from '@google-cloud/pubsub';
import { FlowControlledPublisher } from '@google-cloud/pubsub/build/src/publisher/flow-publisher.js';
import { PubSubService } from '../../services/index.js';
import type { EventTopicBrokerPublishEventsForGoogle } from './broker-publish-events-google.js';

/**
 * The number of events between each progress log line.
 */
const PUBLISH_PROGRESS_LOG_INTERVAL = 10000;

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

export default async function call(
  this: EventTopicBrokerPublishEventsForGoogle,
  context: WorkspaceContext,
): Promise<void> {
  const publisher: FlowControlledPublisher = context
    .service(PubSubService)
    .pubSub.topic(this.topicId, PUBLISH_OPTIONS)
    .flowControlled();

  context.logger.info('📫 Publishing events.');

  let numEvents = 0;
  for await (const event of this.source()) {
    numEvents += 1;

    const wait = publisher.publish({
      data: event.data,
      attributes: event.attributes,
      orderingKey: event.key,
    });
    if (wait) {
      context.logger.debug(
        'Waiting for the publisher to catch up before resuming publishing.',
      );
      await wait;
    }

    if (numEvents % PUBLISH_PROGRESS_LOG_INTERVAL === 0) {
      context.logger.debug(`Published ${numEvents} events.`);
    }
  }

  await publisher.all();

  context.logger.info(`📫 Finished publishing ${numEvents} events.`);
}

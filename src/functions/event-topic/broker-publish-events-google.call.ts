import type { PublishOptions } from '@google-cloud/pubsub';
import { FlowControlledPublisher } from '@google-cloud/pubsub/build/src/publisher/flow-publisher.js';
import type { GoogleConfiguration } from '../../configurations/index.js';
import { PubSubService } from '../../services/index.js';
import type { EventTopicBrokerPublishEventsForGoogle } from './broker-publish-events-google.js';

/**
 * The number of events between each progress log line.
 */
const PUBLISH_PROGRESS_LOG_INTERVAL = 10000;

/**
 * Default options when publishing events in batches to Pub/Sub.
 * These can be overridden through the `google.pubSub.backfillPublishOptions` configuration.
 */
const DEFAULT_PUBLISH_OPTIONS = {
  maxOutstandingBytes: 10 * 1024 * 1024,
  maxOutstandingMessages: 1000,
  maxBytes: 10 * 1024 * 1024,
  maxMessages: 1000,
  maxMilliseconds: 1000,
};

export default async function call(
  this: EventTopicBrokerPublishEventsForGoogle,
): Promise<void> {
  const publishOptions = {
    ...DEFAULT_PUBLISH_OPTIONS,
    ...this._context
      .asConfiguration<GoogleConfiguration>()
      .get('google.pubSub.backfillPublishOptions'),
  };
  const options: PublishOptions = {
    flowControlOptions: {
      maxOutstandingBytes: publishOptions.maxOutstandingBytes,
      maxOutstandingMessages: publishOptions.maxOutstandingMessages,
    },
    batching: {
      maxBytes: publishOptions.maxBytes,
      maxMessages: publishOptions.maxMessages,
      maxMilliseconds: publishOptions.maxMilliseconds,
    },
  };

  const publisher: FlowControlledPublisher = this._context
    .service(PubSubService)
    .pubSub.topic(this.topicId, options)
    .flowControlled();

  this._context.logger.info('📫 Publishing events.');

  let numEvents = 0;
  for await (const event of this.source()) {
    numEvents += 1;

    const wait = publisher.publish({
      data: event.data,
      attributes: event.attributes,
    });
    if (wait) {
      this._context.logger.debug(
        'Waiting for the publisher to catch up before resuming publishing.',
      );
      await wait;
    }

    if (numEvents % PUBLISH_PROGRESS_LOG_INTERVAL === 0) {
      this._context.logger.debug(`Published ${numEvents} events.`);
    }
  }

  await publisher.all();

  this._context.logger.info(`📫 Finished publishing ${numEvents} events.`);
}

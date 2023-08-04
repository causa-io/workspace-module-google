import { WorkspaceContext } from '@causa/workspace';
import { EventTopicBrokerPublishEvents } from '@causa/workspace-core';
import { NoImplementationFoundError } from '@causa/workspace/function-registry';
import { createContext } from '@causa/workspace/testing';
import { jest } from '@jest/globals';
import 'jest-extended';
import { PubSubBackfillEventPublisher } from '../../backfilling/index.js';
import { EventTopicBrokerPublishEventsForGoogle } from './broker-publish-events-google.js';

describe('EventTopicBrokerPublishEventsForGoogle', () => {
  let context: WorkspaceContext;

  beforeEach(() => {
    ({ context } = createContext({
      configuration: {
        workspace: { name: 'my-workspace' },
        events: { broker: 'google.pubSub' },
        google: { project: 'my-project' },
      },
      functions: [EventTopicBrokerPublishEventsForGoogle],
    }));
  });

  it('should not support a broker other than google.pubSub', () => {
    ({ context } = createContext({
      configuration: {
        workspace: { name: 'my-workspace' },
        events: { broker: 'kafka' },
      },
      functions: [EventTopicBrokerPublishEventsForGoogle],
    }));

    expect(() =>
      context.call(EventTopicBrokerPublishEvents, {
        eventTopic: 'my-topic',
        topicId: 'my-topic',
      }),
    ).toThrow(NoImplementationFoundError);
  });

  it('should throw if the source is not provided', async () => {
    const actualPromise = context.call(EventTopicBrokerPublishEvents, {
      eventTopic: 'my-topic',
      topicId: 'my-topic',
    });

    await expect(actualPromise).rejects.toThrow(
      'The event source is required.',
    );
  });

  it('should throw if the specified source is not supported', async () => {
    const actualPromise = context.call(EventTopicBrokerPublishEvents, {
      eventTopic: 'my-topic',
      topicId: 'my-topic',
      source: 'nope://💥',
    });

    await expect(actualPromise).rejects.toThrow(
      `The event source 'nope://💥' is not supported.`,
    );
  });

  it('should backfill events using the PubSubBackfillEventPublisher', async () => {
    jest
      .spyOn(PubSubBackfillEventPublisher.prototype, 'publishFromSource')
      .mockResolvedValue();

    await context.call(EventTopicBrokerPublishEvents, {
      eventTopic: 'my-topic',
      topicId: 'my-topic',
      source: 'json://some/path',
    });

    expect(
      PubSubBackfillEventPublisher.prototype.publishFromSource,
    ).toHaveBeenCalledOnce();
  });
});

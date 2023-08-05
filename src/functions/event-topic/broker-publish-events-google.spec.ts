import { WorkspaceContext } from '@causa/workspace';
import {
  EventTopicBrokerPublishEvents,
  JsonFilesEventSource,
} from '@causa/workspace-core';
import { NoImplementationFoundError } from '@causa/workspace/function-registry';
import { createContext } from '@causa/workspace/testing';
import { jest } from '@jest/globals';
import 'jest-extended';
import {
  BigQueryEventsSource,
  PubSubBackfillEventPublisher,
} from '../../backfilling/index.js';
import { EventTopicBrokerPublishEventsForGoogle } from './broker-publish-events-google.js';

describe('EventTopicBrokerPublishEventsForGoogle', () => {
  let context: WorkspaceContext;

  beforeEach(() => {
    ({ context } = createContext({
      configuration: {
        workspace: { name: 'my-workspace' },
        events: { broker: 'google.pubSub' },
        google: {
          project: 'my-project',
          pubSub: {
            bigQueryStorage: {
              rawEventsDatasetId: 'my-dataset',
              location: 'EU',
            },
          },
        },
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

  it('should backfill events from a JSON source using the PubSubBackfillEventPublisher', async () => {
    const publishMock = jest
      .spyOn(PubSubBackfillEventPublisher.prototype, 'publishFromSource')
      .mockResolvedValue();

    await context.call(EventTopicBrokerPublishEvents, {
      eventTopic: 'my-topic',
      topicId: 'my-topic',
      source: 'json://some/path',
    });

    expect(publishMock).toHaveBeenCalledOnce();
    expect(publishMock.mock.calls[0][0]).toBeInstanceOf(JsonFilesEventSource);
  });

  it('should backfill events from a BigQuery source using the PubSubBackfillEventPublisher', async () => {
    const publishMock = jest
      .spyOn(PubSubBackfillEventPublisher.prototype, 'publishFromSource')
      .mockResolvedValue();

    await context.call(EventTopicBrokerPublishEvents, {
      eventTopic: 'my-topic',
      topicId: 'my-topic',
      source: 'bq://some/table',
    });

    expect(publishMock).toHaveBeenCalledOnce();
    expect(publishMock.mock.calls[0][0]).toBeInstanceOf(BigQueryEventsSource);
  });

  it('should backfill events from the default BigQuery storage', async () => {
    const publishMock = jest
      .spyOn(PubSubBackfillEventPublisher.prototype, 'publishFromSource')
      .mockResolvedValue();

    await context.call(EventTopicBrokerPublishEvents, {
      eventTopic: 'my-topic-name',
      topicId: 'my-topic',
    });

    expect(publishMock).toHaveBeenCalledOnce();
    const actualSource = publishMock.mock.calls[0][0] as BigQueryEventsSource;
    expect(actualSource).toBeInstanceOf(BigQueryEventsSource);
    expect(actualSource.tableId).toEqual('my-project.my-dataset.my_topic_name');
    expect(actualSource.filter).toBeUndefined();
  });

  it('should throw if the default BigQuery storage is not configured', async () => {
    ({ context } = createContext({
      configuration: {
        workspace: { name: 'my-workspace' },
        events: { broker: 'google.pubSub' },
        google: { project: 'my-project' },
      },
      functions: [EventTopicBrokerPublishEventsForGoogle],
    }));

    const actualPromise = context.call(EventTopicBrokerPublishEvents, {
      eventTopic: 'my-topic',
      topicId: 'my-topic',
    });

    await expect(actualPromise).rejects.toThrow(
      'Cannot use the default event source because BigQuery storage is not configured.',
    );
  });
});

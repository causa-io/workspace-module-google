import { WorkspaceContext } from '@causa/workspace';
import {
  type BackfillEvent,
  EventTopicBrokerPublishEvents,
} from '@causa/workspace-core';
import { NoImplementationFoundError } from '@causa/workspace/function-registry';
import { createContext } from '@causa/workspace/testing';
import { jest } from '@jest/globals';
import 'jest-extended';
import { setTimeout } from 'timers/promises';
import { PubSubService } from '../../services/index.js';
import { EventTopicBrokerPublishEventsForGoogle } from './broker-publish-events-google.js';

describe('EventTopicBrokerPublishEventsForGoogle', () => {
  let context: WorkspaceContext;
  let publisher: { publish: jest.Mock; all: jest.Mock };
  let publishMock: jest.Mock;
  let topicMock: jest.Mock;

  function init(configuration: Record<string, any> = {}) {
    ({ context } = createContext({
      configuration: {
        workspace: { name: 'my-workspace' },
        events: { broker: 'google.pubSub' },
        google: { project: 'my-project' },
        ...configuration,
      },
      functions: [EventTopicBrokerPublishEventsForGoogle],
    }));

    publishMock = jest.fn().mockReturnValue(null);
    publisher = {
      publish: publishMock,
      all: jest.fn().mockResolvedValue([] as never),
    };
    topicMock = jest
      .spyOn(context.service(PubSubService).pubSub, 'topic')
      .mockReturnValue({
        flowControlled: () => publisher,
      } as any) as unknown as jest.Mock;
  }

  beforeEach(() => init());

  function makeSource(numEvents: number): () => AsyncIterable<BackfillEvent> {
    return async function* () {
      for (let i = 0; i < numEvents; i++) {
        yield {
          data: Buffer.from(`e-${i}`),
          attributes: { index: `${i}` },
        };
      }
    };
  }

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
        source: () => (async function* () {})(),
      }),
    ).toThrow(NoImplementationFoundError);
  });

  it('should publish every event from the iterable and flush', async () => {
    await context.call(EventTopicBrokerPublishEvents, {
      eventTopic: 'my-topic',
      topicId: 'my-topic',
      source: makeSource(3),
    });

    expect(topicMock).toHaveBeenCalledExactlyOnceWith('my-topic', {
      flowControlOptions: {
        maxOutstandingBytes: 10 * 1024 * 1024,
        maxOutstandingMessages: 1000,
      },
      batching: {
        maxBytes: 10 * 1024 * 1024,
        maxMessages: 1000,
        maxMilliseconds: 1000,
      },
    });
    expect(publishMock).toHaveBeenCalledTimes(3);
    const actualMessages = publishMock.mock.calls.map(([message]: any) => ({
      ...message,
      data: message.data?.toString(),
    }));
    expect(actualMessages).toEqual([
      { data: 'e-0', attributes: { index: '0' } },
      { data: 'e-1', attributes: { index: '1' } },
      { data: 'e-2', attributes: { index: '2' } },
    ]);
    expect(publisher.all).toHaveBeenCalledOnce();
  });

  it('should wait for the publisher to catch up before resuming', async () => {
    let waitPromiseResolve!: () => void;
    const waitPromise = new Promise<void>(
      (resolve) => (waitPromiseResolve = resolve),
    );
    publishMock.mockImplementationOnce(() => waitPromise);

    const publishPromise = context.call(EventTopicBrokerPublishEvents, {
      eventTopic: 'my-topic',
      topicId: 'my-topic',
      source: makeSource(3),
    });
    await setTimeout(50);

    expect(publishMock).toHaveBeenCalledExactlyOnceWith({
      data: expect.any(Buffer),
      attributes: { index: '0' },
    });
    expect(publisher.all).not.toHaveBeenCalled();
    waitPromiseResolve();

    await publishPromise;
    expect(publishMock).toHaveBeenCalledTimes(3);
    expect(publisher.all).toHaveBeenCalledOnce();
  });

  it('should use the configured publish options', async () => {
    init({
      google: {
        project: 'my-project',
        pubSub: {
          backfillPublishOptions: {
            maxOutstandingBytes: 1,
            maxOutstandingMessages: 2,
            maxBytes: 3,
            maxMessages: 4,
            maxMilliseconds: 5,
          },
        },
      },
    });

    await context.call(EventTopicBrokerPublishEvents, {
      eventTopic: 'my-topic',
      topicId: 'my-topic',
      source: makeSource(1),
    });

    expect(topicMock).toHaveBeenCalledExactlyOnceWith('my-topic', {
      flowControlOptions: {
        maxOutstandingBytes: 1,
        maxOutstandingMessages: 2,
      },
      batching: {
        maxBytes: 3,
        maxMessages: 4,
        maxMilliseconds: 5,
      },
    });
    expect(publishMock).toHaveBeenCalledTimes(1);
    expect(publisher.all).toHaveBeenCalledOnce();
  });
});

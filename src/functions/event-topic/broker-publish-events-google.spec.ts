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

  beforeEach(() => {
    ({ context } = createContext({
      configuration: {
        workspace: { name: 'my-workspace' },
        events: { broker: 'google.pubSub' },
        google: { project: 'my-project' },
      },
      functions: [EventTopicBrokerPublishEventsForGoogle],
    }));

    publishMock = jest.fn().mockReturnValue(null);
    publisher = {
      publish: publishMock,
      all: jest.fn().mockResolvedValue([] as never),
    };
    jest.spyOn(context.service(PubSubService).pubSub, 'topic').mockReturnValue({
      flowControlled: () => publisher,
    } as any);
  });

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

    expect(publishMock).toHaveBeenCalledTimes(3);
    const actualMessages = publishMock.mock.calls.map(([message]: any) => ({
      ...message,
      data: message.data?.toString(),
    }));
    expect(actualMessages).toEqual([
      { data: 'e-0', attributes: { index: '0' }, orderingKey: undefined },
      { data: 'e-1', attributes: { index: '1' }, orderingKey: undefined },
      { data: 'e-2', attributes: { index: '2' }, orderingKey: undefined },
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
      orderingKey: undefined,
    });
    expect(publisher.all).not.toHaveBeenCalled();
    waitPromiseResolve();

    await publishPromise;
    expect(publishMock).toHaveBeenCalledTimes(3);
    expect(publisher.all).toHaveBeenCalledOnce();
  });

  it('should forward the ordering key when provided', async () => {
    const source = (): AsyncIterable<BackfillEvent> =>
      (async function* () {
        yield {
          data: Buffer.from('payload'),
          attributes: { k: 'v' },
          key: 'order-key',
        };
      })();

    await context.call(EventTopicBrokerPublishEvents, {
      eventTopic: 'my-topic',
      topicId: 'my-topic',
      source,
    });

    expect(publishMock).toHaveBeenCalledExactlyOnceWith({
      data: expect.any(Buffer),
      attributes: { k: 'v' },
      orderingKey: 'order-key',
    });
  });
});

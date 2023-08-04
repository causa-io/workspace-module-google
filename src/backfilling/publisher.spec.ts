import { WorkspaceContext } from '@causa/workspace';
import { BackfillEventsSource } from '@causa/workspace-core';
import { createContext } from '@causa/workspace/testing';
import { FlowControlledPublisher } from '@google-cloud/pubsub/build/src/publisher/flow-publisher.js';
import { jest } from '@jest/globals';
import 'jest-extended';
import { setTimeout } from 'timers/promises';
import { PubSubBackfillEventPublisher } from './publisher.js';

describe('PubSubBackfillEventPublisher', () => {
  let context: WorkspaceContext;
  let publisher: PubSubBackfillEventPublisher;
  let pubSubPublisher: FlowControlledPublisher;
  let publishMock: jest.SpiedFunction<FlowControlledPublisher['publish']>;

  beforeEach(() => {
    ({ context } = createContext({
      configuration: {
        workspace: { name: 'my-workspace' },
        events: { broker: 'google.pubSub' },
        google: { project: 'my-project' },
      },
    }));
    publisher = new PubSubBackfillEventPublisher(context, 'my-topic');
    pubSubPublisher = publisher['publisher'];
    publishMock = jest.spyOn(pubSubPublisher, 'publish').mockReturnValue(null);
    jest.spyOn(pubSubPublisher, 'all').mockResolvedValue([]);
  });

  function makeSource(
    numBatches: number,
    numEventsInBatch: number,
  ): BackfillEventsSource {
    let batchIndex = 0;
    return {
      getBatch: async () => {
        if (batchIndex >= numBatches) {
          return null;
        }
        batchIndex++;
        return Array.from({ length: numEventsInBatch }, (_, i) => ({
          data: Buffer.from(`${batchIndex}-${i}`),
          attributes: { batch: `${batchIndex}`, index: `${i}` },
        }));
      },
      dispose: jest.fn(() => Promise.resolve()),
    };
  }

  it('should publish the events', async () => {
    const source = makeSource(2, 3);

    await publisher.publishFromSource(source);

    expect(pubSubPublisher.publish).toHaveBeenCalledTimes(6);
    const actualMessages = publishMock.mock.calls.map(([message]) => ({
      ...message,
      data: message.data?.toString(),
    }));
    expect(actualMessages).toEqual([
      { data: '1-0', attributes: { batch: '1', index: '0' } },
      { data: '1-1', attributes: { batch: '1', index: '1' } },
      { data: '1-2', attributes: { batch: '1', index: '2' } },
      { data: '2-0', attributes: { batch: '2', index: '0' } },
      { data: '2-1', attributes: { batch: '2', index: '1' } },
      { data: '2-2', attributes: { batch: '2', index: '2' } },
    ]);
    expect(pubSubPublisher.all).toHaveBeenCalledOnce();
    expect(source.dispose).toHaveBeenCalledOnce();
  });

  it('should wait for the publisher to catch up', async () => {
    const source = makeSource(2, 3);
    let waitPromiseResolve!: () => void;
    const waitPromise = new Promise<void>(
      (resolve) => (waitPromiseResolve = resolve),
    );
    publishMock.mockImplementationOnce(() => waitPromise);

    const publishPromise = publisher.publishFromSource(source);
    await setTimeout(50);

    expect(pubSubPublisher.publish).toHaveBeenCalledExactlyOnceWith({
      data: expect.any(Buffer),
      attributes: { batch: '1', index: '0' },
    });
    expect(pubSubPublisher.all).not.toHaveBeenCalled();
    waitPromiseResolve();

    await publishPromise;
    expect(pubSubPublisher.publish).toHaveBeenCalledTimes(6);
    expect(pubSubPublisher.all).toHaveBeenCalledOnce();
  });
});

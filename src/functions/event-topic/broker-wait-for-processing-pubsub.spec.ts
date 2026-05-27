import { WorkspaceContext } from '@causa/workspace';
import { EventTopicBrokerWaitForProcessing } from '@causa/workspace-core';
import { NoImplementationFoundError } from '@causa/workspace/function-registry';
import { createContext } from '@causa/workspace/testing';
import { jest } from '@jest/globals';
import 'jest-extended';
import {
  CloudMonitoringService,
  type MetricPoint,
} from '../../services/cloud-monitoring.js';
import { EventTopicBrokerWaitForProcessingForPubSub } from './broker-wait-for-processing-pubsub.js';

const fakeSetTimeout = jest.fn<(ms?: number) => Promise<void>>(async () => {});
jest.unstable_mockModule('timers/promises', () => ({
  setTimeout: fakeSetTimeout,
}));

describe('EventTopicBrokerWaitForProcessingForPubSub', () => {
  let context: WorkspaceContext;
  let listPointsMock: jest.Mock<CloudMonitoringService['listPoints']>;

  beforeEach(() => {
    ({ context } = createContext({
      configuration: {
        workspace: { name: 'my-workspace' },
        events: { broker: 'google.pubSub' },
        google: { project: 'my-project' },
      },
      functions: [EventTopicBrokerWaitForProcessingForPubSub],
    }));
    listPointsMock = jest.fn();
    jest
      .spyOn(context.service(CloudMonitoringService), 'listPoints')
      .mockImplementation(listPointsMock as any);
  });

  it('should not support a broker other than google.pubSub', () => {
    ({ context } = createContext({
      configuration: {
        workspace: { name: 'my-workspace' },
        events: { broker: 'kafka' },
        google: { project: 'my-project' },
      },
      functions: [EventTopicBrokerWaitForProcessingForPubSub],
    }));

    expect(() =>
      context.call(EventTopicBrokerWaitForProcessing, {
        eventTopic: 'my.topic.v1',
        temporaryData: {
          temporaryTopicId: null,
          temporaryTriggerResourceIds: [
            'projects/my-project/subscriptions/sub-1',
          ],
        },
      }),
    ).toThrow(NoImplementationFoundError);
  });

  it('should throw when no temporary Pub/Sub subscription is present', async () => {
    const actualPromise = context.call(EventTopicBrokerWaitForProcessing, {
      eventTopic: 'my.topic.v1',
      temporaryData: {
        temporaryTopicId: 'projects/my-project/topics/temp',
        temporaryTriggerResourceIds: [
          'projects/my-project/serviceAccounts/foo@bar.iam.gserviceaccount.com',
        ],
      },
    });

    await expect(actualPromise).rejects.toThrow(
      'no temporary Pub/Sub subscription was created',
    );
    expect(listPointsMock).not.toHaveBeenCalled();
  });

  it('should return once all subscriptions are drained on the first poll', async () => {
    const now = Date.now();
    const quietPoints: MetricPoint[] = [
      { timestamp: now - 4 * 60_000, value: 0 },
      { timestamp: now - 30_000, value: 0 },
    ];
    const ackPoints: MetricPoint[] = [
      { timestamp: now - 9 * 60_000, value: 100 },
      { timestamp: now - 4 * 60_000, value: 0 },
      { timestamp: now - 30_000, value: 0 },
    ];
    listPointsMock.mockImplementation(async (filter) =>
      filter.includes('ack_message_count') ? ackPoints : quietPoints,
    );

    await context.call(EventTopicBrokerWaitForProcessing, {
      eventTopic: 'my.topic.v1',
      temporaryData: {
        temporaryTopicId: 'projects/my-project/topics/temp',
        temporaryTriggerResourceIds: [
          'projects/my-project/serviceAccounts/foo@bar.iam.gserviceaccount.com',
          'projects/my-project/subscriptions/sub-1',
          'projects/my-project/subscriptions/sub-2',
        ],
      },
    });

    expect(listPointsMock).toHaveBeenCalledTimes(6);
    expect(fakeSetTimeout).not.toHaveBeenCalled();
    const filters = listPointsMock.mock.calls.map((call) => call[0]);
    expect(filters).toIncludeAllMembers([
      expect.stringContaining('subscription_id = "sub-1"'),
      expect.stringContaining('subscription_id = "sub-2"'),
      expect.stringContaining('ack_message_count'),
      expect.stringContaining('num_undelivered_messages'),
      expect.stringContaining('oldest_unacked_message_age'),
    ]);
    for (const filter of filters) {
      expect(filter).toContain('resource.type = "pubsub_subscription"');
    }
  });

  it('should keep polling until the subscription drains', async () => {
    let pollIndex = 0;
    listPointsMock.mockImplementation(async (filter) => {
      const isAck = filter.includes('ack_message_count');
      const now = Date.now();
      if (pollIndex === 0) {
        return [{ timestamp: now - 60_000, value: isAck ? 50 : 12 }];
      }
      return isAck
        ? [
            { timestamp: now - 10 * 60_000, value: 100 },
            { timestamp: now - 5 * 60_000, value: 0 },
            { timestamp: now - 30_000, value: 0 },
          ]
        : [
            { timestamp: now - 5 * 60_000, value: 0 },
            { timestamp: now - 30_000, value: 0 },
          ];
    });
    fakeSetTimeout.mockImplementation(async () => {
      pollIndex += 1;
    });

    await context.call(EventTopicBrokerWaitForProcessing, {
      eventTopic: 'my.topic.v1',
      temporaryData: {
        temporaryTopicId: null,
        temporaryTriggerResourceIds: [
          'projects/my-project/subscriptions/sub-1',
        ],
      },
    });

    expect(listPointsMock).toHaveBeenCalledTimes(6);
    expect(fakeSetTimeout).toHaveBeenCalledTimes(1);
    expect(fakeSetTimeout).toHaveBeenCalledWith(30000);
  });

  it('should throw when the timeout elapses before draining', async () => {
    let fakeNow = Date.now();
    jest.spyOn(Date, 'now').mockImplementation(() => fakeNow);
    listPointsMock.mockImplementation(async (filter: string) => {
      const isAck = filter.includes('ack_message_count');
      return [{ timestamp: fakeNow - 60_000, value: isAck ? 50 : 12 }];
    });
    fakeSetTimeout.mockImplementation(async (ms?: number) => {
      fakeNow += ms ?? 0;
    });

    const actualPromise = context.call(EventTopicBrokerWaitForProcessing, {
      eventTopic: 'my.topic.v1',
      temporaryData: {
        temporaryTopicId: null,
        temporaryTriggerResourceIds: [
          'projects/my-project/subscriptions/sub-1',
        ],
      },
    });

    await expect(actualPromise).rejects.toThrow(/Timed out/);
    // ~1 hour / 30s = 120 polls before the deadline check fires.
    expect(fakeSetTimeout.mock.calls.length).toBeGreaterThan(100);
  });
});

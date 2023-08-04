import { WorkspaceContext } from '@causa/workspace';
import { EventTopicBrokerDeleteTriggerResource } from '@causa/workspace-core';
import { NoImplementationFoundError } from '@causa/workspace/function-registry';
import { createContext } from '@causa/workspace/testing';
import { jest } from '@jest/globals';
import 'jest-extended';
import { PubSubService } from '../../services/index.js';
import { EventTopicBrokerDeleteTriggerResourceForPubSubSubscription } from './broker-delete-trigger-resource-pubsub-subscription.js';

describe('EventTopicBrokerDeleteTriggerResourceForPubSubSubscription', () => {
  let context: WorkspaceContext;
  let pubSubService: PubSubService;
  const deleteMock = jest.fn(() => Promise.resolve());

  beforeEach(() => {
    ({ context } = createContext({
      configuration: {
        workspace: { name: 'my-workspace' },
        events: { broker: 'google.pubSub' },
        google: { project: 'my-project' },
      },
      functions: [EventTopicBrokerDeleteTriggerResourceForPubSubSubscription],
    }));
    pubSubService = context.service(PubSubService);
    jest
      .spyOn(pubSubService.pubSub as any, 'subscription')
      .mockReturnValue({ delete: deleteMock });
  });

  it('should not support a broker other than google.pubSub', () => {
    ({ context } = createContext({
      configuration: {
        workspace: { name: 'my-workspace' },
        events: { broker: 'kafka' },
        google: { project: 'my-project' },
      },
      functions: [EventTopicBrokerDeleteTriggerResourceForPubSubSubscription],
    }));

    expect(() =>
      context.call(EventTopicBrokerDeleteTriggerResource, {
        id: 'projects/my-project/subscriptions/my-subscription',
      }),
    ).toThrow(NoImplementationFoundError);
  });

  it('should not support a non-matching resource ID', () => {
    expect(() =>
      context.call(EventTopicBrokerDeleteTriggerResource, {
        id: 'nope/nope',
      }),
    ).toThrow(NoImplementationFoundError);
  });

  it('should delete the subscription', async () => {
    await context.call(EventTopicBrokerDeleteTriggerResource, {
      id: 'projects/my-project/subscriptions/my-subscription',
    });

    expect(pubSubService.pubSub.subscription).toHaveBeenCalledWith(
      'projects/my-project/subscriptions/my-subscription',
    );
    expect(deleteMock).toHaveBeenCalledExactlyOnceWith();
  });

  it('should not throw if the subscription does not exist', async () => {
    deleteMock.mockRejectedValueOnce({ code: 5 });

    await context.call(EventTopicBrokerDeleteTriggerResource, {
      id: 'projects/my-project/subscriptions/my-subscription',
    });

    expect(pubSubService.pubSub.subscription).toHaveBeenCalledWith(
      'projects/my-project/subscriptions/my-subscription',
    );
    expect(deleteMock).toHaveBeenCalledExactlyOnceWith();
  });

  it('should rethrow an unknown error', async () => {
    deleteMock.mockRejectedValueOnce(new Error('💥'));

    const actualPromise = context.call(EventTopicBrokerDeleteTriggerResource, {
      id: 'projects/my-project/subscriptions/my-subscription',
    });

    await expect(actualPromise).rejects.toThrow('💥');
    expect(pubSubService.pubSub.subscription).toHaveBeenCalledWith(
      'projects/my-project/subscriptions/my-subscription',
    );
    expect(deleteMock).toHaveBeenCalledExactlyOnceWith();
  });
});

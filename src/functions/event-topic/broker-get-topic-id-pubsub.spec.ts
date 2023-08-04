import { WorkspaceContext } from '@causa/workspace';
import { EventTopicBrokerGetTopicId } from '@causa/workspace-core';
import { NoImplementationFoundError } from '@causa/workspace/function-registry';
import { createContext } from '@causa/workspace/testing';
import { EventTopicBrokerGetTopicIdForPubSub } from './broker-get-topic-id-pubsub.js';

describe('EventTopicBrokerGetTopicIdForPubSub', () => {
  let context: WorkspaceContext;

  beforeEach(() => {
    ({ context } = createContext({
      configuration: {
        workspace: { name: 'my-workspace' },
        events: { broker: 'google.pubSub' },
        google: { project: 'my-project' },
      },
      functions: [EventTopicBrokerGetTopicIdForPubSub],
    }));
  });

  it('should not support a broker other than google.pubSub', () => {
    ({ context } = createContext({
      configuration: {
        workspace: { name: 'my-workspace' },
        events: { broker: 'kafka' },
        google: { project: 'my-project' },
      },
      functions: [EventTopicBrokerGetTopicIdForPubSub],
    }));

    expect(() =>
      context.call(EventTopicBrokerGetTopicId, { eventTopic: 'my-topic' }),
    ).toThrow(NoImplementationFoundError);
  });

  it('should return the topic ID', async () => {
    const actualTopicId = await context.call(EventTopicBrokerGetTopicId, {
      eventTopic: 'my-topic',
    });

    expect(actualTopicId).toEqual('projects/my-project/topics/my-topic');
  });
});

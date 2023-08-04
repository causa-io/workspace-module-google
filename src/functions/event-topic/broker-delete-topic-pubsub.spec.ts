import { WorkspaceContext } from '@causa/workspace';
import { EventTopicBrokerDeleteTopic } from '@causa/workspace-core';
import { NoImplementationFoundError } from '@causa/workspace/function-registry';
import { createContext } from '@causa/workspace/testing';
import { jest } from '@jest/globals';
import 'jest-extended';
import { PubSubService } from '../../services/index.js';
import { EventTopicBrokerDeleteTopicForPubSub } from './broker-delete-topic-pubsub.js';

describe('EventTopicBrokerDeleteTopicForPubSub', () => {
  let context: WorkspaceContext;
  let pubSubService: PubSubService;
  let deleteMock: jest.Mock<() => Promise<void>>;

  beforeEach(() => {
    ({ context } = createContext({
      configuration: {
        workspace: { name: 'my-workspace' },
        events: { broker: 'google.pubSub' },
        google: { project: 'my-project' },
      },
      functions: [EventTopicBrokerDeleteTopicForPubSub],
    }));
    pubSubService = context.service(PubSubService);
    deleteMock = jest.fn(() => Promise.resolve());
    jest.spyOn(pubSubService.pubSub as any, 'topic').mockReturnValue({
      delete: deleteMock,
    });
  });

  it('should not support a broker other than google.pubSub', () => {
    ({ context } = createContext({
      configuration: {
        workspace: { name: 'my-workspace' },
        events: { broker: 'kafka' },
        google: { project: 'my-project' },
      },
      functions: [EventTopicBrokerDeleteTopicForPubSub],
    }));

    expect(() =>
      context.call(EventTopicBrokerDeleteTopic, { id: 'my-topic' }),
    ).toThrow(NoImplementationFoundError);
  });

  it('should delete the topic', async () => {
    await context.call(EventTopicBrokerDeleteTopic, {
      id: 'projects/my-project/topics/my-topic',
    });

    expect(pubSubService.pubSub.topic).toHaveBeenCalledWith(
      'projects/my-project/topics/my-topic',
    );
    expect(deleteMock).toHaveBeenCalledExactlyOnceWith();
  });

  it('should not fail if the topic does not exist', async () => {
    deleteMock.mockRejectedValueOnce({ code: 5 });

    await context.call(EventTopicBrokerDeleteTopic, {
      id: 'projects/my-project/topics/my-topic',
    });

    expect(pubSubService.pubSub.topic).toHaveBeenCalledWith(
      'projects/my-project/topics/my-topic',
    );
    expect(deleteMock).toHaveBeenCalledExactlyOnceWith();
  });

  it('should throw for an unknown error', async () => {
    deleteMock.mockRejectedValueOnce(new Error('💥'));

    const actualPromise = context.call(EventTopicBrokerDeleteTopic, {
      id: 'projects/my-project/topics/my-topic',
    });

    await expect(actualPromise).rejects.toThrow('💥');
    expect(pubSubService.pubSub.topic).toHaveBeenCalledWith(
      'projects/my-project/topics/my-topic',
    );
    expect(deleteMock).toHaveBeenCalledExactlyOnceWith();
  });
});

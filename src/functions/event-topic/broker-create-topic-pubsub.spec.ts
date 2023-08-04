import { WorkspaceContext } from '@causa/workspace';
import { EventTopicBrokerCreateTopic } from '@causa/workspace-core';
import { NoImplementationFoundError } from '@causa/workspace/function-registry';
import { createContext } from '@causa/workspace/testing';
import { jest } from '@jest/globals';
import 'jest-extended';
import { PubSubService } from '../../services/index.js';
import { EventTopicBrokerCreateTopicForPubSub } from './broker-create-topic-pubsub.js';

describe('EventTopicBrokerCreateTopicForPubSub', () => {
  let context: WorkspaceContext;
  let pubSubService: PubSubService;

  beforeEach(() => {
    ({ context } = createContext({
      configuration: {
        workspace: { name: 'my-workspace' },
        events: { broker: 'google.pubSub' },
        google: { project: 'my-project', region: 'my-region' },
      },
      functions: [EventTopicBrokerCreateTopicForPubSub],
    }));
    pubSubService = context.service(PubSubService);
  });

  it('should not support a broker other than google.pubSub', () => {
    ({ context } = createContext({
      configuration: {
        workspace: { name: 'my-workspace' },
        events: { broker: 'kafka' },
        google: { project: 'my-project' },
      },
      functions: [EventTopicBrokerCreateTopicForPubSub],
    }));

    expect(() =>
      context.call(EventTopicBrokerCreateTopic, { name: 'my-topic' }),
    ).toThrow(NoImplementationFoundError);
  });

  it('should create the topic with a message storage policy', async () => {
    jest
      .spyOn(pubSubService.pubSub as any, 'createTopic')
      .mockResolvedValue([]);

    const actualTopicId = await context.call(EventTopicBrokerCreateTopic, {
      name: 'my-topic',
    });

    expect(actualTopicId).toEqual('projects/my-project/topics/my-topic');
    expect(pubSubService.pubSub.createTopic).toHaveBeenCalledWith({
      name: 'projects/my-project/topics/my-topic',
      messageStoragePolicy: { allowedPersistenceRegions: ['my-region'] },
    });
  });

  it('should create the topic without a message storage policy', async () => {
    ({ context } = createContext({
      configuration: {
        workspace: { name: 'my-workspace' },
        events: { broker: 'google.pubSub' },
        google: { project: 'my-project' },
      },
      functions: [EventTopicBrokerCreateTopicForPubSub],
    }));
    pubSubService = context.service(PubSubService);
    jest
      .spyOn(pubSubService.pubSub as any, 'createTopic')
      .mockResolvedValue([]);

    const actualTopicId = await context.call(EventTopicBrokerCreateTopic, {
      name: 'my-topic',
    });

    expect(actualTopicId).toEqual('projects/my-project/topics/my-topic');
    expect(pubSubService.pubSub.createTopic).toHaveBeenCalledWith({
      name: 'projects/my-project/topics/my-topic',
    });
  });
});

import { WorkspaceContext } from '@causa/workspace';
import {
  DockerService,
  EmulatorStart,
  EmulatorStop,
  EventTopicList,
} from '@causa/workspace-core';
import {
  FunctionRegistry,
  NoImplementationFoundError,
} from '@causa/workspace/function-registry';
import { createContext, registerMockFunction } from '@causa/workspace/testing';
import { PubSub } from '@google-cloud/pubsub';
import { jest } from '@jest/globals';
import 'jest-extended';
import { PUBSUB_PORT } from '../emulators/index.js';
import { GcloudEmulatorService } from '../index.js';
import { EmulatorStartForPubSub } from './emulator-start-pubsub.js';
import { EmulatorStopForPubSub } from './emulator-stop-pubsub.js';

describe('EmulatorStartForPubSub', () => {
  let context: WorkspaceContext;
  let functionRegistry: FunctionRegistry<WorkspaceContext>;
  let dockerService: DockerService;

  beforeEach(async () => {
    ({ context, functionRegistry } = createContext({
      configuration: {
        workspace: { name: 'pubsub-test' },
        events: { broker: 'google.pubSub' },
      },
      functions: [EmulatorStartForPubSub, EmulatorStopForPubSub],
    }));

    registerMockFunction(functionRegistry, EventTopicList, async () => [
      {
        id: 'my.first-topic.v1',
        formatParts: {},
        schemaFilePath: 'my-first-topic.v1.json',
      },
      {
        id: 'my.second-topic.v1',
        formatParts: {},
        schemaFilePath: 'my-second-topic.v1.json',
      },
    ]);

    // Actually downloading the gcloud image takes a long time, but it makes it much easier to test the function...
    // And is a more thorough test than mocking everything.
    dockerService = context.service(DockerService);
    await dockerService.docker('pull', [
      'gcr.io/google.com/cloudsdktool/google-cloud-cli:emulators',
    ]);
  }, 300000);

  afterEach(async () => {
    await context.call(EmulatorStop, { name: 'google.pubSub' });
  });

  afterAll(async () => {
    await dockerService.docker('network', [
      'rm',
      '-f',
      dockerService.networkName,
    ]);
  });

  it('should not handle an emulator other than Pub/Sub', async () => {
    expect(() =>
      context.call(EmulatorStart, { name: 'otherEmulator' }),
    ).toThrow(NoImplementationFoundError);
  });

  it('should not start the emulator for a dry run', async () => {
    const gcloudEmulatorService = context.service(GcloudEmulatorService);
    jest.spyOn(gcloudEmulatorService, 'start');

    const actualResult = await context.call(EmulatorStart, {
      dryRun: true,
    });

    expect(actualResult.name).toEqual('google.pubSub');
    expect(actualResult.configuration).toEqual({});
    expect(gcloudEmulatorService.start).not.toHaveBeenCalled();
  });

  it('should start the emulator, create the topics and return the configuration', async () => {
    const actualResult = await context.call(EmulatorStart, {});

    expect(actualResult.name).toEqual('google.pubSub');
    expect(actualResult.configuration).toEqual({
      PUBSUB_EMULATOR_HOST: '127.0.0.1:8085',
      GOOGLE_CLOUD_PROJECT: 'demo-pubsub-test',
      GCP_PROJECT: 'demo-pubsub-test',
      GCLOUD_PROJECT: 'demo-pubsub-test',
      PUBSUB_TOPIC_MY_FIRST_TOPIC_V1:
        'projects/demo-pubsub-test/topics/my.first-topic.v1',
      PUBSUB_TOPIC_MY_SECOND_TOPIC_V1:
        'projects/demo-pubsub-test/topics/my.second-topic.v1',
    });
    expect(await getPubSubEmulatorTopics()).toEqual([
      'projects/demo-pubsub-test/topics/my.first-topic.v1',
      'projects/demo-pubsub-test/topics/my.second-topic.v1',
    ]);
  }, 120000);

  it('should not set up topics if the broker is not Pub/Sub', async () => {
    ({ context, functionRegistry } = createContext({
      configuration: {
        workspace: { name: 'pubsub-test' },
        events: { broker: '📫' },
      },
      functions: [EmulatorStartForPubSub, EmulatorStopForPubSub],
    }));
    registerMockFunction(functionRegistry, EventTopicList, async () => [
      {
        id: 'my.first-topic.v1',
        formatParts: {},
        schemaFilePath: 'my-first-topic.v1.json',
      },
    ]);

    const actualResult = await context.call(EmulatorStart, {});

    expect(actualResult.name).toEqual('google.pubSub');
    expect(actualResult.configuration).toEqual({
      PUBSUB_EMULATOR_HOST: '127.0.0.1:8085',
      GOOGLE_CLOUD_PROJECT: 'demo-pubsub-test',
      GCP_PROJECT: 'demo-pubsub-test',
      GCLOUD_PROJECT: 'demo-pubsub-test',
    });
    expect(await getPubSubEmulatorTopics()).toBeEmpty();
  });

  async function getPubSubEmulatorTopics(): Promise<string[]> {
    const [topics] = await new PubSub({
      projectId: 'demo-pubsub-test',
      apiEndpoint: `127.0.0.1:${PUBSUB_PORT}`,
    }).getTopics();
    return topics.map((t) => t.name).sort();
  }
});

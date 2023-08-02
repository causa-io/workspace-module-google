import { WorkspaceContext } from '@causa/workspace';
import coreModule from '@causa/workspace-core';
import { FunctionRegistry } from '@causa/workspace/function-registry';
import { createContext } from '@causa/workspace/testing';
import { existsSync } from 'fs';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'fs/promises';
import 'jest-extended';
import { join, resolve } from 'path';
import { GooglePubSubWriteTopics } from './write-topics.js';

describe('GooglePubSubWriteTopics', () => {
  const expectedDirectory = join('.causa', 'pubsub-topics');
  let context: WorkspaceContext;
  let functionRegistry: FunctionRegistry<WorkspaceContext>;

  function createTestContext(
    rootPath: string,
    topicConfigurationsDirectory?: string,
  ) {
    ({ context, functionRegistry } = createContext({
      rootPath,
      configuration: {
        events: {
          topics: {
            globs: ['**.yaml'],
            format: '${ topic }',
            regularExpression: '(?<topic>.+)\\.yaml',
          },
        },
        google: { pubSub: { topicConfigurationsDirectory } },
      },
      functions: [GooglePubSubWriteTopics],
    }));
    coreModule({
      registerFunctionImplementations: (...implementations) =>
        functionRegistry.registerImplementations(...implementations),
    });
  }

  beforeEach(async () => {
    const rootPath = resolve(await mkdtemp('causa-test-'));
    createTestContext(rootPath);
  });

  afterEach(async () => {
    await rm(context.rootPath, { recursive: true, force: true });
  });

  it('should not write any topic file', async () => {
    const actualResult = await context.call(GooglePubSubWriteTopics, {});

    expect(actualResult).toEqual({
      configuration: {
        google: {
          pubSub: { topicConfigurationsDirectory: expectedDirectory },
        },
      },
    });
    const actualFiles = await readdir(
      join(context.rootPath, expectedDirectory),
    );
    expect(actualFiles).toBeEmpty();
  });

  it('should write topic files to the default directory', async () => {
    const topicFile1 = join(context.rootPath, 'topic1.yaml');
    const topicFile2 = join(context.rootPath, 'topic.with-punctuation.2.yaml');
    await writeFile(topicFile1, 'name: topic1');
    await writeFile(topicFile2, 'name: topic2');

    const actualResult = await context.call(GooglePubSubWriteTopics, {});

    expect(actualResult).toEqual({
      configuration: {
        google: {
          pubSub: { topicConfigurationsDirectory: expectedDirectory },
        },
      },
    });
    const actualTopic1ConfigurationBuffer = await readFile(
      join(context.rootPath, expectedDirectory, 'topic1.json'),
    );
    expect(JSON.parse(actualTopic1ConfigurationBuffer.toString())).toEqual({
      id: 'topic1',
      schemaFilePath: topicFile1,
      formatParts: { topic: 'topic1' },
      bigQueryTableName: 'topic1',
    });
    const actualTopic2ConfigurationBuffer = await readFile(
      join(
        context.rootPath,
        expectedDirectory,
        'topic.with-punctuation.2.json',
      ),
    );
    expect(JSON.parse(actualTopic2ConfigurationBuffer.toString())).toEqual({
      id: 'topic.with-punctuation.2',
      schemaFilePath: topicFile2,
      formatParts: { topic: 'topic.with-punctuation.2' },
      bigQueryTableName: 'topic_with_punctuation_2',
    });
  });

  it('should write topic files to the specified directory', async () => {
    createTestContext(context.rootPath, 'somewhere-else');
    const topicFile1 = join(context.rootPath, 'topic1.yaml');
    await writeFile(topicFile1, 'name: topic1');

    const actualResult = await context.call(GooglePubSubWriteTopics, {});

    expect(actualResult).toEqual({
      configuration: {
        google: {
          pubSub: { topicConfigurationsDirectory: 'somewhere-else' },
        },
      },
    });
    const actualTopic1ConfigurationBuffer = await readFile(
      join(context.rootPath, 'somewhere-else', 'topic1.json'),
    );
    expect(JSON.parse(actualTopic1ConfigurationBuffer.toString())).toEqual({
      id: 'topic1',
      schemaFilePath: topicFile1,
      formatParts: { topic: 'topic1' },
      bigQueryTableName: 'topic1',
    });
  });

  it('should clean the directory during tear down', async () => {
    await context.call(GooglePubSubWriteTopics, {});
    const expectedAbsoluteDirectory = join(context.rootPath, expectedDirectory);
    const existsAfterWrite = existsSync(expectedAbsoluteDirectory);

    await context.call(GooglePubSubWriteTopics, { tearDown: true });
    const existsAfterTearDown = existsSync(expectedAbsoluteDirectory);

    expect(existsAfterWrite).toBeTrue();
    expect(existsAfterTearDown).toBeFalse();
  });
});

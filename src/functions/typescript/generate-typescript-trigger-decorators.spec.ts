import { ModelGenerateTypeScriptTriggerDecorators } from '@causa/workspace-typescript';
import type { ServiceContainerTrigger } from '@causa/workspace-typescript/code-generation';
import { NoImplementationFoundError } from '@causa/workspace/function-registry';
import { createContext } from '@causa/workspace/testing';
import { ModelGenerateTypeScriptTriggerDecoratorsForGoogle } from './generate-typescript-trigger-decorators.js';

describe('ModelGenerateTypeScriptTriggerDecoratorsForGoogle', () => {
  function setupContext(
    options: { language?: string; platform?: string } = {},
  ) {
    return createContext({
      configuration: {
        workspace: { name: 'test' },
        project: {
          name: 'my-project',
          type: 'serviceContainer',
          language: options.language ?? 'typescript',
        },
        serviceContainer: {
          platform: options.platform ?? 'google.cloudRun',
        },
      },
      functions: [ModelGenerateTypeScriptTriggerDecoratorsForGoogle],
    });
  }

  function callForTrigger(
    trigger: ServiceContainerTrigger,
    options: {
      language?: string;
      platform?: string;
      generator?: string;
    } = {},
  ) {
    const { context } = setupContext(options);
    return context.call(ModelGenerateTypeScriptTriggerDecorators, {
      generator: options.generator ?? 'typescriptNestjsController',
      configuration: {},
      name: 'myTrigger',
      trigger,
    });
  }

  it('should not support languages other than TypeScript', () => {
    expect(() =>
      callForTrigger(
        { type: 'event', topic: 'my.topic.v1' },
        { language: 'javascript' },
      ),
    ).toThrow(NoImplementationFoundError);
  });

  it('should not support a generator other than typescriptNestjsController', () => {
    expect(() =>
      callForTrigger(
        { type: 'event', topic: 'my.topic.v1' },
        { generator: '🤖' },
      ),
    ).toThrow(NoImplementationFoundError);
  });

  it('should not support a service container platform other than Google', () => {
    expect(() =>
      callForTrigger(
        { type: 'event', topic: 'my.topic.v1' },
        { platform: '☁️' },
      ),
    ).toThrow(NoImplementationFoundError);
  });

  it.each<ServiceContainerTrigger>([
    { type: 'event', topic: 'my.topic.v1' },
    {
      type: 'google.pubSub',
      topic: 'my.topic.v1',
      endpoint: { type: 'http', path: '/my-trigger' },
    },
  ])(
    'should return the Pub/Sub event handler decorator for the $type trigger type',
    async (trigger) => {
      const actual = await callForTrigger(trigger);

      expect(actual).toEqual([
        {
          source:
            '@_CausaRuntimeUseEventHandler(_CausaRuntimeGooglePubsubEventHandlerId)',
          imports: {
            '@causa/runtime/nestjs': [
              'UseEventHandler as _CausaRuntimeUseEventHandler',
            ],
            '@causa/runtime-google': [
              'PUBSUB_EVENT_HANDLER_ID as _CausaRuntimeGooglePubsubEventHandlerId',
            ],
          },
        },
      ]);
    },
  );

  it.each<ServiceContainerTrigger>([
    { type: 'task', queue: 'my-queue' },
    {
      type: 'google.tasks',
      queue: 'my-queue',
      endpoint: { type: 'http', path: '/my-trigger' },
    },
  ])(
    'should return the Cloud Tasks event handler decorator for the $type trigger type',
    async (trigger) => {
      const actual = await callForTrigger(trigger);

      expect(actual).toEqual([
        {
          source:
            '@_CausaRuntimeUseEventHandler(_CausaRuntimeGoogleCloudTasksEventHandlerId)',
          imports: {
            '@causa/runtime/nestjs': [
              'UseEventHandler as _CausaRuntimeUseEventHandler',
            ],
            '@causa/runtime-google': [
              'CLOUD_TASKS_EVENT_HANDLER_ID as _CausaRuntimeGoogleCloudTasksEventHandlerId',
            ],
          },
        },
      ]);
    },
  );

  it.each<ServiceContainerTrigger>([
    { type: 'cron', schedule: '* * * * *' },
    {
      type: 'google.scheduler',
      schedule: '* * * * *',
      endpoint: { type: 'http', path: '/my-trigger' },
    },
  ])(
    'should return the Cloud Scheduler event handler decorator for the $type trigger type',
    async (trigger) => {
      const actual = await callForTrigger(trigger);

      expect(actual).toEqual([
        {
          source:
            '@_CausaRuntimeUseEventHandler(_CausaRuntimeGoogleCloudSchedulerEventHandlerId)',
          imports: {
            '@causa/runtime/nestjs': [
              'UseEventHandler as _CausaRuntimeUseEventHandler',
            ],
            '@causa/runtime-google': [
              'CLOUD_SCHEDULER_EVENT_HANDLER_ID as _CausaRuntimeGoogleCloudSchedulerEventHandlerId',
            ],
          },
        },
      ]);
    },
  );

  it('should return the CloudEvents event handler decorator for the google.eventarc trigger type', async () => {
    const actual = await callForTrigger({
      type: 'google.eventarc',
      endpoint: { type: 'http', path: '/my-trigger' },
    });

    expect(actual).toEqual([
      {
        source:
          '@_CausaRuntimeUseEventHandler(_CausaRuntimeCloudeventsEventHandlerId)',
        imports: {
          '@causa/runtime/nestjs': [
            'UseEventHandler as _CausaRuntimeUseEventHandler',
            'CLOUDEVENTS_EVENT_HANDLER_ID as _CausaRuntimeCloudeventsEventHandlerId',
          ],
        },
      },
    ]);
  });

  it('should return no decorators for an unsupported trigger type', async () => {
    const actual = await callForTrigger({
      type: '🚀',
      endpoint: { type: 'http', path: '/my-trigger' },
    });

    expect(actual).toEqual([]);
  });
});

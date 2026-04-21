import { WorkspaceContext } from '@causa/workspace';
import { EventTopicBrokerCreateTrigger } from '@causa/workspace-core';
import { NoImplementationFoundError } from '@causa/workspace/function-registry';
import { createContext } from '@causa/workspace/testing';
import { jest } from '@jest/globals';
import 'jest-extended';
import { CloudRunPubSubTriggerService } from '../../services/cloud-run-pubsub-trigger.js';
import { EventTopicBrokerCreateTriggerForCloudRun } from './broker-create-trigger-cloud-run.js';

describe('EventTopicBrokerCreateTriggerForCloudRun', () => {
  let context: WorkspaceContext;
  let triggerService: CloudRunPubSubTriggerService;

  function createServiceContainerContext(
    extra: Record<string, any> = {},
  ): WorkspaceContext {
    const result = createContext({
      configuration: {
        workspace: { name: 'my-workspace' },
        events: { broker: 'google.pubSub' },
        project: { name: 'my-service', type: 'serviceContainer' },
        serviceContainer: {
          platform: 'google.cloudRun',
          triggers: {
            backfill: {
              type: 'http',
              endpoint: { type: 'http', path: '/events/my-topic' },
            },
          },
        },
        google: {
          project: 'my-project',
          cloudRun: { location: 'my-location' },
        },
        ...extra,
      },
      functions: [EventTopicBrokerCreateTriggerForCloudRun],
    });
    const service = result.context.service(CloudRunPubSubTriggerService);
    jest.spyOn(service, 'create').mockResolvedValue(['resource1']);
    return result.context;
  }

  beforeEach(() => {
    ({ context } = createContext({
      configuration: {
        workspace: { name: 'my-workspace' },
        events: { broker: 'google.pubSub' },
        google: {
          project: 'my-project',
          cloudRun: { location: 'my-location' },
        },
      },
      functions: [EventTopicBrokerCreateTriggerForCloudRun],
    }));
    triggerService = context.service(CloudRunPubSubTriggerService);
    jest.spyOn(triggerService, 'create').mockResolvedValue(['resource1']);
  });

  it('should not support a broker other than google.pubSub', () => {
    ({ context } = createContext({
      configuration: {
        workspace: { name: 'my-workspace' },
        events: { broker: 'kafka' },
        google: { project: 'my-project' },
      },
      functions: [EventTopicBrokerCreateTriggerForCloudRun],
    }));

    expect(() =>
      context.call(EventTopicBrokerCreateTrigger, {
        backfillId: '1234',
        topicId: 'my-topic',
        trigger: 'services/my-service/some/path',
      }),
    ).toThrow(NoImplementationFoundError);
  });

  it('should not support a non-matching trigger string', () => {
    expect(() =>
      context.call(EventTopicBrokerCreateTrigger, {
        backfillId: '1234',
        topicId: 'my-topic',
        trigger: 'nope',
      }),
    ).toThrow(NoImplementationFoundError);
  });

  it('should create the trigger with the default project and location', async () => {
    const actualResourceIds = await context.call(
      EventTopicBrokerCreateTrigger,
      {
        backfillId: '1234',
        topicId: 'my-topic',
        trigger: 'services/my-service/some/path',
      },
    );

    expect(actualResourceIds).toEqual(['resource1']);
    expect(triggerService.create).toHaveBeenCalledExactlyOnceWith(
      '1234',
      'my-topic',
      'projects/my-project/locations/my-location/services/my-service',
      '/some/path',
    );
  });

  it('should create the trigger with the default project', async () => {
    const actualResourceIds = await context.call(
      EventTopicBrokerCreateTrigger,
      {
        backfillId: '1234',
        topicId: 'my-topic',
        trigger: 'locations/custom/services/my-service/some/path',
      },
    );

    expect(actualResourceIds).toEqual(['resource1']);
    expect(triggerService.create).toHaveBeenCalledExactlyOnceWith(
      '1234',
      'my-topic',
      'projects/my-project/locations/custom/services/my-service',
      '/some/path',
    );
  });

  it('should create the trigger', async () => {
    const actualResourceIds = await context.call(
      EventTopicBrokerCreateTrigger,
      {
        backfillId: '1234',
        topicId: 'my-topic',
        trigger:
          'projects/custom-project/locations/custom/services/my-service/some/path',
      },
    );

    expect(actualResourceIds).toEqual(['resource1']);
    expect(triggerService.create).toHaveBeenCalledExactlyOnceWith(
      '1234',
      'my-topic',
      'projects/custom-project/locations/custom/services/my-service',
      '/some/path',
    );
  });

  it('should not support an object trigger when the project is not a serviceContainer', () => {
    ({ context } = createContext({
      configuration: {
        workspace: { name: 'my-workspace' },
        events: { broker: 'google.pubSub' },
        project: { name: 'my-service', type: 'package' },
        google: {
          project: 'my-project',
          cloudRun: { location: 'my-location' },
        },
      },
      functions: [EventTopicBrokerCreateTriggerForCloudRun],
    }));

    expect(() =>
      context.call(EventTopicBrokerCreateTrigger, {
        backfillId: '1234',
        topicId: 'my-topic',
        trigger: { name: 'backfill', options: {} },
      }),
    ).toThrow(NoImplementationFoundError);
  });

  it('should not support an object trigger on a non-Cloud Run serviceContainer', () => {
    ({ context } = createContext({
      configuration: {
        workspace: { name: 'my-workspace' },
        events: { broker: 'google.pubSub' },
        project: { name: 'my-service', type: 'serviceContainer' },
        serviceContainer: { platform: 'kubernetes' },
        google: {
          project: 'my-project',
          cloudRun: { location: 'my-location' },
        },
      },
      functions: [EventTopicBrokerCreateTriggerForCloudRun],
    }));

    expect(() =>
      context.call(EventTopicBrokerCreateTrigger, {
        backfillId: '1234',
        topicId: 'my-topic',
        trigger: { name: 'backfill', options: {} },
      }),
    ).toThrow(NoImplementationFoundError);
  });

  it('should create the trigger from an object using the project name', async () => {
    context = createServiceContainerContext();
    triggerService = context.service(CloudRunPubSubTriggerService);

    const actualResourceIds = await context.call(
      EventTopicBrokerCreateTrigger,
      {
        backfillId: '1234',
        topicId: 'my-topic',
        trigger: { name: 'backfill', options: {} },
      },
    );

    expect(actualResourceIds).toEqual(['resource1']);
    expect(triggerService.create).toHaveBeenCalledExactlyOnceWith(
      '1234',
      'my-topic',
      'projects/my-project/locations/my-location/services/my-service',
      '/events/my-topic',
    );
  });

  it('should use the configured eventBackfillServiceName and append options as a query string', async () => {
    context = createServiceContainerContext({
      google: {
        project: 'my-project',
        cloudRun: {
          location: 'my-location',
          eventBackfillServiceName: 'custom-service',
        },
      },
    });
    triggerService = context.service(CloudRunPubSubTriggerService);

    const actualResourceIds = await context.call(
      EventTopicBrokerCreateTrigger,
      {
        backfillId: '1234',
        topicId: 'my-topic',
        trigger: {
          name: 'backfill',
          options: { region: 'eu', dryRun: 'true' },
        },
      },
    );

    expect(actualResourceIds).toEqual(['resource1']);
    expect(triggerService.create).toHaveBeenCalledExactlyOnceWith(
      '1234',
      'my-topic',
      'projects/my-project/locations/my-location/services/custom-service',
      '/events/my-topic?region=eu&dryRun=true',
    );
  });

  it('should throw when the referenced trigger is not defined', async () => {
    context = createServiceContainerContext();
    triggerService = context.service(CloudRunPubSubTriggerService);

    const actualPromise = context.call(EventTopicBrokerCreateTrigger, {
      backfillId: '1234',
      topicId: 'my-topic',
      trigger: { name: 'missing', options: {} },
    });

    await expect(actualPromise).rejects.toThrow(
      `Trigger 'missing' does not exist or does not define an HTTP endpoint.`,
    );
    expect(triggerService.create).not.toHaveBeenCalled();
  });

  it('should throw when the referenced trigger has a non-HTTP endpoint', async () => {
    context = createServiceContainerContext({
      serviceContainer: {
        platform: 'google.cloudRun',
        triggers: {
          backfill: {
            type: 'event',
            endpoint: { type: 'grpc', path: '/events/my-topic' },
          },
        },
      },
    });
    triggerService = context.service(CloudRunPubSubTriggerService);

    const actualPromise = context.call(EventTopicBrokerCreateTrigger, {
      backfillId: '1234',
      topicId: 'my-topic',
      trigger: { name: 'backfill', options: {} },
    });

    await expect(actualPromise).rejects.toThrow(
      `Trigger 'backfill' does not exist or does not define an HTTP endpoint.`,
    );
    expect(triggerService.create).not.toHaveBeenCalled();
  });
});

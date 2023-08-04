import { WorkspaceContext } from '@causa/workspace';
import { EventTopicBrokerCreateTrigger } from '@causa/workspace-core';
import { NoImplementationFoundError } from '@causa/workspace/function-registry';
import { createContext } from '@causa/workspace/testing';
import { jest } from '@jest/globals';
import 'jest-extended';
import { CloudRunPubSubTriggerService } from '../../services/index.js';
import { EventTopicBrokerCreateTriggerForCloudRun } from './broker-create-trigger-cloud-run.js';

describe('EventTopicBrokerCreateTriggerForCloudRun', () => {
  let context: WorkspaceContext;
  let triggerService: CloudRunPubSubTriggerService;

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

  it('should not support a non-matching trigger', () => {
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
});

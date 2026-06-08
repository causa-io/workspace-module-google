import { WorkspaceContext } from '@causa/workspace';
import { EventTopicBrokerDeleteTriggerResource } from '@causa/workspace-core';
import { NoImplementationFoundError } from '@causa/workspace/function-registry';
import { createContext } from '@causa/workspace/testing';
import { jest } from '@jest/globals';
import 'jest-extended';
import { CloudRunService } from '../../services/cloud-run.js';
import { EventTopicBrokerDeleteTriggerResourceForCloudRunService } from './broker-delete-trigger-resource-cloud-run-service.js';

describe('EventTopicBrokerDeleteTriggerResourceForCloudRunService', () => {
  const serviceId =
    'projects/my-project/locations/my-location/services/backfill-1234-my-service-abcdef';

  let context: WorkspaceContext;

  beforeEach(() => {
    ({ context } = createContext({
      configuration: {
        workspace: { name: 'my-workspace' },
        events: { broker: 'google.pubSub' },
        google: { project: 'my-project' },
      },
      functions: [EventTopicBrokerDeleteTriggerResourceForCloudRunService],
    }));
  });

  it('should not support a broker other than google.pubSub', () => {
    ({ context } = createContext({
      configuration: {
        workspace: { name: 'my-workspace' },
        events: { broker: 'kafka' },
        google: { project: 'my-project' },
      },
      functions: [EventTopicBrokerDeleteTriggerResourceForCloudRunService],
    }));

    expect(() =>
      context.call(EventTopicBrokerDeleteTriggerResource, { id: serviceId }),
    ).toThrow(NoImplementationFoundError);
  });

  it('should not support a non-matching resource ID', () => {
    expect(() =>
      context.call(EventTopicBrokerDeleteTriggerResource, {
        id: 'nope/nope',
      }),
    ).toThrow(NoImplementationFoundError);
  });

  it('should not support an invoker binding resource ID', () => {
    expect(() =>
      context.call(EventTopicBrokerDeleteTriggerResource, {
        id: `${serviceId}/invokerBindings/account@google.com`,
      }),
    ).toThrow(NoImplementationFoundError);
  });

  it('should delete the Cloud Run service', async () => {
    const cloudRunService = context.service(CloudRunService);
    jest.spyOn(cloudRunService, 'delete').mockResolvedValueOnce();

    await context.call(EventTopicBrokerDeleteTriggerResource, {
      id: serviceId,
    });

    expect(cloudRunService.delete).toHaveBeenCalledExactlyOnceWith(serviceId);
  });
});

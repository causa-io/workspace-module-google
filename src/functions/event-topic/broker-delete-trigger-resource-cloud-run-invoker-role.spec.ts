import { WorkspaceContext } from '@causa/workspace';
import { EventTopicBrokerDeleteTriggerResource } from '@causa/workspace-core';
import { NoImplementationFoundError } from '@causa/workspace/function-registry';
import { createContext } from '@causa/workspace/testing';
import { jest } from '@jest/globals';
import 'jest-extended';
import { CloudRunService } from '../../services/index.js';
import { EventTopicBrokerDeleteTriggerResourceForCloudRunInvokerRole } from './broker-delete-trigger-resource-cloud-run-invoker-role.js';

describe('EventTopicBrokerDeleteTriggerResourceForCloudRunInvokerRole', () => {
  let context: WorkspaceContext;

  beforeEach(() => {
    ({ context } = createContext({
      configuration: {
        workspace: { name: 'my-workspace' },
        events: { broker: 'google.pubSub' },
        google: { project: 'my-project' },
      },
      functions: [EventTopicBrokerDeleteTriggerResourceForCloudRunInvokerRole],
    }));
  });

  it('should not support a broker other than google.pubSub', () => {
    ({ context } = createContext({
      configuration: {
        workspace: { name: 'my-workspace' },
        events: { broker: 'kafka' },
        google: { project: 'my-project' },
      },
      functions: [EventTopicBrokerDeleteTriggerResourceForCloudRunInvokerRole],
    }));

    expect(() =>
      context.call(EventTopicBrokerDeleteTriggerResource, {
        id: 'projects/my-project/locations/my-location/services/my-service/invokerBindings/account@google.com',
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

  it('should remove the invoker role from the service account', async () => {
    const cloudRunService = context.service(CloudRunService);
    jest.spyOn(cloudRunService, 'removeInvokerBinding').mockResolvedValueOnce();

    await context.call(EventTopicBrokerDeleteTriggerResource, {
      id: 'projects/my-project/locations/my-location/services/my-service/invokerBindings/account@google.com',
    });

    expect(
      cloudRunService.removeInvokerBinding,
    ).toHaveBeenCalledExactlyOnceWith(
      'projects/my-project/locations/my-location/services/my-service',
      'account@google.com',
    );
  });
});

import { WorkspaceContext } from '@causa/workspace';
import { EventTopicBrokerDeleteTriggerResource } from '@causa/workspace-core';
import { NoImplementationFoundError } from '@causa/workspace/function-registry';
import { createContext } from '@causa/workspace/testing';
import { jest } from '@jest/globals';
import 'jest-extended';
import { IamService } from '../../services/index.js';
import { EventTopicBrokerDeleteTriggerResourceForServiceAccount } from './broker-delete-trigger-resource-service-account.js';

describe('EventTopicBrokerDeleteTriggerResourceForServiceAccount', () => {
  let context: WorkspaceContext;
  let iamService: IamService;

  beforeEach(() => {
    ({ context } = createContext({
      configuration: {
        workspace: { name: 'my-workspace' },
        events: { broker: 'google.pubSub' },
        google: { project: 'my-project' },
      },
      functions: [EventTopicBrokerDeleteTriggerResourceForServiceAccount],
    }));
    iamService = context.service(IamService);
  });

  it('should not support a broker other than google.pubSub', () => {
    ({ context } = createContext({
      configuration: {
        workspace: { name: 'my-workspace' },
        events: { broker: 'kafka' },
        google: { project: 'my-project' },
      },
      functions: [EventTopicBrokerDeleteTriggerResourceForServiceAccount],
    }));

    expect(() =>
      context.call(EventTopicBrokerDeleteTriggerResource, {
        id: 'projects/my-project/serviceAccounts/my-service-account',
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

  it('should delete the service account', async () => {
    jest.spyOn(iamService, 'deleteServiceAccount').mockResolvedValue();

    await context.call(EventTopicBrokerDeleteTriggerResource, {
      id: 'projects/my-project/serviceAccounts/my-service-account',
    });

    expect(iamService.deleteServiceAccount).toHaveBeenCalledExactlyOnceWith(
      'projects/my-project/serviceAccounts/my-service-account',
    );
  });

  it('should not fail if the service account does not exist', async () => {
    jest
      .spyOn(iamService, 'deleteServiceAccount')
      .mockRejectedValueOnce({ code: 404 });

    await context.call(EventTopicBrokerDeleteTriggerResource, {
      id: 'projects/my-project/serviceAccounts/my-service-account',
    });

    expect(iamService.deleteServiceAccount).toHaveBeenCalledExactlyOnceWith(
      'projects/my-project/serviceAccounts/my-service-account',
    );
  });

  it('should rethrow an unknown error', async () => {
    jest
      .spyOn(iamService, 'deleteServiceAccount')
      .mockRejectedValueOnce(new Error('💥'));

    const actualPromise = context.call(EventTopicBrokerDeleteTriggerResource, {
      id: 'projects/my-project/serviceAccounts/my-service-account',
    });

    await expect(actualPromise).rejects.toThrow('💥');
    expect(iamService.deleteServiceAccount).toHaveBeenCalledExactlyOnceWith(
      'projects/my-project/serviceAccounts/my-service-account',
    );
  });
});

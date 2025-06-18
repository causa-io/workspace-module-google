import { WorkspaceContext } from '@causa/workspace';
import { EventTopicTriggerCreationError } from '@causa/workspace-core';
import { createContext } from '@causa/workspace/testing';
import { jest } from '@jest/globals';
import 'jest-extended';
import { CloudRunPubSubTriggerService } from './cloud-run-pubsub-trigger.js';
import { CloudRunService } from './cloud-run.js';
import { IamService } from './iam.js';
import { PubSubService } from './pubsub.js';

describe('CloudRunPubSubTriggerService', () => {
  const pushServiceAccountBindings = [{ role: 'role', members: ['member'] }];

  let context: WorkspaceContext;
  let service: CloudRunPubSubTriggerService;
  let cloudRunService: CloudRunService;
  let pubSubService: PubSubService;
  let iamService: IamService;

  beforeEach(() => {
    ({ context } = createContext({
      configuration: {
        workspace: { name: 'my-workspace' },
        events: { broker: 'google.pubSub' },
        google: { project: 'my-project' },
      },
    }));
    service = context.service(CloudRunPubSubTriggerService);
    cloudRunService = context.service(CloudRunService);
    pubSubService = context.service(PubSubService);
    iamService = context.service(IamService);
    jest.spyOn(cloudRunService, 'addInvokerBinding').mockResolvedValue();
    jest
      .spyOn(cloudRunService, 'getServiceUri')
      .mockImplementation(async (id) => `URI ${id}`);
    jest
      .spyOn(pubSubService, 'getPushServiceAccountBindings')
      .mockResolvedValue(pushServiceAccountBindings);
    jest
      .spyOn(pubSubService.pubSub as any, 'createSubscription')
      .mockResolvedValue({});
    jest
      .spyOn(iamService, 'createServiceAccount')
      .mockImplementation(async (projectId, serviceAccountId) => ({
        name: `projects/${projectId}/serviceAccounts/${serviceAccountId}`,
        email: `${serviceAccountId}@${projectId}.iam.gserviceaccount.com`,
      }));
  });

  it('should create the resources for a trigger', async () => {
    const actualResources = await service.create(
      '1234',
      'projects/my-project/topics/my-topic',
      'projects/my-project/locations/my-region/services/my-service',
      '/some/path',
    );

    expect(
      pubSubService.getPushServiceAccountBindings,
    ).toHaveBeenCalledExactlyOnceWith();
    expect(iamService.createServiceAccount).toHaveBeenCalledExactlyOnceWith(
      'my-project',
      expect.any(String),
      { bindings: pushServiceAccountBindings },
    );
    expect(cloudRunService.addInvokerBinding).toHaveBeenCalledExactlyOnceWith(
      'projects/my-project/locations/my-region/services/my-service',
      'backfill-pubsub-1234@my-project.iam.gserviceaccount.com',
    );
    expect(cloudRunService.getServiceUri).toHaveBeenCalledExactlyOnceWith(
      'projects/my-project/locations/my-region/services/my-service',
    );
    expect(
      pubSubService.pubSub.createSubscription,
    ).toHaveBeenCalledExactlyOnceWith(
      'projects/my-project/topics/my-topic',
      expect.any(String),
      expect.objectContaining({
        pushConfig: {
          pushEndpoint:
            'URI projects/my-project/locations/my-region/services/my-service/some/path',
          oidcToken: {
            serviceAccountEmail:
              'backfill-pubsub-1234@my-project.iam.gserviceaccount.com',
          },
        },
      }),
    );
    const actualPubSubSubscriptionId = (
      pubSubService.pubSub.createSubscription as jest.Mock
    ).mock.calls[0][1];
    expect(actualResources).toIncludeAllMembers([
      'projects/my-project/serviceAccounts/backfill-pubsub-1234',
      'projects/my-project/locations/my-region/services/my-service/invokerBindings/backfill-pubsub-1234@my-project.iam.gserviceaccount.com',
      actualPubSubSubscriptionId,
    ]);
  });

  it('should reuse service accounts and grants', async () => {
    const actualResources1 = await service.create(
      '1234',
      'projects/my-project/topics/my-topic',
      'projects/my-project/locations/my-region/services/my-service',
      '/some/path',
    );
    const actualResources2 = await service.create(
      '1234',
      'projects/my-project/topics/my-topic2',
      'projects/my-project/locations/my-region/services/my-service',
      '/some/other/path',
    );
    const actualResources3 = await service.create(
      '1234',
      'projects/my-project/topics/my-topic3',
      'projects/my-project/locations/my-region/services/my-service2',
      '/some/other/path',
    );

    expect(pubSubService.getPushServiceAccountBindings).toHaveBeenCalledOnce();
    expect(iamService.createServiceAccount).toHaveBeenCalledOnce();
    expect(cloudRunService.addInvokerBinding).toHaveBeenCalledTimes(2);
    expect(cloudRunService.getServiceUri).toHaveBeenCalledTimes(3);
    expect(pubSubService.pubSub.createSubscription).toHaveBeenCalledTimes(3);
    const actualPubSubSubscriptionId1 = (
      pubSubService.pubSub.createSubscription as jest.Mock
    ).mock.calls[0][1];
    expect(actualResources1).toIncludeAllMembers([
      'projects/my-project/serviceAccounts/backfill-pubsub-1234',
      'projects/my-project/locations/my-region/services/my-service/invokerBindings/backfill-pubsub-1234@my-project.iam.gserviceaccount.com',
      actualPubSubSubscriptionId1,
    ]);
    const actualPubSubSubscriptionId2 = (
      pubSubService.pubSub.createSubscription as jest.Mock
    ).mock.calls[1][1];
    expect(actualResources2).toIncludeAllMembers([actualPubSubSubscriptionId2]);
    const actualPubSubSubscriptionId3 = (
      pubSubService.pubSub.createSubscription as jest.Mock
    ).mock.calls[2][1];
    expect(actualResources3).toIncludeAllMembers([
      'projects/my-project/locations/my-region/services/my-service2/invokerBindings/backfill-pubsub-1234@my-project.iam.gserviceaccount.com',
      actualPubSubSubscriptionId3,
    ]);
  });

  it('should throw an EventTopicTriggerCreationError with the IDs of the already-created resources', async () => {
    const expectedError = new Error('💥');
    (pubSubService.pubSub.createSubscription as any).mockRejectedValue(
      expectedError,
    );

    const actualPromise = service.create(
      '1234',
      'projects/my-project/topics/my-topic',
      'projects/my-project/locations/my-region/services/my-service',
      '/some/path',
    );

    await expect(actualPromise).rejects.toThrow(EventTopicTriggerCreationError);
    await expect(actualPromise).rejects.toThrow(
      expect.objectContaining({
        parent: expectedError,
        resourceIds: [
          'projects/my-project/serviceAccounts/backfill-pubsub-1234',
          'projects/my-project/locations/my-region/services/my-service/invokerBindings/backfill-pubsub-1234@my-project.iam.gserviceaccount.com',
        ],
      }),
    );
  });
});

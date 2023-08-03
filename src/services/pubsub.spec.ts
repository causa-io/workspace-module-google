import { WorkspaceContext } from '@causa/workspace';
import { createContext } from '@causa/workspace/testing';
import { jest } from '@jest/globals';
import { PubSubService } from './pubsub.js';
import { ResourceManagerService } from './resource-manager.js';

describe('PubSubService', () => {
  let context: WorkspaceContext;
  let service: PubSubService;

  beforeEach(() => {
    ({ context } = createContext({
      configuration: {
        workspace: { name: 'my-workspace' },
        google: { project: 'my-project' },
      },
    }));
    service = context.service(PubSubService);
  });

  describe('getGcpServiceAccount', () => {
    it('should return the service account email', async () => {
      jest
        .spyOn(context.service(ResourceManagerService), 'getProjectNumber')
        .mockResolvedValue('12345');

      const actualServiceAccount = await service.getGcpServiceAccount();

      expect(actualServiceAccount).toEqual(
        'service-12345@gcp-sa-pubsub.iam.gserviceaccount.com',
      );
    });
  });

  describe('getPushServiceAccountBindings', () => {
    it('should return the bindings', async () => {
      jest
        .spyOn(context.service(ResourceManagerService), 'getProjectNumber')
        .mockResolvedValue('12345');

      const actualBindings = await service.getPushServiceAccountBindings();

      expect(actualBindings).toEqual([
        {
          role: 'roles/iam.serviceAccountTokenCreator',
          members: [
            'serviceAccount:service-12345@gcp-sa-pubsub.iam.gserviceaccount.com',
          ],
        },
      ]);
    });
  });
});

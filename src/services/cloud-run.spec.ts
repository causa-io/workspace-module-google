import { jest } from '@jest/globals';
import 'jest-extended';
import { CloudRunService } from './cloud-run.js';

describe('CloudRunService', () => {
  let service: CloudRunService;

  beforeEach(() => {
    service = new CloudRunService();
  });

  describe('getServiceUri', () => {
    it('should return the service URI', async () => {
      const expectedUri = 'https://my-service-12345-uc.a.run.app';
      jest
        .spyOn(service.servicesClient as any, 'getService')
        .mockResolvedValue([{ uri: expectedUri }]);

      const actualUri = await service.getServiceUri('my-service');

      expect(actualUri).toEqual(expectedUri);
      expect(service.servicesClient.getService).toHaveBeenCalledExactlyOnceWith(
        { name: 'my-service' },
      );
    });
  });

  describe('addInvokerBinding', () => {
    it('should add the invoker binding', async () => {
      const existingPolicy = {
        bindings: [
          { role: 'roles/run.invoker', members: ['serviceAccount:alice'] },
        ],
      };
      jest
        .spyOn(service.servicesClient as any, 'getIamPolicy')
        .mockResolvedValue([existingPolicy]);
      jest
        .spyOn(service.servicesClient as any, 'setIamPolicy')
        .mockResolvedValue({} as any);

      await service.addInvokerBinding('my-service', 'bob');

      expect(
        service.servicesClient.getIamPolicy,
      ).toHaveBeenCalledExactlyOnceWith({
        resource: 'my-service',
      });
      expect(
        service.servicesClient.setIamPolicy,
      ).toHaveBeenCalledExactlyOnceWith({
        resource: 'my-service',
        policy: {
          bindings: [
            { role: 'roles/run.invoker', members: ['serviceAccount:alice'] },
            { role: 'roles/run.invoker', members: ['serviceAccount:bob'] },
          ],
        },
      });
    });
  });

  describe('removeInvokerBinding', () => {
    it('should filter out the invoker binding', async () => {
      const existingPolicy = {
        bindings: [
          {
            role: 'roles/run.invoker',
            members: ['serviceAccount:alice', 'serviceAccount:bob'],
          },
          { role: 'roles/run.invoker', members: ['serviceAccount:charlie'] },
          { role: 'roles/otherRole', members: ['serviceAccount:alice'] },
        ],
      };
      jest
        .spyOn(service.servicesClient as any, 'getIamPolicy')
        .mockResolvedValue([existingPolicy]);
      jest
        .spyOn(service.servicesClient as any, 'setIamPolicy')
        .mockResolvedValue({} as any);

      await service.removeInvokerBinding('my-service', 'bob');

      expect(
        service.servicesClient.getIamPolicy,
      ).toHaveBeenCalledExactlyOnceWith({
        resource: 'my-service',
      });
      expect(
        service.servicesClient.setIamPolicy,
      ).toHaveBeenCalledExactlyOnceWith({
        resource: 'my-service',
        policy: {
          bindings: [
            { role: 'roles/run.invoker', members: ['serviceAccount:alice'] },
            { role: 'roles/run.invoker', members: ['serviceAccount:charlie'] },
            { role: 'roles/otherRole', members: ['serviceAccount:alice'] },
          ],
        },
      });
    });

    it('should remove an empty binding', async () => {
      const existingPolicy = {
        bindings: [
          {
            role: 'roles/run.invoker',
            members: ['deleted:serviceAccount:bob'],
          },
          { role: 'roles/otherRole', members: ['serviceAccount:charlie'] },
        ],
      };
      jest
        .spyOn(service.servicesClient as any, 'getIamPolicy')
        .mockResolvedValue([existingPolicy]);
      jest
        .spyOn(service.servicesClient as any, 'setIamPolicy')
        .mockResolvedValue({} as any);

      await service.removeInvokerBinding('my-service', 'bob');

      expect(
        service.servicesClient.getIamPolicy,
      ).toHaveBeenCalledExactlyOnceWith({
        resource: 'my-service',
      });
      expect(
        service.servicesClient.setIamPolicy,
      ).toHaveBeenCalledExactlyOnceWith({
        resource: 'my-service',
        policy: {
          bindings: [
            { role: 'roles/otherRole', members: ['serviceAccount:charlie'] },
          ],
        },
      });
    });
  });
});

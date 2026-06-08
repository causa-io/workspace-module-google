import { jest } from '@jest/globals';
import { grpc } from 'google-gax';
import 'jest-extended';
import { CloudRunService, IngressTraffic } from './cloud-run.js';

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

  describe('copy', () => {
    it('should create a copy with overridden scaling, ingress, and labels', async () => {
      const source = {
        ingress: IngressTraffic.INGRESS_TRAFFIC_ALL,
        labels: { existing: 'label' },
        template: {
          revision: 'old-revision',
          containers: [{ image: 'my-image' }],
          scaling: { minInstanceCount: 0, maxInstanceCount: 100 },
          maxInstanceRequestConcurrency: 80,
        },
      };
      jest
        .spyOn(service.servicesClient as any, 'getService')
        .mockResolvedValue([source]);
      const operation = {
        promise: async () => [
          {
            name: 'projects/p/locations/l/services/copy',
            uri: 'https://copy.run.app',
          },
        ],
      };
      jest
        .spyOn(service.servicesClient as any, 'createService')
        .mockResolvedValue([operation]);

      const actual = await service.copy(
        'projects/p/locations/l/services/src',
        'copy',
        {
          overrides: {
            minInstanceCount: 1,
            maxInstanceCount: 3,
            requestConcurrency: 1,
            ingress: IngressTraffic.INGRESS_TRAFFIC_INTERNAL_ONLY,
            labels: { 'causa-backfill-id': '1234' },
          },
        },
      );

      expect(service.servicesClient.getService).toHaveBeenCalledExactlyOnceWith(
        { name: 'projects/p/locations/l/services/src' },
      );
      expect(
        service.servicesClient.createService,
      ).toHaveBeenCalledExactlyOnceWith({
        parent: 'projects/p/locations/l',
        serviceId: 'copy',
        service: {
          template: {
            containers: [{ image: 'my-image' }],
            scaling: { minInstanceCount: 1, maxInstanceCount: 3 },
            maxInstanceRequestConcurrency: 1,
          },
          ingress: IngressTraffic.INGRESS_TRAFFIC_INTERNAL_ONLY,
          labels: { existing: 'label', 'causa-backfill-id': '1234' },
        },
      });
      expect(actual).toEqual({
        name: 'projects/p/locations/l/services/copy',
        uri: 'https://copy.run.app',
      });
    });

    it('should inherit scaling, ingress, and labels that are not overridden', async () => {
      const source = {
        ingress: IngressTraffic.INGRESS_TRAFFIC_ALL,
        labels: { existing: 'label' },
        template: { scaling: { minInstanceCount: 2, maxInstanceCount: 50 } },
      };
      jest
        .spyOn(service.servicesClient as any, 'getService')
        .mockResolvedValue([source]);
      const operation = { promise: async () => [{ name: 'n', uri: 'u' }] };
      jest
        .spyOn(service.servicesClient as any, 'createService')
        .mockResolvedValue([operation]);

      await service.copy('projects/p/locations/l/services/src', 'copy', {
        overrides: { maxInstanceCount: 3 },
      });

      expect(
        service.servicesClient.createService,
      ).toHaveBeenCalledExactlyOnceWith({
        parent: 'projects/p/locations/l',
        serviceId: 'copy',
        service: {
          template: { scaling: { minInstanceCount: 2, maxInstanceCount: 3 } },
          ingress: IngressTraffic.INGRESS_TRAFFIC_ALL,
          labels: { existing: 'label' },
        },
      });
    });

    it('should throw for an invalid source service ID', async () => {
      await expect(service.copy('not-a-service-id', 'copy')).rejects.toThrow(
        "Invalid Cloud Run service ID 'not-a-service-id'.",
      );
    });
  });

  describe('delete', () => {
    it('should delete the service', async () => {
      const operation = {
        promise: jest.fn<() => Promise<any>>().mockResolvedValue([{}]),
      };
      jest
        .spyOn(service.servicesClient as any, 'deleteService')
        .mockResolvedValue([operation]);

      await service.delete('projects/p/locations/l/services/copy');

      expect(
        service.servicesClient.deleteService,
      ).toHaveBeenCalledExactlyOnceWith({
        name: 'projects/p/locations/l/services/copy',
      });
      expect(operation.promise).toHaveBeenCalledOnce();
    });

    it('should ignore a NOT_FOUND error', async () => {
      jest
        .spyOn(service.servicesClient as any, 'deleteService')
        .mockRejectedValue({ code: grpc.status.NOT_FOUND });

      await service.delete('projects/p/locations/l/services/copy');

      expect(
        service.servicesClient.deleteService,
      ).toHaveBeenCalledExactlyOnceWith({
        name: 'projects/p/locations/l/services/copy',
      });
    });

    it('should rethrow other errors', async () => {
      const error = new Error('💥');
      jest
        .spyOn(service.servicesClient as any, 'deleteService')
        .mockRejectedValue(error);

      const actualPromise = service.delete(
        'projects/p/locations/l/services/copy',
      );

      await expect(actualPromise).rejects.toThrow(error);
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
      ).toHaveBeenCalledExactlyOnceWith(
        {
          resource: 'my-service',
          policy: {
            bindings: [
              { role: 'roles/run.invoker', members: ['serviceAccount:alice'] },
              { role: 'roles/run.invoker', members: ['serviceAccount:bob'] },
            ],
          },
        },
        { retry: { retryCodes: [grpc.status.INVALID_ARGUMENT] } },
      );
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

import { jest } from '@jest/globals';
import 'jest-extended';
import { ResourceManagerService } from './resource-manager.js';

describe('ResourceManagerService', () => {
  let service: ResourceManagerService;

  beforeEach(() => {
    service = new ResourceManagerService();
  });

  describe('getProjectNumber', () => {
    it('should throw if the project cannot be found', async () => {
      jest
        .spyOn(service.projectsClient as any, 'searchProjects')
        .mockResolvedValue([[]]);

      const actualPromise = service.getProjectNumber('my-project');

      await expect(actualPromise).rejects.toThrowError(
        `Could not find GCP project 'my-project'.`,
      );
    });

    it('should return the project number', async () => {
      const expectedProject = { name: 'projects/123456789' };
      jest
        .spyOn(service.projectsClient as any, 'searchProjects')
        .mockResolvedValue([[expectedProject]]);

      const actualProjectNumber = await service.getProjectNumber('my-project');

      expect(actualProjectNumber).toEqual('123456789');
      expect(
        service.projectsClient.searchProjects,
      ).toHaveBeenCalledExactlyOnceWith({
        query: 'projectId:my-project',
        pageSize: 1,
      });
    });
  });
});

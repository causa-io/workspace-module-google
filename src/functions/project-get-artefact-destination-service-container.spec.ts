import { WorkspaceContext } from '@causa/workspace';
import { ProjectGetArtefactDestination } from '@causa/workspace-core';
import { NoImplementationFoundError } from '@causa/workspace/function-registry';
import { createContext } from '@causa/workspace/testing';
import { ProjectGetArtefactDestinationForServiceContainer } from './project-get-artefact-destination-service-container.js';

describe('ProjectGetArtefactDestinationForServiceContainer', () => {
  let context: WorkspaceContext;

  beforeEach(() => {
    ({ context } = createContext({
      configuration: {
        workspace: { name: '🏷️' },
        project: {
          name: 'my-service',
          type: 'serviceContainer',
          language: 'csharp',
        },
        serviceContainer: { platform: 'google.cloudRun' },
        google: { cloudRun: { dockerRepository: 'gcr.io/my-workspace' } },
      },
      functions: [ProjectGetArtefactDestinationForServiceContainer],
    }));
  });

  it('should not support service containers for a platform other than Cloud Run', async () => {
    ({ context } = createContext({
      configuration: {
        workspace: { name: '🏷️' },
        project: {
          name: 'my-service',
          type: 'serviceContainer',
          language: 'csharp',
        },
        serviceContainer: { platform: 'aws.ecs' },
      },
      functions: [ProjectGetArtefactDestinationForServiceContainer],
    }));

    expect(() =>
      context.call(ProjectGetArtefactDestination, { tag: 'v1.0.0' }),
    ).toThrow(NoImplementationFoundError);
  });

  it('should return the Docker URI', async () => {
    const actualResult = await context.call(ProjectGetArtefactDestination, {
      tag: 'v1.0.0',
    });

    expect(actualResult).toEqual('gcr.io/my-workspace/my-service:v1.0.0');
  });
});

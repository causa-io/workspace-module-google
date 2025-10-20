import { WorkspaceContext } from '@causa/workspace';
import { ProjectGetArtefactDestination } from '@causa/workspace-core';
import { NoImplementationFoundError } from '@causa/workspace/function-registry';
import { createContext } from '@causa/workspace/testing';
import { ProjectGetArtefactDestinationForCloudFunctions } from './get-artefact-destination-cloud-functions.js';

describe('ProjectGetArtefactDestinationForCloudFunctions', () => {
  let context: WorkspaceContext;

  beforeEach(() => {
    ({ context } = createContext({
      configuration: {
        workspace: { name: '🏷️' },
        project: {
          name: 'my-functions',
          type: 'serverlessFunctions',
          language: 'typescript',
        },
        serverlessFunctions: { platform: 'google.cloudFunctions' },
        google: {
          cloudFunctions: {
            artefactStorage: { bucket: 'my-bucket', prefix: 'prefix' },
          },
        },
      },
      functions: [ProjectGetArtefactDestinationForCloudFunctions],
    }));
  });

  it('should not support serverless functions for a platform other than Cloud Functions', async () => {
    ({ context } = createContext({
      configuration: {
        workspace: { name: '🏷️' },
        project: {
          name: 'my-functions',
          type: 'serverlessFunctions',
          language: 'typescript',
        },
        serverlessFunctions: { platform: 'aws.lambda' },
      },
      functions: [ProjectGetArtefactDestinationForCloudFunctions],
    }));

    expect(() =>
      context.call(ProjectGetArtefactDestination, { tag: 'v1.0.0' }),
    ).toThrow(NoImplementationFoundError);
  });

  it('should not support projects that are not serverless functions', async () => {
    ({ context } = createContext({
      configuration: {
        workspace: { name: '🏷️' },
        project: {
          name: 'my-functions',
          type: 'serviceContainer',
          language: 'typescript',
        },
        serviceContainer: { platform: 'google.cloudRun' },
      },
      functions: [ProjectGetArtefactDestinationForCloudFunctions],
    }));

    expect(() =>
      context.call(ProjectGetArtefactDestination, { tag: 'v1.0.0' }),
    ).toThrow(NoImplementationFoundError);
  });

  it('should return the Cloud Storage URI', async () => {
    const actualResult = await context.call(ProjectGetArtefactDestination, {
      tag: 'v1.0.0',
    });

    expect(actualResult).toEqual(
      'gs://my-bucket/prefix/my-functions/v1.0.0.zip',
    );
  });

  it('should return the Cloud Storage URI without prefix', async () => {
    ({ context } = createContext({
      configuration: {
        workspace: { name: '🏷️' },
        project: {
          name: 'my-functions',
          type: 'serverlessFunctions',
          language: 'typescript',
        },
        serverlessFunctions: { platform: 'google.cloudFunctions' },
        google: {
          cloudFunctions: {
            artefactStorage: { bucket: 'my-bucket' },
          },
        },
      },
      functions: [ProjectGetArtefactDestinationForCloudFunctions],
    }));

    const actualResult = await context.call(ProjectGetArtefactDestination, {
      tag: 'v1.0.0',
    });

    expect(actualResult).toEqual('gs://my-bucket/my-functions/v1.0.0.zip');
  });
});

import {
  InvalidSecretDefinitionError,
  SecretBackendNotFoundError,
  WorkspaceContext,
} from '@causa/workspace';
import { createContext } from '@causa/workspace/testing';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import { jest } from '@jest/globals';
import {
  SecretFetchForGoogleSecretManager,
  UndefinedDefaultGcpProjectError,
  UnexpectedSecretValueError,
} from './fetch-secret-manager.js';

describe('SecretFetchForGoogleSecretManager', () => {
  let context: WorkspaceContext;
  let accessSecretVersion: jest.SpiedFunction<(...args: any[]) => any>;

  beforeEach(() => {
    ({ context } = createContext({
      configuration: {
        workspace: { name: '🏷️' },
        secrets: {
          noId: { backend: 'google.secretManager' },
          invalidId: { backend: 'google.secretManager', id: '$$$' },
          nameOnly: { backend: 'google.secretManager', id: 'my-secret' },
          projectAndName: {
            backend: 'google.secretManager',
            id: 'projects/my-project/secrets/my-secret',
          },
          projectAndVersion: {
            backend: 'google.secretManager',
            id: 'projects/my-project/secrets/my-secret/versions/12',
          },
          notGoogle: { backend: '❌' },
        },
      },
      functions: [SecretFetchForGoogleSecretManager],
    }));
    accessSecretVersion = jest.spyOn(
      SecretManagerServiceClient.prototype,
      'accessSecretVersion',
    );
  });

  it('should throw an error when the secret ID is not defined', async () => {
    const actualPromise = context.secret('noId');

    await expect(actualPromise).rejects.toThrow(InvalidSecretDefinitionError);
  });

  it('should throw an error when the secret ID is invalid', async () => {
    const actualPromise = context.secret('invalidId');

    await expect(actualPromise).rejects.toThrow(InvalidSecretDefinitionError);
  });

  it('should throw when the project is not set', async () => {
    const actualPromise = context.secret('nameOnly');

    await expect(actualPromise).rejects.toThrow(
      UndefinedDefaultGcpProjectError,
    );
  });

  it('should fetch the secret with a defined project', async () => {
    const expectedSecret = '🔑';
    accessSecretVersion.mockResolvedValueOnce([
      { payload: { data: Buffer.from(expectedSecret) } },
    ]);

    const actualSecret = await context.secret('projectAndName');

    expect(actualSecret).toEqual(expectedSecret);
    expect(accessSecretVersion).toHaveBeenCalledWith({
      name: 'projects/my-project/secrets/my-secret/versions/latest',
    });
  });

  it('should fetch the secret with a defined project and version', async () => {
    const expectedSecret = '🔑';
    accessSecretVersion.mockResolvedValueOnce([
      { payload: { data: Buffer.from(expectedSecret) } },
    ]);

    const actualSecret = await context.secret('projectAndVersion');

    expect(actualSecret).toEqual(expectedSecret);
    expect(accessSecretVersion).toHaveBeenCalledWith({
      name: 'projects/my-project/secrets/my-secret/versions/12',
    });
  });

  it('should use the default Google project', async () => {
    ({ context } = createContext({
      configuration: {
        workspace: { name: '🏷️' },
        secrets: {
          nameOnly: { backend: 'google.secretManager', id: 'my-secret' },
        },
        google: { project: 'default-google-project' },
      },
      functions: [SecretFetchForGoogleSecretManager],
    }));
    const expectedSecret = '🔑';
    accessSecretVersion.mockResolvedValueOnce([
      { payload: { data: Buffer.from(expectedSecret) } },
    ]);

    const actualSecret = await context.secret('nameOnly');

    expect(actualSecret).toEqual(expectedSecret);
    expect(accessSecretVersion).toHaveBeenCalledWith({
      name: 'projects/default-google-project/secrets/my-secret/versions/latest',
    });
  });

  it('should throw when the secret value cannot be read', async () => {
    accessSecretVersion.mockResolvedValueOnce([{ payload: {} }]);

    const actualPromise = context.secret('projectAndName');

    await expect(actualPromise).rejects.toThrow(UnexpectedSecretValueError);
  });

  it('should not handle secrets with other backends', async () => {
    const actualPromise = context.secret('notGoogle');

    await expect(actualPromise).rejects.toThrow(SecretBackendNotFoundError);
  });
});

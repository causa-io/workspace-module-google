import { createContext } from '@causa/workspace/testing';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import { GoogleSecretManagerService } from './secret-manager.js';

describe('GoogleSecretManagerService', () => {
  it('should initialize the default Google project and client', () => {
    const { context } = createContext({
      configuration: {
        google: { project: 'my-project' },
      },
    });

    const actualService = context.service(GoogleSecretManagerService);

    expect(actualService.defaultProject).toEqual('my-project');
    expect(actualService.client).toBeInstanceOf(SecretManagerServiceClient);
  });

  it('should initialize the default Google project and client', () => {
    const { context } = createContext({
      configuration: {
        google: {
          project: 'my-project',
          secretManager: { project: 'my-secret-manager-project' },
        },
      },
    });

    const actualService = context.service(GoogleSecretManagerService);

    expect(actualService.defaultProject).toEqual('my-secret-manager-project');
    expect(actualService.client).toBeInstanceOf(SecretManagerServiceClient);
  });

  it('should not set the default project', () => {
    const { context } = createContext({});

    const actualService = context.service(GoogleSecretManagerService);

    expect(actualService.defaultProject).toBeUndefined();
    expect(actualService.client).toBeInstanceOf(SecretManagerServiceClient);
  });
});

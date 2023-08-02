import { WorkspaceContext } from '@causa/workspace';
import { EmulatorStart } from '@causa/workspace-core';
import { NoImplementationFoundError } from '@causa/workspace/function-registry';
import { createContext } from '@causa/workspace/testing';
import { jest } from '@jest/globals';
import 'jest-extended';
import { fileURLToPath } from 'url';
import { FirebaseEmulatorService } from '../../services/index.js';
import { EmulatorStartForIdentityPlatform } from './start-identity-platform.js';

describe('EmulatorStartForIdentityPlatform', () => {
  let context: WorkspaceContext;
  let firebaseEmulatorService: FirebaseEmulatorService;

  beforeEach(async () => {
    ({ context } = createContext({
      configuration: { workspace: { name: 'identity-platform-test' } },
      functions: [EmulatorStartForIdentityPlatform],
    }));
    firebaseEmulatorService = context.service(FirebaseEmulatorService);
    jest.spyOn(firebaseEmulatorService, 'start').mockResolvedValue();
  });

  it('should not handle an emulator other than Identity Platform', async () => {
    expect(() =>
      context.call(EmulatorStart, { name: 'otherEmulator' }),
    ).toThrow(NoImplementationFoundError);
  });

  it('should not start the emulator for a dry run', async () => {
    const actualResult = await context.call(EmulatorStart, {
      name: 'google.identityPlatform',
      dryRun: true,
    });

    expect(actualResult).toEqual({
      configuration: {},
      name: 'google.identityPlatform',
    });
    expect(firebaseEmulatorService.start).not.toHaveBeenCalled();
  });

  it('should start the emulator', async () => {
    const actualResult = await context.call(EmulatorStart, {
      name: 'google.identityPlatform',
    });

    expect(actualResult).toEqual({
      configuration: {
        FIREBASE_AUTH_EMULATOR_HOST: `127.0.0.1:9099`,
        GOOGLE_CLOUD_PROJECT: 'demo-identity-platform-test',
        GCP_PROJECT: 'demo-identity-platform-test',
        GCLOUD_PROJECT: 'demo-identity-platform-test',
        FIREBASE_CONFIG: '{}',
      },
      name: 'google.identityPlatform',
    });
    expect(firebaseEmulatorService.start).toHaveBeenCalledExactlyOnceWith(
      'identity-platform-test-identity-platform',
      fileURLToPath(
        new URL('../../assets/firebase-auth.json', import.meta.url),
      ),
      [{ host: '127.0.0.1', container: 9099, local: 9099 }],
    );
  });
});

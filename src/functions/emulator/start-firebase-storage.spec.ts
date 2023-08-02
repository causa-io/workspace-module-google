import { WorkspaceContext } from '@causa/workspace';
import { EmulatorStart } from '@causa/workspace-core';
import {
  FunctionRegistry,
  NoImplementationFoundError,
} from '@causa/workspace/function-registry';
import { createContext, registerMockFunction } from '@causa/workspace/testing';
import { jest } from '@jest/globals';
import 'jest-extended';
import { fileURLToPath } from 'url';
import { FirebaseEmulatorService } from '../../services/index.js';
import { GoogleFirebaseStorageMergeRules } from '../google-firebase-storage/index.js';
import { EmulatorStartForFirebaseStorage } from './start-firebase-storage.js';

describe('EmulatorStartForFirebaseStorage', () => {
  let context: WorkspaceContext;
  let functionRegistry: FunctionRegistry<WorkspaceContext>;
  let firebaseEmulatorService: FirebaseEmulatorService;

  beforeEach(async () => {
    ({ context, functionRegistry } = createContext({
      configuration: { workspace: { name: 'firebase-storage-test' } },
      functions: [EmulatorStartForFirebaseStorage],
    }));
    registerMockFunction(
      functionRegistry,
      GoogleFirebaseStorageMergeRules,
      async () => ({
        securityRuleFile: 'security.rules',
        configuration: {},
      }),
    );
    firebaseEmulatorService = context.service(FirebaseEmulatorService);
    jest.spyOn(firebaseEmulatorService, 'start').mockResolvedValue();
  });

  it('should not handle an emulator other than Firestore', async () => {
    expect(() =>
      context.call(EmulatorStart, { name: 'otherEmulator' }),
    ).toThrow(NoImplementationFoundError);
  });

  it('should not start the emulator for a dry run', async () => {
    const actualResult = await context.call(EmulatorStart, {
      name: 'google.firebaseStorage',
      dryRun: true,
    });

    expect(actualResult).toEqual({
      configuration: {},
      name: 'google.firebaseStorage',
    });
    expect(firebaseEmulatorService.start).not.toHaveBeenCalled();
  });

  it('should merge the Firebase Storage rules and start the emulator', async () => {
    const actualResult = await context.call(EmulatorStart, {
      name: 'google.firebaseStorage',
    });

    expect(actualResult).toEqual({
      configuration: {
        FIREBASE_STORAGE_EMULATOR_HOST: `127.0.0.1:9199`,
        GOOGLE_CLOUD_PROJECT: 'demo-firebase-storage-test',
        GCP_PROJECT: 'demo-firebase-storage-test',
        GCLOUD_PROJECT: 'demo-firebase-storage-test',
        FIREBASE_STORAGE_BUCKET_NAME: `demo-firebase-storage-test.appspot.com`,
        FIREBASE_CONFIG: '{}',
      },
      name: 'google.firebaseStorage',
    });
    expect(firebaseEmulatorService.start).toHaveBeenCalledExactlyOnceWith(
      'firebase-storage-test-firebase-storage',
      fileURLToPath(
        new URL('../../assets/firebase-storage.json', import.meta.url),
      ),
      [{ host: '127.0.0.1', container: 9199, local: 9199 }],
      {
        mounts: [
          {
            type: 'bind',
            source: 'security.rules',
            destination: '/home/node/storage.rules',
            readonly: true,
          },
        ],
        expectedStatus: 501,
      },
    );
  });
});

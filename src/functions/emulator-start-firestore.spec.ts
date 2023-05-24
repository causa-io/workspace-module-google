import { WorkspaceContext } from '@causa/workspace';
import { EmulatorStart, EmulatorStop } from '@causa/workspace-core';
import {
  FunctionRegistry,
  NoImplementationFoundError,
} from '@causa/workspace/function-registry';
import { createContext, registerMockFunction } from '@causa/workspace/testing';
import { jest } from '@jest/globals';
import 'jest-extended';
import { GcloudEmulatorService } from '../index.js';
import { EmulatorStartForFirestore } from './emulator-start-firestore.js';
import { GoogleFirestoreMergeRules } from './google-firestore-merge-rules.js';

describe('EmulatorStartForFirestore', () => {
  let context: WorkspaceContext;
  let functionRegistry: FunctionRegistry<WorkspaceContext>;
  let gcloudEmulatorService: GcloudEmulatorService;

  beforeEach(async () => {
    ({ context, functionRegistry } = createContext({
      configuration: { workspace: { name: 'firestore-test' } },
      functions: [EmulatorStartForFirestore],
    }));
    registerMockFunction(
      functionRegistry,
      GoogleFirestoreMergeRules,
      async () => ({
        securityRuleFile: 'security.rules',
        configuration: {},
      }),
    );
    gcloudEmulatorService = context.service(GcloudEmulatorService);
    jest.spyOn(gcloudEmulatorService, 'start').mockResolvedValue();
  });

  it('should not handle an emulator other than Firestore', async () => {
    expect(() => context.call(EmulatorStop, { name: 'otherEmulator' })).toThrow(
      NoImplementationFoundError,
    );
  });

  it('should not start the emulator for a dry run', async () => {
    const actualResult = await context.call(EmulatorStart, {
      name: 'google.firestore',
      dryRun: true,
    });

    expect(actualResult).toEqual({
      configuration: {},
      name: 'google.firestore',
    });
    expect(gcloudEmulatorService.start).not.toHaveBeenCalled();
  });

  it('should merge the Firestore rules and start the emulator', async () => {
    const actualResult = await context.call(EmulatorStart, {
      name: 'google.firestore',
    });

    expect(actualResult).toEqual({
      configuration: {
        FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
        GOOGLE_CLOUD_PROJECT: 'demo-firestore-test',
        GCP_PROJECT: 'demo-firestore-test',
        GCLOUD_PROJECT: 'demo-firestore-test',
        FIREBASE_CONFIG: '{}',
      },
      name: 'google.firestore',
    });
    expect(gcloudEmulatorService.start).toHaveBeenCalledOnceWith(
      'firestore',
      'firestore-test-firestore',
      [{ host: '127.0.0.1', local: 8080, container: 8080 }],
      {
        mounts: [
          {
            type: 'bind',
            source: 'security.rules',
            destination: '/firestore.rules',
            readonly: true,
          },
        ],
        additionalArguments: ['--rules', '/firestore.rules'],
        availabilityEndpoint: 'http://127.0.0.1:8080/',
      },
    );
  });
});

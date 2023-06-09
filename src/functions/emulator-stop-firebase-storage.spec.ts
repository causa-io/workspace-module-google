import { WorkspaceContext } from '@causa/workspace';
import { DockerEmulatorService, EmulatorStop } from '@causa/workspace-core';
import { NoImplementationFoundError } from '@causa/workspace/function-registry';
import { createContext } from '@causa/workspace/testing';
import { jest } from '@jest/globals';
import 'jest-extended';
import { EmulatorStopForFirebaseStorage } from './emulator-stop-firebase-storage.js';

describe('EmulatorStopForFirebaseStorage', () => {
  let context: WorkspaceContext;
  let dockerEmulatorService: DockerEmulatorService;

  beforeEach(() => {
    ({ context } = createContext({
      configuration: { workspace: { name: 'test' } },
      functions: [EmulatorStopForFirebaseStorage],
    }));
    dockerEmulatorService = context.service(DockerEmulatorService);
    jest.spyOn(dockerEmulatorService, 'stop').mockResolvedValue();
  });

  it('should not handle an emulator other than Firebase Storage', async () => {
    expect(() => context.call(EmulatorStop, { name: 'otherEmulator' })).toThrow(
      NoImplementationFoundError,
    );
  });

  it('should stop the container', async () => {
    const actualName = await context.call(EmulatorStop, {
      name: 'google.firebaseStorage',
    });

    expect(actualName).toEqual('google.firebaseStorage');
    expect(dockerEmulatorService.stop).toHaveBeenCalledExactlyOnceWith(
      'test-firebase-storage',
    );
  });
});

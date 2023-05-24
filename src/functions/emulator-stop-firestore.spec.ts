import { WorkspaceContext } from '@causa/workspace';
import { DockerEmulatorService, EmulatorStop } from '@causa/workspace-core';
import { NoImplementationFoundError } from '@causa/workspace/function-registry';
import { createContext } from '@causa/workspace/testing';
import { jest } from '@jest/globals';
import 'jest-extended';
import { EmulatorStopForFirestore } from './emulator-stop-firestore.js';

describe('EmulatorStopForFirestore', () => {
  let context: WorkspaceContext;
  let dockerEmulatorService: DockerEmulatorService;

  beforeEach(() => {
    ({ context } = createContext({
      configuration: { workspace: { name: 'test' } },
      functions: [EmulatorStopForFirestore],
    }));
    dockerEmulatorService = context.service(DockerEmulatorService);
    jest.spyOn(dockerEmulatorService, 'stop').mockResolvedValue();
  });

  it('should not handle an emulator other than Firestore', async () => {
    expect(() => context.call(EmulatorStop, { name: 'otherEmulator' })).toThrow(
      NoImplementationFoundError,
    );
  });

  it('should stop the container', async () => {
    const actualName = await context.call(EmulatorStop, {
      name: 'google.firestore',
    });

    expect(actualName).toEqual('google.firestore');
    expect(dockerEmulatorService.stop).toHaveBeenCalledOnceWith(
      'test-firestore',
    );
  });
});

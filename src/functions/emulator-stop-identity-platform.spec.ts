import { WorkspaceContext } from '@causa/workspace';
import { DockerEmulatorService, EmulatorStop } from '@causa/workspace-core';
import { NoImplementationFoundError } from '@causa/workspace/function-registry';
import { createContext } from '@causa/workspace/testing';
import { jest } from '@jest/globals';
import 'jest-extended';
import { EmulatorStopForIdentityPlatform } from './emulator-stop-identity-platform.js';

describe('EmulatorStopForIdentityPlatform', () => {
  let context: WorkspaceContext;
  let dockerEmulatorService: DockerEmulatorService;

  beforeEach(() => {
    ({ context } = createContext({
      configuration: { workspace: { name: 'test' } },
      functions: [EmulatorStopForIdentityPlatform],
    }));
    dockerEmulatorService = context.service(DockerEmulatorService);
    jest.spyOn(dockerEmulatorService, 'stop').mockResolvedValue();
  });

  it('should not handle an emulator other than Identity Platform', async () => {
    expect(() => context.call(EmulatorStop, { name: 'otherEmulator' })).toThrow(
      NoImplementationFoundError,
    );
  });

  it('should stop the container', async () => {
    const actualName = await context.call(EmulatorStop, {
      name: 'google.identityPlatform',
    });

    expect(actualName).toEqual('google.identityPlatform');
    expect(dockerEmulatorService.stop).toHaveBeenCalledOnceWith(
      'test-identity-platform',
    );
  });
});

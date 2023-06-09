import { WorkspaceContext } from '@causa/workspace';
import { DockerEmulatorService, EmulatorStop } from '@causa/workspace-core';
import { NoImplementationFoundError } from '@causa/workspace/function-registry';
import { createContext } from '@causa/workspace/testing';
import { jest } from '@jest/globals';
import 'jest-extended';
import { EmulatorStopForPubSub } from './emulator-stop-pubsub.js';

describe('EmulatorStopForPubSub', () => {
  let context: WorkspaceContext;
  let dockerEmulatorService: DockerEmulatorService;

  beforeEach(() => {
    ({ context } = createContext({
      configuration: { workspace: { name: 'test' } },
      functions: [EmulatorStopForPubSub],
    }));
    dockerEmulatorService = context.service(DockerEmulatorService);
    jest.spyOn(dockerEmulatorService, 'stop').mockResolvedValue();
  });

  it('should not handle an emulator other than Pub/Sub', async () => {
    expect(() => context.call(EmulatorStop, { name: 'otherEmulator' })).toThrow(
      NoImplementationFoundError,
    );
  });

  it('should stop the container', async () => {
    const actualName = await context.call(EmulatorStop, {
      name: 'google.pubSub',
    });

    expect(actualName).toEqual('google.pubSub');
    expect(dockerEmulatorService.stop).toHaveBeenCalledExactlyOnceWith(
      'test-pubsub',
    );
  });
});

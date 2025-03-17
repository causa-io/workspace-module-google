import { WorkspaceContext } from '@causa/workspace';
import { DockerEmulatorService } from '@causa/workspace-core';
import { createContext } from '@causa/workspace/testing';
import { jest } from '@jest/globals';
import 'jest-extended';
import { FirebaseEmulatorService } from './firebase-emulator.js';

describe('FirebaseEmulatorService', () => {
  let context: WorkspaceContext;
  let service: FirebaseEmulatorService;
  let dockerEmulatorService: DockerEmulatorService;

  beforeEach(() => {
    ({ context } = createContext({
      configuration: {
        workspace: { name: '️my-workspace' },
        google: {},
      },
    }));
    service = context.service(FirebaseEmulatorService);
    dockerEmulatorService = context.service(DockerEmulatorService);
    jest.spyOn(dockerEmulatorService, 'start').mockResolvedValue();
    jest
      .spyOn(dockerEmulatorService, 'waitForAvailability')
      .mockResolvedValue();
  });

  describe('constructor', () => {
    it('should initialize the local GCP project and Firebase version', () => {
      expect(service.localGcpProject).toEqual('demo-️my-workspace');
      expect(service.firebaseToolsVersion).toEqual('latest');
    });

    it('should use custom local GCP project and Firebase version', () => {
      ({ context } = createContext({
        configuration: {
          workspace: { name: '️my-workspace' },
          google: {
            localProject: 'demo-custom',
            firebase: { tools: { version: '1.0.0' } },
          },
        },
      }));
      service = context.service(FirebaseEmulatorService);

      expect(service.localGcpProject).toEqual('demo-custom');
      expect(service.firebaseToolsVersion).toEqual('1.0.0');
    });
  });

  describe('start', () => {
    it('should start the emulator and wait for it to be available', async () => {
      await service.start(
        'my-emulator',
        '/conf.json',
        [{ container: 1234, local: 8080 }],
        { expectedStatus: 204 },
      );

      expect(dockerEmulatorService.start).toHaveBeenCalledWith(
        'andreysenov/firebase-tools:latest-node-22-slim',
        'my-emulator',
        [{ container: 1234, local: 8080 }],
        expect.objectContaining({
          commandAndArgs: [
            'firebase',
            'emulators:start',
            '-P',
            'demo-️my-workspace',
          ],
          mounts: [
            {
              type: 'bind',
              source: '/conf.json',
              destination: '/home/node/firebase.json',
              readonly: true,
            },
          ],
        }),
      );
      expect(dockerEmulatorService.waitForAvailability).toHaveBeenCalledWith(
        'my-emulator',
        'http://127.0.0.1:8080/',
        expect.objectContaining({ expectedStatus: 204 }),
      );
    });
  });
});

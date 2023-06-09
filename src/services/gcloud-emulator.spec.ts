import { WorkspaceContext } from '@causa/workspace';
import { DockerEmulatorService } from '@causa/workspace-core';
import { createContext } from '@causa/workspace/testing';
import { jest } from '@jest/globals';
import 'jest-extended';
import { GcloudEmulatorService } from './gcloud-emulator.js';

describe('GcloudEmulatorService', () => {
  let context: WorkspaceContext;
  let service: GcloudEmulatorService;
  let dockerEmulatorService: DockerEmulatorService;

  beforeEach(() => {
    ({ context } = createContext({
      configuration: {
        workspace: { name: '️my-workspace' },
        google: {},
      },
    }));
    service = context.service(GcloudEmulatorService);
    dockerEmulatorService = context.service(DockerEmulatorService);
    jest.spyOn(dockerEmulatorService, 'start').mockResolvedValue();
    jest
      .spyOn(dockerEmulatorService, 'waitForAvailability')
      .mockResolvedValue();
  });

  describe('constructor', () => {
    it('should initialize the local GCP project and gcloud version', () => {
      expect(service.localGcpProject).toEqual('demo-️my-workspace');
      expect(service.gcloudVersion).toEqual('latest');
    });

    it('should use custom local GCP project and gcloud version', () => {
      ({ context } = createContext({
        configuration: {
          workspace: { name: '️my-workspace' },
          google: {
            localProject: 'demo-custom',
            gcloud: { version: '200.0.0' },
          },
        },
      }));
      service = context.service(GcloudEmulatorService);

      expect(service.localGcpProject).toEqual('demo-custom');
      expect(service.gcloudVersion).toEqual('200.0.0');
    });
  });

  describe('start', () => {
    it('should use the latest image version and start the emulator', async () => {
      await service.start(
        'the-emulator',
        'my-container',
        [{ container: 1234, local: 8080 }],
        {
          mounts: [
            { type: 'bind', destination: '/destination', source: '/source' },
          ],
          additionalArguments: ['--arg', 'yay'],
        },
      );

      expect(dockerEmulatorService.start).toHaveBeenCalledExactlyOnceWith(
        'gcr.io/google.com/cloudsdktool/google-cloud-cli:emulators',
        'my-container',
        [{ container: 1234, local: 8080 }],
        expect.objectContaining({
          mounts: [
            { type: 'bind', destination: '/destination', source: '/source' },
          ],
          commandAndArgs: expect.toSatisfy((commandAndArgs: string[]) => {
            const call = commandAndArgs.join(' ');
            return (
              call.startsWith('gcloud beta emulators the-emulator start') &&
              call.includes('--project=demo-️my-workspace') &&
              call.includes('--host-port=0.0.0.0:1234') &&
              call.includes('--arg yay')
            );
          }),
        }),
      );
    });

    it('should use the specified image version and start the emulator', async () => {
      ({ context } = createContext({
        configuration: {
          workspace: { name: '️my-workspace' },
          google: { gcloud: { version: '200.0.0' } },
        },
      }));
      service = context.service(GcloudEmulatorService);
      dockerEmulatorService = context.service(DockerEmulatorService);
      jest.spyOn(dockerEmulatorService, 'start').mockResolvedValue();

      await service.start('the-emulator', 'my-container', [
        { container: 1234, local: 8080 },
      ]);

      expect(dockerEmulatorService.start).toHaveBeenCalledExactlyOnceWith(
        'gcr.io/google.com/cloudsdktool/google-cloud-cli:200.0.0-emulators',
        'my-container',
        [{ container: 1234, local: 8080 }],
        expect.objectContaining({
          commandAndArgs: expect.toSatisfy((commandAndArgs: string[]) => {
            const call = commandAndArgs.join(' ');
            return (
              call.startsWith('gcloud beta emulators the-emulator start') &&
              call.includes('--project=demo-️my-workspace') &&
              call.includes('--host-port=0.0.0.0:1234')
            );
          }),
        }),
      );
    });

    it('should wait for the emulator to be available', async () => {
      await service.start(
        'the-emulator',
        'my-container',
        [{ container: 1234, local: 8080 }],
        {
          availabilityEndpoint: {
            endpoint: 'http://localhost:1234',
            maxNumTries: 5,
            expectedStatus: 204,
            timeBetweenTries: 100,
          },
        },
      );

      expect(dockerEmulatorService.start).toHaveBeenCalledExactlyOnceWith(
        'gcr.io/google.com/cloudsdktool/google-cloud-cli:emulators',
        'my-container',
        [{ container: 1234, local: 8080 }],
        expect.objectContaining({
          commandAndArgs: expect.toSatisfy((commandAndArgs: string[]) => {
            const call = commandAndArgs.join(' ');
            return (
              call.startsWith('gcloud beta emulators the-emulator start') &&
              call.includes('--project=demo-️my-workspace') &&
              call.includes('--host-port=0.0.0.0:1234')
            );
          }),
        }),
      );
      expect(
        dockerEmulatorService.waitForAvailability,
      ).toHaveBeenCalledExactlyOnceWith(
        'my-container',
        'http://localhost:1234',
        {
          maxNumTries: 5,
          expectedStatus: 204,
          timeBetweenTries: 100,
        },
      );
    });
  });
});

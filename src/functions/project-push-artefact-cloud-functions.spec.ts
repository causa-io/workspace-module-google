import { WorkspaceContext } from '@causa/workspace';
import {
  ArtefactAlreadyExistsError,
  EmulatorStart,
  EmulatorStop,
  ProjectPushArtefact,
} from '@causa/workspace-core';
import { NoImplementationFoundError } from '@causa/workspace/function-registry';
import { createContext } from '@causa/workspace/testing';
import { Storage } from '@google-cloud/storage';
import { mkdtemp, rm, stat, writeFile } from 'fs/promises';
import { join, resolve } from 'path';
import { EmulatorStartForFirebaseStorage } from './emulator-start-firebase-storage.js';
import { EmulatorStopForFirebaseStorage } from './emulator-stop-firebase-storage.js';
import { GoogleFirebaseStorageMergeRules } from './google-firebase-storage-merge-rules.js';
import { ProjectPushArtefactForCloudFunctions } from './project-push-artefact-cloud-functions.js';

describe('ProjectPushArtefactForCloudFunctions', () => {
  let emulatorTmpDir: string;
  let emulatorContext: WorkspaceContext;
  let initialEnv: Record<string, string | undefined>;
  let storage: Storage;

  let tmpDir: string;
  let context: WorkspaceContext;

  beforeAll(async () => {
    initialEnv = process.env;
    emulatorTmpDir = resolve(await mkdtemp('causa-test-emulator-cf-'));
    ({ context: emulatorContext } = createContext({
      rootPath: emulatorTmpDir,
      configuration: {
        workspace: { name: 'emulator-cf' },
      },
      functions: [
        GoogleFirebaseStorageMergeRules,
        EmulatorStartForFirebaseStorage,
        EmulatorStopForFirebaseStorage,
      ],
    }));
    const { configuration } = await emulatorContext.call(EmulatorStart, {});
    process.env = {
      ...initialEnv,
      STORAGE_EMULATOR_HOST: `http://${configuration.FIREBASE_STORAGE_EMULATOR_HOST}`,
    };
    storage = new Storage();
  }, 300000);

  beforeEach(async () => {
    tmpDir = resolve(await mkdtemp('causa-test-'));
    ({ context } = createContext({
      configuration: {
        workspace: { name: '🏷️' },
        project: {
          name: 'my-functions',
          type: 'serverlessFunctions',
          language: 'typescript',
        },
        serverlessFunctions: { platform: 'google.cloudFunctions' },
      },
      functions: [ProjectPushArtefactForCloudFunctions],
    }));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
    await storage.bucket('my-bucket').deleteFiles({ force: true });
  });

  afterAll(async () => {
    await emulatorContext.call(EmulatorStop, {});
    await rm(emulatorTmpDir, { recursive: true, force: true });
    process.env = initialEnv;
  });

  it('should not support serverless functions for a platform other than Cloud Functions', async () => {
    ({ context } = createContext({
      configuration: {
        workspace: { name: '🏷️' },
        project: {
          name: 'my-functions',
          type: 'serverlessFunctions',
          language: 'typescript',
        },
        serverlessFunctions: { platform: 'aws.lambda' },
      },
      functions: [ProjectPushArtefactForCloudFunctions],
    }));

    expect(() =>
      context.call(ProjectPushArtefact, {
        artefact: 'my-archive.zip',
        destination: 'gs://my-bucket/prefix/my-archive.zip',
      }),
    ).toThrow(NoImplementationFoundError);
  });

  it('should not support projects that are not serverless functions', async () => {
    ({ context } = createContext({
      configuration: {
        workspace: { name: '🏷️' },
        project: {
          name: 'my-functions',
          type: 'serviceContainer',
          language: 'typescript',
        },
        serviceContainer: { platform: 'google.cloudRun' },
      },
      functions: [ProjectPushArtefactForCloudFunctions],
    }));

    expect(() =>
      context.call(ProjectPushArtefact, {
        artefact: 'my-archive.zip',
        destination: 'gs://my-bucket/prefix/my-archive.zip',
      }),
    ).toThrow(NoImplementationFoundError);
  });

  it('should move the artefact to the destination', async () => {
    const artefact = join(tmpDir, 'my-archive.zip');
    await writeFile(artefact, '🍱');
    const expectedDestination = 'gs://my-bucket/prefix/my-archive.zip';

    const actualDestination = await context.call(ProjectPushArtefact, {
      artefact,
      destination: expectedDestination,
    });

    expect(actualDestination).toEqual(expectedDestination);
    await expect(stat(artefact)).rejects.toThrow(
      expect.objectContaining({ code: 'ENOENT' }),
    );
    const [actualDestinationContent] = await storage
      .bucket('my-bucket')
      .file('prefix/my-archive.zip')
      .download();
    expect(actualDestinationContent.toString()).toEqual('🍱');
  });

  it('should throw if the destination already exists', async () => {
    const artefact = join(tmpDir, 'my-archive.zip');
    await writeFile(artefact, '🍱');
    const destination = 'gs://my-bucket/prefix/my-archive.zip';
    await storage.bucket('my-bucket').file('prefix/my-archive.zip').save('❌');

    const actualPromise = context.call(ProjectPushArtefact, {
      artefact,
      destination,
    });

    await expect(actualPromise).rejects.toThrow(ArtefactAlreadyExistsError);
  });

  it('should overwrite the destination', async () => {
    const artefact = join(tmpDir, 'my-archive.zip');
    await writeFile(artefact, '🍱');
    const expectedDestination = 'gs://my-bucket/prefix/my-archive.zip';
    await storage.bucket('my-bucket').file('prefix/my-archive.zip').save('🙈');

    const actualDestination = await context.call(ProjectPushArtefact, {
      artefact,
      destination: expectedDestination,
      overwrite: true,
    });

    expect(actualDestination).toEqual(expectedDestination);
    await expect(stat(artefact)).rejects.toThrow(
      expect.objectContaining({ code: 'ENOENT' }),
    );
    const [actualDestinationContent] = await storage
      .bucket('my-bucket')
      .file('prefix/my-archive.zip')
      .download();
    expect(actualDestinationContent.toString()).toEqual('🍱');
  });
});

import { WorkspaceContext } from '@causa/workspace';
import { DatabaseQueryRecords } from '@causa/workspace-core';
import { DockerEmulatorService } from '@causa/workspace-core/services';
import { NoImplementationFoundError } from '@causa/workspace/function-registry';
import { createContext } from '@causa/workspace/testing';
import { deleteApp, initializeApp } from 'firebase-admin/app';
import { GeoPoint, Timestamp, getFirestore } from 'firebase-admin/firestore';
import 'jest-extended';
import { randomUUID } from 'node:crypto';
import { DatabaseQueryRecordsForFirestore } from './query-records.js';

const FIRESTORE_IMAGE =
  'gcr.io/google.com/cloudsdktool/google-cloud-cli:emulators';
const FIRESTORE_HOST_PORT = 18080;
const FIRESTORE_CONTAINER_NAME = 'causa-test-firestore-query-records';
const PROJECT_ID = 'demo-firestore-query-records';
const COLLECTION = 'singers';

describe('DatabaseQueryRecordsForFirestore', () => {
  let context: WorkspaceContext;
  let dockerEmulatorService: DockerEmulatorService;

  beforeAll(async () => {
    ({ context } = createContext({
      configuration: {
        workspace: { name: 'firestore-query-records-test' },
        google: { project: PROJECT_ID },
      },
      functions: [DatabaseQueryRecordsForFirestore],
    }));
    dockerEmulatorService = context.service(DockerEmulatorService);
    await dockerEmulatorService.start(
      FIRESTORE_IMAGE,
      FIRESTORE_CONTAINER_NAME,
      [{ host: '127.0.0.1', local: FIRESTORE_HOST_PORT, container: 8080 }],
      {
        commandAndArgs: [
          'gcloud',
          'emulators',
          'firestore',
          'start',
          '--host-port=0.0.0.0:8080',
        ],
      },
    );
    await dockerEmulatorService.waitForAvailability(
      FIRESTORE_CONTAINER_NAME,
      `http://127.0.0.1:${FIRESTORE_HOST_PORT}/`,
    );
    process.env.FIRESTORE_EMULATOR_HOST = `127.0.0.1:${FIRESTORE_HOST_PORT}`;
    const app = initializeApp({ projectId: PROJECT_ID }, randomUUID());
    try {
      const firestore = getFirestore(app);
      await firestore
        .doc(`${COLLECTION}/eddie`)
        .set({ id: 'eddie', name: 'Eddie' });
      await firestore.doc(`${COLLECTION}/wilson`).set({
        name: 'Wilson',
        birthDate: Timestamp.fromDate(new Date('2020-01-02T03:04:05.000Z')),
        location: new GeoPoint(48.8566, 2.3522),
        bestSong: firestore.doc('songs/imagine'),
        nested: {
          when: Timestamp.fromDate(new Date('2021-06-07T08:09:10.000Z')),
          tags: [Timestamp.fromDate(new Date('2022-01-01T00:00:00.000Z'))],
        },
      });
    } finally {
      await deleteApp(app);
    }
  }, 300000);

  afterAll(async () => {
    delete process.env.FIRESTORE_EMULATOR_HOST;
    await dockerEmulatorService.stop(FIRESTORE_CONTAINER_NAME);
  });

  it('should not support a different engine', () => {
    expect(() =>
      context.call(DatabaseQueryRecords, {
        engine: 'other.engine',
        query: `${COLLECTION}/eddie`,
      }),
    ).toThrow(NoImplementationFoundError);
  });

  it('should throw when the query is not provided', async () => {
    const actualPromise = context.call(DatabaseQueryRecords, {
      engine: 'google.firestore',
    });

    await expect(actualPromise).rejects.toThrow(
      `The 'query' input is required for the 'google.firestore' engine.`,
    );
  });

  it('should return the document data when it exists', async () => {
    const actualRows = await context.call(DatabaseQueryRecords, {
      engine: 'google.firestore',
      query: `${COLLECTION}/eddie`,
    });

    expect(actualRows).toEqual([{ id: 'eddie', name: 'Eddie' }]);
  });

  it('should convert Firestore types to JSON-friendly equivalents', async () => {
    const actualRows = await context.call(DatabaseQueryRecords, {
      engine: 'google.firestore',
      query: `${COLLECTION}/wilson`,
    });

    expect(actualRows).toEqual([
      {
        name: 'Wilson',
        birthDate: new Date('2020-01-02T03:04:05.000Z'),
        location: { latitude: 48.8566, longitude: 2.3522 },
        bestSong: 'songs/imagine',
        nested: {
          when: new Date('2021-06-07T08:09:10.000Z'),
          tags: [new Date('2022-01-01T00:00:00.000Z')],
        },
      },
    ]);
  });

  it('should return an empty array when the document does not exist', async () => {
    const actualRows = await context.call(DatabaseQueryRecords, {
      engine: 'google.firestore',
      query: `${COLLECTION}/missing`,
    });

    expect(actualRows).toEqual([]);
  });
});

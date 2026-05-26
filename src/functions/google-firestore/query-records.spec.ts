import { WorkspaceContext } from '@causa/workspace';
import {
  DatabaseQueryRecords,
  EmulatorStart,
  EmulatorStop,
} from '@causa/workspace-core';
import {
  FunctionRegistry,
  NoImplementationFoundError,
} from '@causa/workspace/function-registry';
import { createContext, registerMockFunction } from '@causa/workspace/testing';
import { deleteApp, initializeApp } from 'firebase-admin/app';
import { GeoPoint, Timestamp, getFirestore } from 'firebase-admin/firestore';
import 'jest-extended';
import { mkdtemp, rm, writeFile } from 'fs/promises';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import {
  EmulatorStartForFirestore,
  EmulatorStopForFirestore,
} from '../emulator/index.js';
import { GoogleFirestoreMergeRules } from './merge-rules.js';
import { DatabaseQueryRecordsForFirestore } from './query-records.js';

const FIRESTORE_HOST_PORT = 28080;
const FIRESTORE_CONTAINER_NAME = 'causa-test-firestore-query-records';
const PROJECT_ID = 'demo-firestore-query-records';
const COLLECTION = 'singers';

describe('DatabaseQueryRecordsForFirestore', () => {
  let context: WorkspaceContext;
  let functionRegistry: FunctionRegistry<WorkspaceContext>;
  let rulesDir: string;
  let initialEnv: Record<string, string | undefined>;

  beforeAll(async () => {
    initialEnv = process.env;

    rulesDir = resolve(await mkdtemp(join(tmpdir(), 'causa-firestore-rules-')));
    const rulesFile = join(rulesDir, 'firestore.rules');
    await writeFile(
      rulesFile,
      `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
`,
    );

    ({ context, functionRegistry } = createContext({
      configuration: {
        workspace: { name: 'firestore-query-records-test' },
        google: {
          project: PROJECT_ID,
          localProject: PROJECT_ID,
          firestore: {
            emulator: {
              containerName: FIRESTORE_CONTAINER_NAME,
              port: FIRESTORE_HOST_PORT,
            },
          },
        },
      },
      functions: [
        EmulatorStartForFirestore,
        EmulatorStopForFirestore,
        DatabaseQueryRecordsForFirestore,
      ],
    }));
    registerMockFunction(
      functionRegistry,
      GoogleFirestoreMergeRules,
      async () => ({ securityRuleFile: rulesFile, configuration: {} }),
    );

    const { configuration } = await context.call(EmulatorStart, {
      name: 'google.firestore',
    });
    process.env = { ...initialEnv, ...configuration };

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
    await context.call(EmulatorStop, { name: 'google.firestore' });
    await rm(rulesDir, { recursive: true, force: true });
    process.env = initialEnv;
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

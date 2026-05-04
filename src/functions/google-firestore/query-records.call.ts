import type { WorkspaceContext } from '@causa/workspace';
import { deleteApp, initializeApp } from 'firebase-admin/app';
import {
  DocumentReference,
  GeoPoint,
  getFirestore,
  Timestamp,
} from 'firebase-admin/firestore';
import { randomUUID } from 'node:crypto';
import type { GoogleConfiguration } from '../../configurations/index.js';
import type { DatabaseQueryRecordsForFirestore } from './query-records.js';

export default async function call(
  this: DatabaseQueryRecordsForFirestore,
  context: WorkspaceContext,
): Promise<any[]> {
  if (!this.query) {
    throw new Error(
      `The 'query' input is required for the 'google.firestore' engine.`,
    );
  }

  const googleConf = context.asConfiguration<GoogleConfiguration>();
  const projectId = googleConf.getOrThrow('google.project');
  const database = this.database ?? '(default)';

  context.logger.debug(
    `🗃️ Fetching Firestore document '${this.query}' from database '${database}' in project '${projectId}'.`,
  );

  const app = initializeApp({ projectId }, randomUUID());
  try {
    const firestore = getFirestore(app, database);
    const snapshot = await firestore.doc(this.query).get();
    return snapshot.exists ? [toJson(snapshot.data())] : [];
  } finally {
    await deleteApp(app);
  }
}

/**
 * Recursively converts Firestore-specific types to JSON-friendly equivalents:
 * - {@link Timestamp} → {@link Date}
 * - {@link GeoPoint} → `{ latitude, longitude }`
 * - {@link DocumentReference} → its `path`
 *
 * Other values (including `Buffer`) are returned as-is.
 */
function toJson(value: any): any {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (value instanceof Timestamp) {
    return value.toDate();
  }
  if (value instanceof GeoPoint) {
    return { latitude: value.latitude, longitude: value.longitude };
  }
  if (value instanceof DocumentReference) {
    return value.path;
  }
  if (Buffer.isBuffer(value)) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(toJson);
  }
  return Object.fromEntries(
    Object.entries(value).map(([k, v]) => [k, toJson(v)]),
  );
}

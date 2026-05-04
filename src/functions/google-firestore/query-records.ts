import { callDeferred, WorkspaceContext } from '@causa/workspace';
import { DatabaseQueryRecords } from '@causa/workspace-core';

/**
 * The engine identifier handled by this implementation.
 */
export const FIRESTORE_ENGINE = 'google.firestore';

/**
 * Implements {@link DatabaseQueryRecords} for Firestore.
 *
 * The `database` input is optional and defaults to the default Firestore database. The `query` input is the path to a
 * single document (e.g. `users/abc`).
 *
 * Returns an array containing a single document's data, or an empty array if the document does not exist.
 */
export class DatabaseQueryRecordsForFirestore extends DatabaseQueryRecords {
  async _call(context: WorkspaceContext): Promise<any[]> {
    return await callDeferred(this, context, import.meta.url);
  }

  _supports(): boolean {
    return this.engine === FIRESTORE_ENGINE;
  }
}

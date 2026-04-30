import { callDeferred, WorkspaceContext } from '@causa/workspace';
import { DatabaseQueryRecords } from '@causa/workspace-core';

/**
 * The engine identifier handled by this implementation.
 */
export const SPANNER_ENGINE = 'google.spanner';

/**
 * The maximum number of rows that will be returned by a single query.
 * Acts as a safety mechanism to avoid loading huge result sets in memory.
 */
export const SPANNER_QUERY_RECORDS_LIMIT = 100_000;

/**
 * Implements {@link DatabaseQueryRecords} for Spanner databases.
 *
 * The Spanner instance and GCP project are read from the workspace configuration. The `database` input is the name of
 * the database within the instance, and `query` is a regular SQL statement.
 *
 * Results are streamed and capped to {@link SPANNER_QUERY_RECORDS_LIMIT} rows.
 */
export class DatabaseQueryRecordsForSpanner extends DatabaseQueryRecords {
  async _call(context: WorkspaceContext): Promise<any[]> {
    return await callDeferred(this, context, import.meta.url);
  }

  _supports(): boolean {
    return this.engine === SPANNER_ENGINE;
  }
}

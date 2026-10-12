import { callDeferred } from '@causa/workspace';
import { DatabaseCountRecords, type RecordCounts } from '@causa/workspace-core';
import { SPANNER_ENGINE } from './query-records.js';

/**
 * Implements {@link DatabaseCountRecords} for Spanner databases.
 *
 * The table is the one in the schema's `google.spanner` binding, in the database whose DDL creates it. When several
 * databases create a table with that name, the one in the domain of the schema is chosen. The Spanner instance and GCP
 * project are read from the workspace configuration.
 *
 * Properties are read from the column named by their `googleSpannerColumn` extension, or from the column with the same
 * name. Nested properties are read from JSON columns.
 */
export class DatabaseCountRecordsForSpanner extends DatabaseCountRecords {
  async _call(): Promise<RecordCounts> {
    return await callDeferred(this, import.meta.url);
  }

  _supports(): boolean {
    return this.engine === SPANNER_ENGINE;
  }
}

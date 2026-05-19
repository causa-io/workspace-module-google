import {
  ModelSchemaExtractDatabase,
  type SchemaDatabase,
} from '@causa/workspace-core';

/**
 * The name of the Causa extension marking an object schema as a Google Spanner table.
 */
const GOOGLE_SPANNER_TABLE_EXTENSION = 'googleSpannerTable';

/**
 * Implements {@link ModelSchemaExtractDatabase} for Google Spanner.
 * The schema is selected when it carries a `googleSpannerTable` Causa extension with a `primaryKey` array. The table
 * name defaults to the schema's name when not explicitly set, and the primary keys are read from the extension's
 * `primaryKey` array.
 */
export class ModelSchemaExtractDatabaseForGoogleSpanner extends ModelSchemaExtractDatabase {
  _call(): SchemaDatabase {
    const extension = this.schema.extensions[
      GOOGLE_SPANNER_TABLE_EXTENSION
    ] as { primaryKey: unknown[]; name?: unknown };

    const primaryKeys = extension.primaryKey.filter(
      (k) => typeof k === 'string',
    );
    const table =
      typeof extension.name === 'string' ? extension.name : this.schema.name;

    return { engine: 'google.spanner', table, primaryKeys };
  }

  _supports(): boolean {
    const extension = this.schema.extensions[GOOGLE_SPANNER_TABLE_EXTENSION];
    return (
      typeof extension === 'object' &&
      extension !== null &&
      Array.isArray((extension as { primaryKey?: unknown }).primaryKey)
    );
  }
}

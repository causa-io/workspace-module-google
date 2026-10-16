import {
  ModelSchemaExtractDatabase,
  type SchemaDatabase,
} from '@causa/workspace-core';

/**
 * The name of the Causa extension marking an object schema as a Google Spanner table.
 */
const GOOGLE_SPANNER_TABLE_EXTENSION = 'googleSpannerTable';

/**
 * The name of the Causa extension setting the Spanner column of a property.
 */
const GOOGLE_SPANNER_COLUMN_EXTENSION = 'googleSpannerColumn';

/**
 * Implements {@link ModelSchemaExtractDatabase} for Google Spanner.
 * The schema is selected when it carries a `googleSpannerTable` Causa extension with a `primaryKey` array. The table
 * name defaults to the schema's name when not explicitly set, and the primary keys are read from the extension's
 * `primaryKey` array.
 * Like the runtime, the first segment of each primary key path is a column name, which is converted to the name of the
 * property stored in that column (`googleSpannerColumn`). A column matching no property is kept as is.
 */
export class ModelSchemaExtractDatabaseForGoogleSpanner extends ModelSchemaExtractDatabase {
  _call(): SchemaDatabase {
    const extension = this.schema.extensions[
      GOOGLE_SPANNER_TABLE_EXTENSION
    ] as { primaryKey: unknown[]; name?: unknown };

    const propertiesByColumn = new Map(
      this.schema.properties.map(({ name, extensions }) => {
        const column = extensions[GOOGLE_SPANNER_COLUMN_EXTENSION] as
          { name?: unknown } | undefined;
        return [typeof column?.name === 'string' ? column.name : name, name];
      }),
    );
    const primaryKeys = extension.primaryKey
      .filter((k) => typeof k === 'string')
      .map((key) => {
        const [column, ...nested] = key.split('.');
        const property = propertiesByColumn.get(column) ?? column;
        return [property, ...nested].join('.');
      });
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

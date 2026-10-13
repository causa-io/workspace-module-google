import type {
  ObjectSchema,
  RecordCondition,
  RecordCounts,
} from '@causa/workspace-core';
import { splitSchemaPath } from '@causa/workspace-core/jsonschema';
import type { WorkspaceContext } from '@causa/workspace';
import { Spanner, type Database } from '@google-cloud/spanner';
import type { GoogleConfiguration } from '../../configurations/index.js';
import type { DatabaseCountRecordsForSpanner } from './count-records.js';
import { GoogleSpannerListDatabases } from './list-databases.js';
import { SPANNER_ENGINE } from './query-records.js';
import { resolveSpannerTable } from './resolve-table.js';

/**
 * Finds the database whose DDL creates a table, using {@link resolveSpannerTable}.
 *
 * @param context The {@link WorkspaceContext}.
 * @param table The name of the table.
 * @param schema The schema persisted in the table.
 * @returns The ID of the database.
 */
async function findDatabase(
  context: WorkspaceContext,
  table: string,
  schema: ObjectSchema,
): Promise<string> {
  const [databases, domainPaths] = await Promise.all([
    context.call(GoogleSpannerListDatabases, {}),
    context.listDomainPaths(),
  ]);
  const { file } = splitSchemaPath(schema.path);
  const resolution = resolveSpannerTable(databases, table, file, domainPaths);
  switch (resolution.kind) {
    case 'resolved':
      return resolution.database.id;
    case 'missing':
      throw new Error(`No Spanner DDL creates the table '${table}'.`);
    case 'ambiguous':
      throw new Error(
        `The table '${table}' is created in several Spanner databases: ${resolution.candidates
          .map(({ id }) => `'${id}'`)
          .join(', ')}.`,
      );
  }
}

/**
 * Returns the SQL expression reading the value at a path in the records of a schema.
 *
 * @param schema The schema persisted in the table.
 * @param path The names of the properties leading to the value.
 * @returns The SQL expression, and the JSON value when it reads a nested value from a JSON column.
 */
function valueExpression(
  schema: ObjectSchema,
  path: string[],
): { expression: string; json?: string } {
  const [name, ...nested] = path;
  const property = schema.properties.find((p) => p.name === name);
  if (!property) {
    throw new Error(`'${name}' is not a property of '${schema.name}'.`);
  }

  const columnExtension = property.extensions.googleSpannerColumn as
    { name?: unknown } | undefined;
  const column =
    typeof columnExtension?.name === 'string' ? columnExtension.name : name;
  const expression = `\`${column}\``;
  if (nested.length === 0) {
    return { expression };
  }

  const json = `${expression}${nested.map((key) => `[${JSON.stringify(key)}]`).join('')}`;
  return { expression: `JSON_VALUE(${json})`, json };
}

/**
 * Builds the SQL query counting the rows of a table, and those matching each filter.
 *
 * @param table The name of the table.
 * @param schema The schema persisted in the table.
 * @param filters The conditions of each filter, in order.
 * @returns The SQL query and its parameters. The counts are returned in the `total` column, and the `f<index>` column
 *   for each filter.
 */
export function buildCountQuery(
  table: string,
  schema: ObjectSchema,
  filters: RecordCondition[][],
): { sql: string; params: Record<string, string | number | boolean> } {
  const params: Record<string, string | number | boolean> = {};
  const condition = (c: RecordCondition): string => {
    const { expression, json } = valueExpression(schema, c.path);
    if (c.operator !== 'equals') {
      return `${expression} ${c.operator === 'isNull' ? 'IS NULL' : 'IS NOT NULL'}`;
    }

    const param = `p${Object.keys(params).length}`;
    if (!json) {
      params[param] = c.value;
      return `${expression} = @${param}`;
    }

    // Nested values are read as strings from JSON columns, and only match values of the same JSON type.
    const type = `JSON_TYPE(${json}) = '${typeof c.value}'`;
    if (typeof c.value === 'number') {
      params[param] = c.value;
      return `${type} AND SAFE_CAST(${expression} AS FLOAT64) = @${param}`;
    }

    params[param] = String(c.value);
    return `${type} AND ${expression} = @${param}`;
  };

  const counts = filters.map(
    (conditions, index) =>
      `COUNTIF(${conditions.map(condition).join(' AND ') || 'TRUE'}) AS f${index}`,
  );
  const sql = `SELECT ${['COUNT(*) AS total', ...counts].join(', ')} FROM \`${table}\``;
  return { sql, params };
}

export default async function call(
  this: DatabaseCountRecordsForSpanner,
): Promise<RecordCounts> {
  const table = this.schema.databases.find(
    (d) => d.engine === SPANNER_ENGINE,
  )?.table;
  if (!table) {
    throw new Error(
      `The schema '${this.schema.name}' is not persisted in a Spanner table.`,
    );
  }

  const names = Object.keys(this.filters);
  const { sql, params } = buildCountQuery(
    table,
    this.schema,
    names.map((n) => this.filters[n]),
  );
  const databaseId = await findDatabase(this._context, table, this.schema);

  const googleConf = this._context.asConfiguration<GoogleConfiguration>();
  const projectId = googleConf.getOrThrow('google.project');
  const instanceName = googleConf.getOrThrow('google.spanner.instance.name');
  this._context.logger.debug(
    `🗃️ Counting rows in Spanner database '${databaseId}' in instance '${instanceName}' (project '${projectId}'):\n${sql}`,
  );

  const spanner = new Spanner({ projectId });
  let database: Database | undefined;
  try {
    database = spanner.instance(instanceName).database(databaseId);
    const [rows] = await database.run({
      sql,
      params,
      json: true,
      jsonOptions: { wrapNumbers: false },
    });
    const row = rows[0] as Record<string, number>;

    return {
      total: Number(row.total),
      counts: Object.fromEntries(
        names.map((name, index) => [name, Number(row[`f${index}`])]),
      ),
    };
  } finally {
    await database?.close();
    spanner.close();
  }
}

import type { WorkspaceContext } from '@causa/workspace';
import {
  type Database,
  Numeric,
  PGNumeric,
  Spanner,
  SpannerDate,
} from '@google-cloud/spanner';
import type { GoogleConfiguration } from '../../configurations/index.js';
import {
  type DatabaseQueryRecordsForSpanner,
  SPANNER_QUERY_RECORDS_LIMIT,
} from './query-records.js';

export default async function call(
  this: DatabaseQueryRecordsForSpanner,
  context: WorkspaceContext,
): Promise<any[]> {
  if (!this.database) {
    throw new Error(
      `The 'database' input is required for the 'google.spanner' engine.`,
    );
  }

  if (!this.query) {
    throw new Error(
      `The 'query' input is required for the 'google.spanner' engine.`,
    );
  }

  const googleConf = context.asConfiguration<GoogleConfiguration>();
  const projectId = googleConf.getOrThrow('google.project');
  const instanceName = googleConf.getOrThrow('google.spanner.instance.name');

  context.logger.debug(
    `🗃️ Querying Spanner database '${this.database}' in instance '${instanceName}' (project '${projectId}').`,
  );

  const spanner = new Spanner({ projectId });
  let database: Database | undefined;
  try {
    database = spanner.instance(instanceName).database(this.database);
    const rows: any[] = [];
    const stream = database.runStream({
      sql: this.query,
      json: true,
      jsonOptions: { wrapNumbers: false, wrapStructs: false },
    });

    for await (const row of stream) {
      if (rows.length >= SPANNER_QUERY_RECORDS_LIMIT) {
        context.logger.warn(
          `⚠️ Spanner query exceeded the hard limit of ${SPANNER_QUERY_RECORDS_LIMIT} rows. Results were truncated.`,
        );
        break;
      }

      rows.push(toJson(row));
    }

    return rows;
  } finally {
    await database?.close();
    spanner.close();
  }
}

/**
 * Recursively converts Spanner-specific types in a row to JSON-friendly equivalents:
 * - {@link Numeric} / {@link PGNumeric} (NUMERIC / PG_NUMERIC) → their string value.
 * - {@link SpannerDate} (DATE) → `YYYY-MM-DD` string.
 * - Other `Date` subclasses such as `PreciseDate` (TIMESTAMP) → plain {@link Date} instances.
 *
 * `Buffer` values are returned as-is.
 */
function toJson(value: any): any {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (value instanceof Numeric || value instanceof PGNumeric) {
    return value.value;
  }
  if (value instanceof SpannerDate) {
    return value.toJSON();
  }
  if (value instanceof Date) {
    return new Date(value.getTime());
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

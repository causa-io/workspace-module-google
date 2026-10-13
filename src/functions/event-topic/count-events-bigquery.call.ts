import type { RecordCondition, RecordCounts } from '@causa/workspace-core';
import type { GoogleConfiguration } from '../../configurations/index.js';
import { BigQueryService } from '../../services/index.js';
import { rawEventsTableName } from '../google-pubsub/index.js';
import type { EventTopicCountEventsForBigQuery } from './count-events-bigquery.js';

/**
 * Returns the function converting a JSON value to the type of the given value, without failing for other types.
 *
 * @param value The value to which the JSON value is compared.
 * @returns The name of the BigQuery conversion function.
 */
function laxConversion(value: string | number | boolean): string {
  switch (typeof value) {
    case 'string':
      return 'LAX_STRING';
    case 'number':
      return 'LAX_FLOAT64';
    case 'boolean':
      return 'LAX_BOOL';
  }
}

/**
 * Builds the condition on the event payload, stored in the `data` JSON column, for a {@link RecordCondition}.
 *
 * @param condition The condition.
 * @param addParam A function adding a parameter to the query, and returning its name.
 * @returns The SQL condition.
 */
function sqlCondition(
  condition: RecordCondition,
  addParam: (value: unknown) => string,
): string {
  const value = `data${condition.path.map((key) => `[${JSON.stringify(key)}]`).join('')}`;
  switch (condition.operator) {
    case 'isNull':
      return `(${value} IS NULL OR JSON_TYPE(${value}) = 'null')`;
    case 'isNotNull':
      return `JSON_TYPE(${value}) != 'null'`;
    case 'equals':
      // The type is checked as lax conversions also convert values of other types, e.g. the string `"false"` to `FALSE`.
      return `JSON_TYPE(${value}) = '${typeof condition.value}' AND ${laxConversion(condition.value)}(${value}) = @${addParam(condition.value)}`;
  }
}

export default async function call(
  this: EventTopicCountEventsForBigQuery,
): Promise<RecordCounts> {
  const googleConf = this._context.asConfiguration<GoogleConfiguration>();
  const projectId = googleConf.getOrThrow('google.project');
  const rawEventsDatasetId = googleConf.getOrThrow(
    'google.pubSub.bigQueryStorage.rawEventsDatasetId',
  );
  const tableId = `${projectId}.${rawEventsDatasetId}.${rawEventsTableName(this.topic)}`;

  const names = Object.keys(this.filters);
  const params: Record<string, unknown> = {
    from: this.from.toISOString(),
    to: this.to.toISOString(),
  };
  let paramCount = 0;
  const addParam = (value: unknown) => {
    const param = `p${paramCount++}`;
    params[param] = value;
    return param;
  };
  const counts = names.map((name, index) => {
    const conditions = this.filters[name].map((c) => sqlCondition(c, addParam));
    return `COUNTIF(${conditions.join(' AND ') || 'TRUE'}) AS f${index}`;
  });

  // Events written several times to the table by the BigQuery subscription are only counted once.
  const query = `
    WITH events AS (
      SELECT data
      FROM \`${tableId}\`
      WHERE publish_time >= @from AND publish_time < @to
      QUALIFY ROW_NUMBER() OVER (PARTITION BY message_id ORDER BY publish_time) = 1
    )
    SELECT ${['COUNT(*) AS total', ...counts].join(', ')}
    FROM events`;

  this._context.logger.debug(`Counting events in BigQuery:\n${query}`);

  const bigQuery = this._context.service(BigQueryService).bigQuery;
  const [[row]] = await bigQuery.query({ query, params });

  return {
    total: Number(row.total),
    counts: Object.fromEntries(
      names.map((name, index) => [name, Number(row[`f${index}`])]),
    ),
  };
}

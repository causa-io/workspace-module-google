import type { WorkspaceContext } from '@causa/workspace';
import type { QueriedEvent } from '@causa/workspace-core';
import type { GoogleConfiguration } from '../../configurations/index.js';
import { BigQueryService } from '../../services/index.js';
import type { EventTopicQueryEventsForBigQuery } from './query-events-bigquery.js';

/**
 * The default duration applied to `from` when it is not set, in milliseconds.
 */
const DEFAULT_FROM_OFFSET = 60 * 60 * 1000;

/**
 * The default value for `limit` when it is not set.
 */
const DEFAULT_LIMIT = 1000;

export default async function call(
  this: EventTopicQueryEventsForBigQuery,
  context: WorkspaceContext,
): Promise<QueriedEvent[]> {
  const from = this.from ?? new Date(Date.now() - DEFAULT_FROM_OFFSET);
  const limit = this.limit ?? DEFAULT_LIMIT;

  const googleConf = context.asConfiguration<GoogleConfiguration>();
  const projectId = googleConf.getOrThrow('google.project');
  const rawEventsDatasetId = googleConf.getOrThrow(
    'google.pubSub.bigQueryStorage.rawEventsDatasetId',
  );
  const tableName = this.topic.replace(/[-\.]/g, '_');
  const tableId = `${projectId}.${rawEventsDatasetId}.${tableName}`;

  const conditions = [`publish_time >= @from`];
  const params: Record<string, any> = { from: from.toISOString() };
  if (this.to) {
    conditions.push(`publish_time < @to`);
    params.to = this.to.toISOString();
  }
  if (this.filter) {
    conditions.push(`(${this.filter})`);
  }

  const query = `
    SELECT publish_time, data, attributes
    FROM \`${tableId}\`
    WHERE ${conditions.join(' AND ')}
    ORDER BY publish_time ASC
    LIMIT ${limit}`;

  context.logger.debug(`Querying BigQuery for events:\n${query}`);

  const bigQuery = context.service(BigQueryService).bigQuery;
  const [rows] = await bigQuery.query({ query, params });

  return rows.map((row: any) => ({
    timestamp: new Date(row.publish_time.value),
    attributes: row.attributes ? JSON.parse(row.attributes) : {},
    data: JSON.parse(row.data.toString('utf8')),
  }));
}

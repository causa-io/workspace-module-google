import type { WorkspaceContext } from '@causa/workspace';
import type { BackfillEvent } from '@causa/workspace-core';
import type { GoogleConfiguration } from '../../configurations/index.js';
import { BigQueryService } from '../../services/index.js';
import {
  BIGQUERY_SOURCE_REGEX,
  type EventTopicCreateBackfillSourceForBigQuery,
} from './create-backfill-source-bigquery.js';

/**
 * Resolves the full BigQuery table ID from the function arguments and configuration.
 *
 * @param self The function instance.
 * @param context The {@link WorkspaceContext}.
 * @returns The full BigQuery table ID, in the format `projectId.datasetId.tableId`.
 */
function resolveTableId(
  self: EventTopicCreateBackfillSourceForBigQuery,
  context: WorkspaceContext,
): string {
  if (self.source) {
    const match = self.source.match(BIGQUERY_SOURCE_REGEX);
    if (!match?.groups?.tableId) {
      throw new Error(
        `The source '${self.source}' is not a valid BigQuery source.`,
      );
    }

    return match.groups.tableId;
  }

  const googleConf = context.asConfiguration<GoogleConfiguration>();
  const projectId = googleConf.getOrThrow('google.project');
  const rawEventsDatasetId = googleConf.getOrThrow(
    'google.pubSub.bigQueryStorage.rawEventsDatasetId',
  );
  const tableName = self.eventTopic.replace(/[-\.]/g, '_');
  return `${projectId}.${rawEventsDatasetId}.${tableName}`;
}

export default async function call(
  this: EventTopicCreateBackfillSourceForBigQuery,
  context: WorkspaceContext,
): Promise<AsyncIterable<BackfillEvent>> {
  const tableId = resolveTableId(this, context);

  let query = `
    SELECT
      data,
      attributes,
    FROM
      \`${tableId}\``;
  if (this.filter) {
    query += `
    WHERE
      (${this.filter})`;
  }

  context.logger.debug(`Creating BigQuery job from query '${query}'.`);
  const bigQuery = context.service(BigQueryService).bigQuery;
  const [job] = await bigQuery.createQueryJob(query);

  return (async function* () {
    for await (const row of job.getQueryResultsStream()) {
      yield {
        data: Buffer.from(row.data),
        attributes: JSON.parse(row.attributes),
      };
    }
  })();
}

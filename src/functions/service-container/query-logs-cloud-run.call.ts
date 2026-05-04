import type { WorkspaceContext } from '@causa/workspace';
import type { QueriedLogEntry } from '@causa/workspace-core';
import { LoggingService } from '../../services/index.js';
import type { ServiceContainerQueryLogsForCloudRun } from './query-logs-cloud-run.js';

/**
 * The default duration applied to `from` when it is not set, in milliseconds.
 */
const DEFAULT_FROM_OFFSET = 60 * 60 * 1000;

/**
 * The default value for `limit` when it is not set.
 */
const DEFAULT_LIMIT = 1000;

export default async function call(
  this: ServiceContainerQueryLogsForCloudRun,
  context: WorkspaceContext,
): Promise<QueriedLogEntry[]> {
  const from = this.from ?? new Date(Date.now() - DEFAULT_FROM_OFFSET);
  const limit = this.limit ?? DEFAULT_LIMIT;

  const filterParts = [
    `resource.type="cloud_run_revision"`,
    `resource.labels.service_name=~"${this.service}"`,
    `timestamp>="${from.toISOString()}"`,
  ];
  if (this.to) {
    filterParts.push(`timestamp<"${this.to.toISOString()}"`);
  }
  if (this.filter) {
    filterParts.push(this.filter);
  }
  const filter = filterParts.join('\n');

  const loggingService = context.service(LoggingService);
  context.logger.debug(
    `Querying Cloud Logging for service '${this.service}' in project '${loggingService.projectId}' with filter:\n${filter}`,
  );

  const [pageEntries] = await loggingService.logging.getEntries({
    filter,
    orderBy: 'timestamp asc',
    maxResults: limit,
  });

  return pageEntries.map((entry) => ({
    timestamp: entry.metadata.timestamp as Date,
    message: entry.toStructuredJSON(),
  }));
}

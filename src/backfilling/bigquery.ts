import { WorkspaceContext } from '@causa/workspace';
import type {
  BackfillEvent,
  BackfillEventsSource,
} from '@causa/workspace-core';
import { BigQuery, Job, type Query } from '@google-cloud/bigquery';
import type { Logger } from 'pino';
import { BigQueryService } from '../services/index.js';

/**
 * The number of rows (events) in a single batch.
 */
const BIGQUERY_MAX_RESULTS = 10000;

/**
 * An events source that reads events from a BigQuery table.
 */
export class BigQueryEventsSource implements BackfillEventsSource {
  /**
   * The BigQuery client.
   */
  private readonly bigQuery: BigQuery;

  /**
   * The job from which the events are read.
   */
  private job: Job | null = null;

  /**
   * The request for the next page of results.
   * If this is `null` after initializing the job, there are no more results.
   */
  private nextPageRequest: Query | null = null;

  /**
   * The logger.
   */
  private readonly logger: Logger;

  /**
   * Creates a new events source that reads events from a BigQuery table.
   *
   * @param context The {@link WorkspaceContext}.
   * @param tableId The ID of the BigQuery table from which the events should be read.
   * @param filter A SQL boolean expression that filters the events from the table.
   */
  constructor(
    context: WorkspaceContext,
    readonly tableId: string,
    readonly filter?: string,
  ) {
    this.bigQuery = context.service(BigQueryService).bigQuery;
    this.logger = context.logger;
  }

  /**
   * Creates a BigQuery job that reads the events from the table.
   * The `data` and `attributes` columns are read to get the corresponding event properties.
   * If a filter was specified, it is applied to the query as a where clause.
   *
   * @returns The BigQuery job that reads the events from the table.
   */
  private async createJob(): Promise<Job> {
    let query = `
      SELECT
        data,
        attributes,
      FROM
        \`${this.tableId}\``;
    if (this.filter) {
      query += `
      WHERE
        (${this.filter})`;
    }

    this.logger.debug(`Creating BigQuery job from query '${query}'.`);
    const [job] = await this.bigQuery.createQueryJob(query);
    return job;
  }

  async getBatch(): Promise<BackfillEvent[] | null> {
    if (!this.job) {
      this.job = await this.createJob();
    } else if (!this.nextPageRequest) {
      return null;
    }

    const [rows, nextPageRequest] = await this.job.getQueryResults(
      this.nextPageRequest ?? {
        autoPaginate: false,
        maxResults: BIGQUERY_MAX_RESULTS,
      },
    );
    this.nextPageRequest = nextPageRequest ?? null;

    return rows.map((row) => ({
      data: Buffer.from(row.data),
      attributes: JSON.parse(row.attributes),
    }));
  }

  async dispose(): Promise<void> {}

  /**
   * Tries to create a new {@link BigQueryEventsSource} from the given source string.
   *
   * @param context The {@link WorkspaceContext}.
   * @param source The string representing the source, in the format `bq://<projectId>.<datasetId>.<tableId>`.
   * @param filter A SQL boolean expression that filters the events from the table.
   * @returns A new {@link BigQueryEventsSource} if the source string is valid, otherwise `null`.
   */
  static async fromSourceAndFilter(
    context: WorkspaceContext,
    source: string,
    filter?: string,
  ): Promise<BigQueryEventsSource | null> {
    const match = source.match(/^bq:\/\/(?<tableId>.+)$/);
    if (!match?.groups?.tableId) {
      return null;
    }

    const tableId = match.groups.tableId;
    return new BigQueryEventsSource(context, tableId, filter);
  }
}

import { WorkspaceContext } from '@causa/workspace';
import { BigQuery } from '@google-cloud/bigquery';
import { GoogleConfiguration } from '../configurations/index.js';

/**
 * A service that provides access to BigQuery.
 */
export class BigQueryService {
  /**
   * The BigQuery client configured with the GCP project ID.
   */
  readonly bigQuery: BigQuery;

  /**
   * The GCP project ID.
   */
  readonly projectId: string;

  constructor(context: WorkspaceContext) {
    const googleConf = context.asConfiguration<GoogleConfiguration>();
    this.projectId = googleConf.getOrThrow('google.project');
    this.bigQuery = new BigQuery({ projectId: this.projectId });
  }
}

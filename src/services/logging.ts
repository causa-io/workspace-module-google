import { WorkspaceContext } from '@causa/workspace';
import { Logging } from '@google-cloud/logging';
import type { GoogleConfiguration } from '../configurations/index.js';

/**
 * A service that provides access to Cloud Logging.
 */
export class LoggingService {
  /**
   * The Cloud Logging client configured with the GCP project ID.
   */
  readonly logging: Logging;

  /**
   * The GCP project ID.
   */
  readonly projectId: string;

  constructor(context: WorkspaceContext) {
    const googleConf = context.asConfiguration<GoogleConfiguration>();
    this.projectId = googleConf.getOrThrow('google.project');
    this.logging = new Logging({ projectId: this.projectId });
  }
}

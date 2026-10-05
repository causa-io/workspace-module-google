import type { GraphEnvironmentFetcher } from '@causa/workspace-core';
import { googleCloudRun } from './cloud-run.js';
import { googleConsoleLinks } from './console-links.js';
import { googleErrorReporting } from './error-reporting.js';

/**
 * The fetchers of environment data and metrics for Google Cloud.
 */
export const GOOGLE_GRAPH_ENVIRONMENT_FETCHERS: GraphEnvironmentFetcher[] = [
  googleCloudRun,
  googleConsoleLinks,
  googleErrorReporting,
];

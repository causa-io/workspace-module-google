import type { GraphEnvironmentFetcher } from '@causa/workspace-core';
import { googleCloudMonitoringAlerts } from './cloud-monitoring-alerts.js';
import { googleCloudMonitoring } from './cloud-monitoring.js';
import { googleCloudRun } from './cloud-run.js';
import { googleCloudScheduler } from './cloud-scheduler.js';
import { googleConsoleLinks } from './console-links.js';
import { googleErrorReporting } from './error-reporting.js';

/**
 * The fetchers of environment data and metrics for Google Cloud.
 */
export const GOOGLE_GRAPH_ENVIRONMENT_FETCHERS: GraphEnvironmentFetcher[] = [
  googleCloudMonitoring,
  googleCloudMonitoringAlerts,
  googleCloudRun,
  googleCloudScheduler,
  googleConsoleLinks,
  googleErrorReporting,
];

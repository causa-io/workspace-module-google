import type { GraphEnvironmentFetcher } from '@causa/workspace-core';
import { MONITORING_METRICS } from '../monitoring-catalog.js';
import { queryPointInTimeMetrics } from '../monitoring-query.js';

/**
 * Reads the metrics of nodes from Cloud Monitoring, over the evaluation window.
 */
export const googleCloudMonitoring: GraphEnvironmentFetcher = {
  name: 'googleCloudMonitoring',
  description:
    'The metrics of Cloud Run services, API routers, Pub/Sub topics and subscriptions, Cloud Tasks queues, and Spanner, Firestore, and BigQuery databases, read from Cloud Monitoring.',
  fetch: async (environment) => {
    const { nodes, bucketLayouts, warnings } = await queryPointInTimeMetrics(
      environment,
      MONITORING_METRICS,
    );
    return { nodes, bucketLayouts, warnings };
  },
};

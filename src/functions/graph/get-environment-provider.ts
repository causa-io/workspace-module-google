import {
  GraphGetEnvironmentProvider,
  type GraphEnvironmentProvider,
} from '@causa/workspace-core';
import {
  CLOUD_TASKS_QUEUE_RESOLVER,
  GOOGLE_GRAPH_ENVIRONMENT_FETCHERS,
  GOOGLE_GRAPH_METRIC_DEFINITIONS,
} from '../../graph/index.js';

/**
 * Implements {@link GraphGetEnvironmentProvider} for Google Cloud.
 * The fetchers read metrics and alerts from Cloud Monitoring, open error groups from Error Reporting as alerts, the
 * state of Cloud Run services and Cloud Scheduler jobs, and build links to the Google Cloud console. Cloud Tasks
 * queues, only known by a prefix of their name, are resolved by listing them.
 */
export class GraphGetEnvironmentProviderForGoogle extends GraphGetEnvironmentProvider {
  _call(): GraphEnvironmentProvider {
    return {
      metrics: GOOGLE_GRAPH_METRIC_DEFINITIONS,
      prefixResolvers: [CLOUD_TASKS_QUEUE_RESOLVER],
      fetchers: GOOGLE_GRAPH_ENVIRONMENT_FETCHERS,
    };
  }

  _supports(): boolean {
    return true;
  }
}

import { callDeferred, WorkspaceContext } from '@causa/workspace';
import {
  type QueriedLogEntry,
  ServiceContainerQueryLogs,
  type ServiceContainerConfiguration,
} from '@causa/workspace-core';

/**
 * Implements {@link ServiceContainerQueryLogs} for services deployed on Cloud Run.
 *
 * Queries the Cloud Logging API for entries emitted by `cloud_run_revision` resources whose `service_name` label
 * matches the input `service`. The optional `from` / `to` time range, `filter`, and `limit` are forwarded to the API.
 */
export class ServiceContainerQueryLogsForCloudRun extends ServiceContainerQueryLogs {
  async _call(context: WorkspaceContext): Promise<QueriedLogEntry[]> {
    return await callDeferred(this, context, import.meta.url);
  }

  _supports(context: WorkspaceContext): boolean {
    return (
      context
        .asConfiguration<ServiceContainerConfiguration>()
        .get('serviceContainer.platform') === 'google.cloudRun'
    );
  }
}

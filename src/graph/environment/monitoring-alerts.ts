import type { WorkspaceContext } from '@causa/workspace';
import type { monitoring_v3 } from 'googleapis';
import {
  monitoringLabelName,
  type MonitoringLabel,
} from './monitoring-mappings.js';

/**
 * An alert, as returned by the Cloud Monitoring Alerts API.
 */
export type MonitoringAlert = monitoring_v3.Schema$Alert;

/**
 * The resource type of alerts whose condition aggregates away the monitored resource type, e.g. a PromQL query
 * aggregating a metric written against several resource types.
 */
const PROMETHEUS_TARGET = 'prometheus_target';

/**
 * The monitored resource of an alert.
 */
export type MonitoringAlertResource = {
  /**
   * The monitored resource type, e.g. `cloud_run_revision`.
   */
  readonly type: string;

  /**
   * The GCP project of the resource: the `project_id` label, or the project from which the alert was listed.
   */
  readonly project: string;

  /**
   * The labels of the alert, keyed by name. Resource labels take precedence over metric labels with the same name, as
   * alerts aggregating away the resource type only keep metric labels.
   */
  readonly labels: Readonly<Record<string, string>>;
};

/**
 * An alert open at a given time, along with its monitored resource.
 */
export type OpenMonitoringAlert = {
  /**
   * The alert, as returned by the Alerts API.
   */
  readonly alert: MonitoringAlert;

  /**
   * The GCP project from which the alert was listed.
   */
  readonly project: string;

  /**
   * The monitored resource of the alert. It is `undefined` when its type is unknown.
   */
  readonly resource?: MonitoringAlertResource;
};

/**
 * Returns the value of a label of the resource of an alert, read by its name regardless of its source, as alerts
 * aggregating away the resource type only keep metric labels.
 *
 * @param resource The resource of the alert.
 * @param label The label.
 * @returns The value of the label.
 */
export function alertLabelValue(
  resource: MonitoringAlertResource,
  label: MonitoringLabel,
): string | undefined {
  return resource.labels[monitoringLabelName(label)];
}

/**
 * Lists the alerts of a project that were open at a given time, along with their monitored resources.
 *
 * @param context The context, from which the `GoogleApisService` is obtained.
 * @param project The GCP project.
 * @param at The time at which the alerts were open.
 * @returns The alerts.
 */
export async function listOpenAlerts(
  context: WorkspaceContext,
  project: string,
  at: Date,
): Promise<OpenMonitoringAlert[]> {
  const { GoogleApisService } = await import('../../services/google-apis.js');
  const client = await context
    .service(GoogleApisService)
    .getClient('monitoring', 'v3', {});

  // The API only supports `>=` and `<=` comparisons, and timestamps without fractional seconds. Alerts that are still
  // open have no closing time.
  const time = at.toISOString().replace(/\.\d+Z$/, 'Z');
  const filter = `open_time <= "${time}" AND (state = "OPEN" OR close_time >= "${time}")`;
  const alerts: MonitoringAlert[] = [];
  let pageToken: string | undefined;
  do {
    const { data } = await client.projects.alerts.list({
      parent: `projects/${project}`,
      filter,
      pageSize: 1000,
      pageToken,
    });
    alerts.push(...(data.alerts ?? []));
    pageToken = data.nextPageToken ?? undefined;
  } while (pageToken);

  return alerts.map((alert) => {
    const labels: Record<string, string> = {
      ...alert.metric?.labels,
      ...alert.resource?.labels,
    };
    const resourceType = alert.resource?.type;
    // PromQL alerts have their resource type set to `prometheus_target`. In that case, the actual resource type is read
    // from the `monitored_resource` label, which the alert is expected to group by.
    const type =
      resourceType && resourceType !== PROMETHEUS_TARGET
        ? resourceType
        : labels.monitored_resource;
    if (!type) {
      return { alert, project };
    }

    return {
      alert,
      project,
      resource: { type, project: labels.project_id ?? project, labels },
    };
  });
}

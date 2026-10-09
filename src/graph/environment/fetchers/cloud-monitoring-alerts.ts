import {
  GraphAlertSeverity,
  type GraphAlert,
  type GraphEnvironmentFetcher,
  type GraphWarning,
} from '@causa/workspace-core';
import {
  alertLabelValue,
  listOpenAlerts,
  type MonitoringAlert,
  type MonitoringAlertResource,
} from '../monitoring-alerts.js';
import { MONITORING_RESOURCE_MAPPINGS } from '../monitoring-catalog.js';
import {
  findMonitoredNode,
  prepareMonitoringMapping,
  readMonitoringResourceKey,
} from '../monitoring-mappings.js';
import { googleResources } from '../resources.js';
import { consoleUrl } from './console-links.js';

/**
 * The severities of alerts, keyed by the severity of their policy.
 */
const SEVERITIES: Record<string, GraphAlertSeverity> = {
  CRITICAL: GraphAlertSeverity.Critical,
  ERROR: GraphAlertSeverity.Error,
  WARNING: GraphAlertSeverity.Warning,
};

/**
 * Converts an alert returned by the Alerts API to a {@link GraphAlert}.
 *
 * @param alert The alert.
 * @param project The GCP project from which the alert was listed.
 * @returns The alert.
 */
function toGraphAlert(alert: MonitoringAlert, project: string): GraphAlert {
  const severity = SEVERITIES[alert.policy?.severity ?? ''];
  const id = alert.name?.split('/').at(-1);
  return {
    title: alert.policy?.displayName as string,
    ...(severity ? { severity } : {}),
    openedAt: new Date(alert.openTime as string),
    ...(id
      ? { url: consoleUrl(['monitoring', 'alerting', 'alerts', id], project) }
      : {}),
  };
}

/**
 * Describes the resource of an alert in a warning.
 *
 * @param resource The resource of the alert.
 * @returns The description.
 */
function describeResource(resource: MonitoringAlertResource | undefined) {
  if (!resource) {
    return 'a resource of unknown type';
  }

  const labels = Object.entries(resource.labels)
    .filter(([name]) => name !== 'value' && name !== 'monitored_resource')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, value]) => `${name}=${value}`);
  return `the '${resource.type}' resource (${labels.join(', ')})`;
}

/**
 * Reads the alerts open at the end of the evaluation window from Cloud Monitoring, and attaches them to the nodes of
 * their resources.
 */
export const googleCloudMonitoringAlerts: GraphEnvironmentFetcher = {
  name: 'googleCloudMonitoringAlerts',
  description:
    "The `alerts` open at the end of the evaluation window, read from Cloud Monitoring in the projects of the graph's resources, and attached to the nodes of their resources. Alerts that cannot be attached to a node are added to the environment.",
  fetch: async (environment) => {
    const projects = [
      ...new Set(
        googleResources(environment).map(({ segments }) => segments.projects),
      ),
    ]
      .filter((p) => !!p)
      .sort();
    const warnings: GraphWarning[] = [];
    const listed = await Promise.all(
      projects.map(async (project) => {
        try {
          return await listOpenAlerts(
            environment.context,
            project,
            environment.at,
          );
        } catch (error: any) {
          warnings.push({
            message: `Failed to list the alerts in project '${project}': ${error.message ?? error}`,
          });
          return [];
        }
      }),
    );
    const alerts = listed.flat();
    if (alerts.length === 0) {
      return { warnings };
    }

    // Only the mappings that may apply to an alert are prepared, as preparing a mapping may require listing resources,
    // e.g. the backends of load balancers.
    const candidates = (
      await Promise.all(
        MONITORING_RESOURCE_MAPPINGS.filter((mapping) =>
          alerts.some(
            ({ resource }) =>
              resource?.type === mapping.monitoredResource &&
              readMonitoringResourceKey(mapping, resource.project, (label) =>
                alertLabelValue(resource, label),
              ),
          ),
        ).map((mapping) => prepareMonitoringMapping(environment, mapping)),
      )
    ).filter((m) => !!m);

    const nodes: Record<string, { alerts: GraphAlert[] }> = {};
    const unattached: GraphAlert[] = [];
    for (const { alert, project, resource } of alerts) {
      const graphAlert = toGraphAlert(alert, project);
      const { node } = resource
        ? findMonitoredNode(
            environment,
            candidates.filter(
              ({ mapping }) => mapping.monitoredResource === resource.type,
            ),
            resource.project,
            (label) => alertLabelValue(resource, label),
          )
        : {};
      if (node) {
        nodes[node.id] ??= { alerts: [] };
        nodes[node.id].alerts.push(graphAlert);
        continue;
      }

      unattached.push(graphAlert);
      warnings.push({
        message: `The alert of policy '${graphAlert.title}' on ${describeResource(resource)} could not be attached to a node, and is added to the environment.`,
      });
    }

    return {
      nodes,
      ...(unattached.length > 0 ? { alerts: unattached } : {}),
      warnings,
    };
  },
};

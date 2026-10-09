import {
  GraphAlertSeverity,
  type GraphAlert,
  type GraphEnvironmentFetcher,
  type GraphEnvironmentNodeOutput,
  type GraphWarning,
} from '@causa/workspace-core';
import type { clouderrorreporting_v1beta1 } from 'googleapis';
import { googleResources } from '../resources.js';
import { consoleUrl } from './console-links.js';

/**
 * The longest period over which Error Reporting can list groups. Periods always end now.
 */
const PERIOD = 'PERIOD_30_DAYS';

/**
 * The length of {@link PERIOD}, in milliseconds.
 */
const PERIOD_LENGTH = 30 * 24 * 3600 * 1000;

type ErrorGroupStats = clouderrorreporting_v1beta1.Schema$ErrorGroupStats;

/**
 * Converts the statistics of an open error group to an alert, titled with the first line of the message of the group's
 * representative error.
 *
 * @param stats The statistics of the group.
 * @param project The GCP project of the group.
 * @returns The alert, or `undefined` if the group has never been seen.
 */
function toGraphAlert(
  stats: ErrorGroupStats,
  project: string,
): GraphAlert | undefined {
  if (!stats.firstSeenTime) {
    return undefined;
  }

  const groupId = stats.group?.groupId ?? undefined;
  const message = stats.representative?.message?.split('\n', 1)[0].trim();
  return {
    title: message || `Error group ${groupId}`,
    severity: GraphAlertSeverity.Error,
    openedAt: new Date(stats.firstSeenTime),
    ...(groupId
      ? { url: consoleUrl(['errors', 'detail', groupId], project) }
      : {}),
  };
}

/**
 * Reads the open groups of errors of Cloud Run services from Error Reporting, as alerts.
 */
export const googleErrorReporting: GraphEnvironmentFetcher = {
  name: 'googleErrorReporting',
  description:
    'The `alerts` of Cloud Run services for their open Error Reporting groups, i.e. groups with occurrences during the last 30 days, first seen before the end of the evaluation window. Acknowledged, resolved, and muted groups are excluded.',
  fetch: async (environment) => {
    const services = googleResources(
      environment,
      'run.googleapis.com/Service',
      'service',
    );
    if (services.length === 0) {
      return {};
    }

    const { at } = environment;
    if (Date.now() - at.getTime() > PERIOD_LENGTH) {
      return {
        warnings: [
          {
            message:
              'Error groups cannot be listed for an evaluation window ending more than 30 days ago.',
          },
        ],
      };
    }

    const { GoogleApisService } =
      await import('../../../services/google-apis.js');
    const client = await environment.context
      .service(GoogleApisService)
      .getClient('clouderrorreporting', 'v1beta1', {});
    const nodes: Record<string, GraphEnvironmentNodeOutput> = {};
    const warnings: GraphWarning[] = [];
    await Promise.all(
      services.map(async ({ node, segments }) => {
        const stats: ErrorGroupStats[] = [];
        try {
          let pageToken: string | undefined;
          do {
            const { data } = await client.projects.groupStats.list({
              projectName: `projects/${segments.projects}`,
              'serviceFilter.service': segments.services,
              'timeRange.period': PERIOD,
              pageSize: 100,
              pageToken,
            });
            stats.push(...(data.errorGroupStats ?? []));
            pageToken = data.nextPageToken ?? undefined;
          } while (pageToken);
        } catch (error: any) {
          warnings.push({
            message: `Failed to list the error groups of '${node.id}': ${error.message ?? error}`,
          });
          return;
        }

        const alerts = stats.flatMap((groupStats) => {
          // An unspecified resolution status is interpreted as open.
          const status = groupStats.group?.resolutionStatus ?? 'OPEN';
          const alert =
            status === 'OPEN'
              ? toGraphAlert(groupStats, segments.projects)
              : undefined;
          return alert && alert.openedAt < at ? [alert] : [];
        });
        if (alerts.length > 0) {
          nodes[node.id] = { alerts };
        }
      }),
    );

    return { nodes, warnings };
  },
};

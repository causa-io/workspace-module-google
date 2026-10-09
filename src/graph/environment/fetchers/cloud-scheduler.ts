import {
  ScheduledJobAttemptStatus,
  type GraphEnvironmentFetcher,
  type GraphEnvironmentNodeOutput,
  type GraphWarning,
  type ScheduledJobGraphNodeData,
} from '@causa/workspace-core';
import type { Status } from 'google-gax';
import type { cloudscheduler_v1 } from 'googleapis';
import { googleResources } from '../resources.js';

/**
 * Returns the data of a scheduled job.
 * The attempt succeeded if its status code is `OK`. The status message is kept, or the name of the code if the attempt
 * failed without a message.
 *
 * @param job The Cloud Scheduler job.
 * @param statusCodes The gRPC status codes, which are passed as `google-gax` is imported dynamically.
 * @returns The data of the node.
 */
function toData(
  job: cloudscheduler_v1.Schema$Job,
  statusCodes: typeof Status,
): ScheduledJobGraphNodeData {
  const code = job.status?.code ?? statusCodes.OK;
  const succeeded = code === statusCodes.OK;
  const message =
    job.status?.message ||
    (succeeded ? undefined : (statusCodes[code] ?? `${code}`));
  return {
    ...(job.lastAttemptTime
      ? {
          lastAttempt: {
            time: new Date(job.lastAttemptTime),
            status: succeeded
              ? ScheduledJobAttemptStatus.Succeeded
              : ScheduledJobAttemptStatus.Failed,
            ...(message ? { message } : {}),
          },
        }
      : {}),
    ...(job.scheduleTime && job.state === 'ENABLED'
      ? { nextRun: new Date(job.scheduleTime) }
      : {}),
  };
}

/**
 * Reads the last attempt and next run of Cloud Scheduler jobs.
 */
export const googleCloudScheduler: GraphEnvironmentFetcher = {
  name: 'googleCloudScheduler',
  description:
    'The `lastAttempt` and `nextRun` of Cloud Scheduler jobs. Paused jobs have no next run. They are the current ones, with a warning when the job was attempted after the end of the evaluation window.',
  fetch: async (environment) => {
    const jobs = googleResources(
      environment,
      'cloudscheduler.googleapis.com/Job',
      'scheduledJob',
    );
    const byLocation = Map.groupBy(
      jobs,
      ({ segments }) =>
        `projects/${segments.projects}/locations/${segments.locations}`,
    );
    if (byLocation.size === 0) {
      return {};
    }

    const [{ GoogleApisService }, { Status }] = await Promise.all([
      import('../../../services/google-apis.js'),
      import('google-gax'),
    ]);
    const client = await environment.context
      .service(GoogleApisService)
      .getClient('cloudscheduler', 'v1', {});
    const nodes: Record<string, GraphEnvironmentNodeOutput> = {};
    const warnings: GraphWarning[] = [];
    await Promise.all(
      [...byLocation].map(async ([parent, jobNodes]) => {
        const deployed = new Map<string, cloudscheduler_v1.Schema$Job>();
        try {
          let pageToken: string | undefined;
          do {
            const { data } = await client.projects.locations.jobs.list({
              parent,
              pageSize: 500,
              pageToken,
            });
            (data.jobs ?? []).forEach((j) => j.name && deployed.set(j.name, j));
            pageToken = data.nextPageToken ?? undefined;
          } while (pageToken);
        } catch (error: any) {
          warnings.push({
            message: `Failed to list the Cloud Scheduler jobs in '${parent}': ${error.message ?? error}`,
          });
          return;
        }

        for (const { node, name } of jobNodes) {
          const job = deployed.get(name);
          if (!job) {
            warnings.push({
              message: `The Cloud Scheduler job '${name}' of '${node.id}' does not exist.`,
            });
            continue;
          }

          const data = toData(job, Status);
          const time = data.lastAttempt?.time;
          if (time && time > environment.at) {
            warnings.push({
              message: `The Cloud Scheduler job '${name}' of '${node.id}' was last attempted at ${time.toISOString()}, after the end of the evaluation window. Its last attempt and next run are the current ones.`,
            });
          }

          nodes[node.id] = { data };
        }
      }),
    );

    return { nodes, warnings };
  },
};

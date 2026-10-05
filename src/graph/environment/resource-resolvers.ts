import type {
  GraphResourcePrefixResolver,
  GraphWarning,
} from '@causa/workspace-core';
import { parseResourceName } from './resources.js';

/**
 * Resolves the names of Cloud Tasks queues, whose name ends with a suffix that is not known from the workspace.
 * Queues are listed once per project and location, and matched on the longest prefix, as a prefix may be the beginning
 * of another one. At most one queue is expected to match a prefix.
 */
export const CLOUD_TASKS_QUEUE_RESOLVER: GraphResourcePrefixResolver = {
  resourceType: 'cloudtasks.googleapis.com/Queue',
  resolve: async (context, prefixes) => {
    const byParent = Map.groupBy(prefixes, ({ prefix }) => {
      const segments = parseResourceName(prefix);
      return `projects/${segments.projects}/locations/${segments.locations}`;
    });

    const { GoogleApisService } = await import('../../services/google-apis.js');
    const client = await context
      .service(GoogleApisService)
      .getClient('cloudtasks', 'v2', {});
    const ids = new Map<string, string>();
    const warnings: GraphWarning[] = [];
    await Promise.all(
      [...byParent].map(async ([parent, prefixesOfParent]) => {
        const queues: string[] = [];
        try {
          let pageToken: string | undefined;
          do {
            const { data } = await client.projects.locations.queues.list({
              parent,
              pageSize: 1000,
              pageToken,
            });
            queues.push(...(data.queues ?? []).flatMap((q) => q.name ?? []));
            pageToken = data.nextPageToken ?? undefined;
          } while (pageToken);
        } catch (error: any) {
          warnings.push({
            message: `Failed to list the Cloud Tasks queues in '${parent}': ${error.message ?? error}`,
          });
          return;
        }

        const sorted = prefixesOfParent
          .map(({ prefix }) => prefix)
          .sort((a, b) => b.length - a.length);
        const matchesByPrefix = Map.groupBy(
          queues.filter((q) => sorted.some((p) => q.startsWith(p))),
          (q) => sorted.find((p) => q.startsWith(p)) as string,
        );

        for (const { node, prefix } of prefixesOfParent) {
          const matches = matchesByPrefix.get(prefix) ?? [];
          if (matches.length !== 1) {
            warnings.push({
              message: `Found ${matches.length} Cloud Tasks queues starting with '${prefix}' for '${node}', instead of one.`,
            });
            continue;
          }

          ids.set(node, matches[0]);
        }
      }),
    );

    return { ids, warnings };
  },
};

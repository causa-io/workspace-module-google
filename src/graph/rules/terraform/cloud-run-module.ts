import {
  GraphOriginKind,
  type GraphRule,
  type GraphRuleOutput,
} from '@causa/workspace-core';
import { cloudRunCronTriggers } from './cloud-run-cron-triggers.js';
import { cloudRunServices } from './cloud-run-services.js';
import { cloudRunTasksTriggers } from './cloud-run-tasks-triggers.js';

/**
 * The resources created by the blocks of the Cloud Run module, each part following a file of the module: the service,
 * the Pub/Sub, tasks, and cron triggers, and the IAM grants.
 */
export const cloudRunModule: GraphRule = {
  name: 'cloudRunModule',
  kind: GraphOriginKind.Declared,
  description:
    'The resources each Cloud Run module block creates: the `service` realizing the project read back from `configuration_file`, a push `brokerSubscription` per Pub/Sub trigger, a `queue` per task trigger, and a `scheduledJob` per cron trigger, with the edges between them, and the `publishes`, `accesses`, and `enqueues` edges its IAM bindings grant. Each resource is linked by a `deploys` edge from the projects applying the block.',
  async run(graph) {
    const outputs: GraphRuleOutput[] = await Promise.all([
      cloudRunServices(graph),
      cloudRunTasksTriggers(graph),
      cloudRunCronTriggers(graph),
    ]);
    return {
      nodes: outputs.flatMap((o) => o.nodes ?? []),
      edges: outputs.flatMap((o) => o.edges ?? []),
      warnings: outputs.flatMap((o) => o.warnings ?? []),
    };
  },
};

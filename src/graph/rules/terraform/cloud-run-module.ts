import {
  GraphOriginKind,
  type GraphRule,
  type GraphRuleOutput,
} from '@causa/workspace-core';
import { cloudRunCronTriggers } from './cloud-run-cron-triggers.js';
import { cloudRunEventarcTriggers } from './cloud-run-eventarc-triggers.js';
import { cloudRunGrants } from './cloud-run-grants.js';
import { cloudRunPubSubTriggers } from './cloud-run-pubsub-triggers.js';
import { cloudRunServices } from './cloud-run-services.js';
import { cloudRunTasksTriggers } from './cloud-run-tasks-triggers.js';

/**
 * The resources created by the blocks of the Cloud Run module, each part following a file of the module: the service,
 * the Pub/Sub, tasks, cron, and Eventarc triggers, and the IAM grants.
 */
export const cloudRunModule: GraphRule = {
  name: 'cloudRunModule',
  kind: GraphOriginKind.Declared,
  description:
    'The resources each Cloud Run module block creates: the `service` realizing the project read back from `configuration_file`, a push `brokerSubscription` per Pub/Sub trigger, a `queue` per task trigger, a `scheduledJob` per cron trigger, and a push `brokerSubscription` per Eventarc trigger, located by the trigger and standing for the subscription Eventarc manages, with the edges between them, and the `publishes`, `accesses`, and `enqueues` edges its IAM bindings grant. Each resource is linked by a `deploys` edge from the projects applying the block.',
  async run(graph) {
    const outputs: GraphRuleOutput[] = await Promise.all([
      cloudRunServices(graph),
      cloudRunPubSubTriggers(graph),
      cloudRunTasksTriggers(graph),
      cloudRunCronTriggers(graph),
      cloudRunEventarcTriggers(graph),
      cloudRunGrants(graph),
    ]);
    return {
      nodes: outputs.flatMap((o) => o.nodes ?? []),
      edges: outputs.flatMap((o) => o.edges ?? []),
      warnings: outputs.flatMap((o) => o.warnings ?? []),
    };
  },
};

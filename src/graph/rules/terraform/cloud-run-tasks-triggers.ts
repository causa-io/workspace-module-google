import {
  type GraphRuleEdge,
  type GraphRuleNode,
  type GraphRuleOutput,
  type GraphWarning,
} from '@causa/workspace-core';
import {
  nodeId,
  queueId,
  triggerId,
  type GraphContext,
} from '@causa/workspace-core/graph';
import { terraformDeploys } from '@causa/workspace-terraform';
import { CloudRunFact } from '../../cloud-run.js';
import { blockResource } from '../../terraform-modules.js';

/**
 * The resources a Cloud Run module block creates for the task triggers of a project, when tasks triggers are enabled:
 *
 * - A `queue` node per `queue` of the task triggers. The module suffixes the queue name with a random string, such that
 *   only a prefix of the resource name is known. The locator is the declared name. The queue `realizes` the task
 *   triggers declaring it, and `targets` the service the block deploys, which is the HTTP target of the tasks.
 * - An `enqueues` edge from every service of the project to each queue.
 *
 * @param graph The context of the extraction.
 * @returns The queues, and their edges.
 */
export async function cloudRunTasksTriggers(
  graph: GraphContext,
): Promise<GraphRuleOutput> {
  const { locator } = graph;
  const cloudRun = await graph.get(CloudRunFact);
  const nodes: GraphRuleNode[] = [];
  const edges: GraphRuleEdge[] = [];
  const warnings: GraphWarning[] = [];

  for (const service of cloudRun) {
    const source = service.block.declaration;
    for (const [name, trigger] of service.tasksTriggers) {
      const queueSource = await locator.configurationSource(
        service.project.context,
        ['serviceContainer', 'triggers', name, 'queue'],
      );
      if (typeof trigger.queue !== 'string') {
        warnings.push({
          message: `Task trigger '${name}' has no queue.`,
          sources: [queueSource],
        });
        continue;
      }

      const resource = await blockResource(
        graph,
        service.block,
        {
          type: 'cloudtasks.googleapis.com/Queue',
          scope: service.project,
          prefix: true,
          id: [
            'projects/',
            service.projectPart,
            '/locations/',
            service.locationPart,
            `/queues/${trigger.queue}-`,
          ],
        },
        warnings,
      );
      nodes.push({
        layer: 'infrastructure',
        type: 'queue',
        locator: trigger.queue,
        name: trigger.queue,
        sources: [source, queueSource],
        data: { resource },
      });
      edges.push(
        ...terraformDeploys(service.block, nodeId('queue', trigger.queue)),
        {
          type: 'realizes',
          from: queueId(trigger.queue),
          to: triggerId(service.project.directory, name),
          sources: [source],
        },
        {
          type: 'targets',
          from: queueId(trigger.queue),
          to: service.id,
          label: trigger.endpoint?.path,
          sources: [source],
        },
      );
    }
  }

  for (const services of Map.groupBy(cloudRun, (s) => s.project).values()) {
    for (const granting of services.filter((s) => s.setTasksPermissions)) {
      const queues = new Map<string, string>();
      for (const [name, trigger] of granting.tasksTriggers) {
        if (typeof trigger.queue === 'string' && !queues.has(trigger.queue)) {
          queues.set(trigger.queue, name);
        }
      }

      for (const [queue, trigger] of queues) {
        for (const service of services) {
          edges.push({
            type: 'enqueues',
            from: service.id,
            to: queueId(queue),
            sources: [
              granting.block.declaration,
              await locator.configurationSource(granting.project.context, [
                'serviceContainer',
                'triggers',
                trigger,
                'queue',
              ]),
            ],
          });
        }
      }
    }
  }

  return { nodes, edges, warnings };
}

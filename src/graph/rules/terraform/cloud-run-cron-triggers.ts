import {
  type GraphRuleEdge,
  type GraphRuleNode,
  type GraphRuleOutput,
  type GraphWarning,
} from '@causa/workspace-core';
import {
  nodeId,
  scheduledJobId,
  triggerId,
  triggerLocator,
  type GraphContext,
} from '@causa/workspace-core/graph';
import { terraformDeploys } from '@causa/workspace-terraform';
import { CloudRunFact } from '../../cloud-run.js';
import { blockResource } from '../../terraform-modules.js';

/**
 * A `scheduledJob` node per cron trigger of a project, for each Cloud Run module block deploying it with cron triggers
 * enabled. The module names the job `run-<service>-<trigger>`. The locator is the trigger's. The job `realizes` its
 * trigger, and `targets` the service the block deploys.
 *
 * @param graph The context of the extraction.
 * @returns The scheduled jobs, and their edges.
 */
export async function cloudRunCronTriggers(
  graph: GraphContext,
): Promise<GraphRuleOutput> {
  const { locator } = graph;
  const cloudRun = await graph.get(CloudRunFact);
  const nodes: GraphRuleNode[] = [];
  const edges: GraphRuleEdge[] = [];
  const warnings: GraphWarning[] = [];

  for (const service of cloudRun) {
    const source = service.block.declaration;
    for (const [name, trigger] of service.cronTriggers) {
      const jobLocator = triggerLocator(service.project.directory, name);
      const job = `run-${service.name}-${name}`;
      nodes.push({
        layer: 'infrastructure',
        type: 'scheduledJob',
        locator: jobLocator,
        name: job,
        sources: [
          source,
          await locator.configurationSource(service.project.context, [
            'serviceContainer',
            'triggers',
            name,
          ]),
        ],
        data: {
          resource: await blockResource(
            graph,
            service.block,
            {
              type: 'cloudscheduler.googleapis.com/Job',
              scope: service.project,
              id: [
                'projects/',
                service.projectPart,
                '/locations/',
                service.locationPart,
                `/jobs/${job}`,
              ],
            },
            warnings,
          ),
        },
      });
      edges.push(
        ...terraformDeploys(service.block, nodeId('scheduledJob', jobLocator)),
        {
          type: 'realizes',
          from: scheduledJobId(jobLocator),
          to: triggerId(service.project.directory, name),
          sources: [source],
        },
        {
          type: 'targets',
          from: scheduledJobId(jobLocator),
          to: service.id,
          label: trigger.endpoint?.path,
          sources: [source],
        },
      );
    }
  }

  return { nodes, edges, warnings };
}

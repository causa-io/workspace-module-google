import {
  type ServiceGraphNodeData,
  type GraphWarning,
  type GraphRuleEdge,
  type GraphRuleNode,
  type GraphRuleOutput,
  type ServiceContainerConfiguration,
} from '@causa/workspace-core';
import {
  projectId,
  serviceLocator,
  type GraphContext,
} from '@causa/workspace-core/graph';
import { terraformDeploys } from '@causa/workspace-terraform';
import { CloudRunFact } from '../../cloud-run.js';
import { blockResource } from '../../terraform-modules.js';

/**
 * A `service` node per block of the Cloud Run module, and a `realizes` edge from it to the project whose configuration
 * file the block reads. The service name is the block's `name` argument or the project name, and `platform` is the
 * project's `serviceContainer.platform`. Blocks whose project cannot be found, and arguments that cannot be evaluated,
 * are reported.
 *
 * @param graph The context of the extraction.
 * @returns The services, and their edges.
 */
export async function cloudRunServices(
  graph: GraphContext,
): Promise<GraphRuleOutput> {
  const { locator } = graph;
  const cloudRun = await graph.get(CloudRunFact);
  const nodes: GraphRuleNode[] = [];
  const edges: GraphRuleEdge[] = [];
  const warnings: GraphWarning[] = [];

  for (const service of cloudRun) {
    const source = service.block.declaration;
    const data: ServiceGraphNodeData = {
      platform: service.project.context
        .asConfiguration<ServiceContainerConfiguration>()
        .get('serviceContainer.platform'),
      resource: await blockResource(
        graph,
        service.block,
        {
          type: 'run.googleapis.com/Service',
          scope: service.project,
          id: [
            'projects/',
            service.projectPart,
            '/locations/',
            service.locationPart,
            `/services/${service.name}`,
          ],
        },
        warnings,
      ),
    };
    nodes.push({
      layer: 'infrastructure',
      type: 'service',
      locator: serviceLocator(service.project.directory, service.name),
      name: service.name,
      sources: [
        source,
        await locator.configurationSource(service.project.context, [
          'project',
          'name',
        ]),
      ],
      data,
    });
    edges.push(...terraformDeploys(service.block, service.id), {
      type: 'realizes',
      from: service.id,
      to: projectId(service.project.directory),
      sources: [source],
    });
  }

  return { nodes, edges, warnings };
}

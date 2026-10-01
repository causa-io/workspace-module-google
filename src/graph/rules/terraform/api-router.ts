import {
  GraphOriginKind,
  type GraphRule,
  type GraphRuleEdge,
  type GraphRuleNode,
  type GraphWarning,
  type RoutesGraphEdgeData,
  type ServiceContainerConfiguration,
} from '@causa/workspace-core';
import { apiRouterId, nodeId } from '@causa/workspace-core/graph';
import {
  modulesWithSource,
  terraformDeploys,
  TerraformProjectsFact,
  terraformValue,
  type TerraformModuleBlock,
} from '@causa/workspace-terraform';
import { CloudRunFact } from '../../cloud-run.js';
import {
  blockResource,
  argumentOrConfiguration,
} from '../../terraform-modules.js';

/**
 * The source of the Causa Terraform module creating the load balancer routing requests to services.
 */
export const API_ROUTER_MODULE_SOURCE = 'causa-io/api-router/google';

/**
 * The default name of the API router.
 */
const DEFAULT_API_ROUTER_NAME = 'api';

/**
 * Returns the name of an API router, from its `name` argument or the module's default.
 */
function routerName(block: TerraformModuleBlock): string | undefined {
  const argument = block.arguments['name'];
  if (argument === undefined) {
    return DEFAULT_API_ROUTER_NAME;
  }

  const value = terraformValue(argument);
  return typeof value === 'string' ? value : undefined;
}

/**
 * The resources created by the blocks of the API router module:
 *
 * - An `apiRouter` node per block, located by its `name` argument (default `api`). The module does not read the
 *   workspace configuration: the GCP project of its URL map is assumed to be `google.project` when the
 *   `gcp_project_id` argument cannot be evaluated.
 * - A `routes` edge from the router to each service whose Cloud Run module block sets `enable_public_http_endpoints`,
 *   with the project's `serviceContainer.endpoints.http` as paths.
 */
export const apiRouterModule: GraphRule = {
  name: 'apiRouterModule',
  kind: GraphOriginKind.Declared,
  description:
    'One `apiRouter` node per API router module block, located by its `name` argument or the module default `api`, and linked by a `deploys` edge from the projects applying the block. One `routes` edge from the router to each service whose Cloud Run module block enables public HTTP endpoints, with the project’s `endpoints.http` as paths, assuming the single router is wired to them.',
  async run(graph) {
    const { locator } = graph;
    const [terraformProjects, cloudRun] = await Promise.all([
      graph.get(TerraformProjectsFact),
      graph.get(CloudRunFact),
    ]);
    const apiRouters = modulesWithSource(
      terraformProjects,
      API_ROUTER_MODULE_SOURCE,
    );
    const nodes: GraphRuleNode[] = [];
    const edges: GraphRuleEdge[] = [];
    const warnings: GraphWarning[] = [];

    for (const block of apiRouters) {
      const source = block.declaration;
      const name = routerName(block) ?? DEFAULT_API_ROUTER_NAME;
      if (!routerName(block)) {
        warnings.push({
          message: `The router name is computed. Assuming '${DEFAULT_API_ROUTER_NAME}'.`,
          sources: [source],
        });
      }

      const part = argumentOrConfiguration(
        block,
        'gcp_project_id',
        'google.project',
        warnings,
      );

      nodes.push({
        layer: 'infrastructure',
        type: 'apiRouter',
        locator: name,
        name,
        sources: [source],
        data: {
          resource: await blockResource(
            graph,
            block,
            {
              type: 'compute.googleapis.com/UrlMap',
              id: ['projects/', part, `/global/urlMaps/${name}`],
            },
            warnings,
          ),
        },
      });
      edges.push(...terraformDeploys(block, nodeId('apiRouter', name)));
    }

    const exposed = cloudRun.filter((s) => s.enablePublicHttpEndpoints);
    if (exposed.length === 0) {
      return { nodes, edges, warnings };
    }

    if (apiRouters.length !== 1) {
      warnings.push({
        message: `There are ${apiRouters.length} API router module blocks. Cannot tell which one routes to ${exposed
          .map((s) => `'${s.name}'`)
          .join(', ')}.`,
        sources: apiRouters.map((b) => b.declaration),
      });
      return { nodes, edges, warnings };
    }

    const [router] = apiRouters;
    const name = routerName(router) ?? DEFAULT_API_ROUTER_NAME;
    for (const service of exposed) {
      const paths =
        service.project.context
          .asConfiguration<ServiceContainerConfiguration>()
          .get('serviceContainer.endpoints.http') ?? [];
      if (paths.length === 0) {
        warnings.push({
          message: `Service '${service.name}' enables public HTTP endpoints but its project declares no 'endpoints.http'.`,
          sources: [service.block.declaration],
        });
      }

      const data: RoutesGraphEdgeData = { paths };
      edges.push({
        type: 'routes',
        from: apiRouterId(name),
        to: service.id,
        sources: [
          service.block.declaration,
          await locator.configurationSource(service.project.context, [
            'serviceContainer',
            'endpoints',
            'http',
          ]),
          router.declaration,
        ],
        data,
      });
    }

    return { nodes, edges, warnings };
  },
};

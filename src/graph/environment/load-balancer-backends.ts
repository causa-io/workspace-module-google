import type { WorkspaceContext } from '@causa/workspace';
import {
  GraphEnvironmentFact,
  type GraphEnvironmentContext,
  type GraphFactOutput,
} from '@causa/workspace-core/graph';
import type { compute_v1 } from 'googleapis';
import {
  templateMapping,
  type MonitoringLabel,
  type MonitoringResourceMapping,
} from './monitoring-mappings.js';
import { googleResources, type GoogleResource } from './resources.js';

/**
 * Maps load balancer labels to the URL maps of the graph, i.e. API routers.
 */
export const URL_MAP_MAPPING = templateMapping({
  nodeType: 'apiRouter',
  resourceType: 'compute.googleapis.com/UrlMap',
  monitoredResource: 'https_lb_rule',
  name: 'projects/{project}/global/urlMaps/{resource.label.url_map_name}',
});

/**
 * A backend of load balancers, which routes requests to a resource.
 */
export type LoadBalancerBackend = {
  /**
   * The kind of the backend.
   */
  readonly kind: LoadBalancerBackendKind;

  /**
   * The GCP project of the backend.
   */
  readonly project: string;

  /**
   * The values of the key labels of the kind identifying the backend.
   */
  readonly labels: Readonly<Record<MonitoringLabel, string>>;

  /**
   * The full resource name of the resource the backend routes requests to, e.g. a Cloud Run service.
   */
  readonly resource: string;
};

/**
 * A kind of load balancer backend, routing requests to the resources of nodes of a type.
 */
export type LoadBalancerBackendKind = {
  /**
   * The type of the nodes requests are routed to.
   */
  readonly nodeType: string;

  /**
   * The type of the nodes' resource, in their `data.resource.type`.
   */
  readonly resourceType: string;

  /**
   * The labels of load balancer time series and alerts identifying a backend of this kind within a project.
   */
  readonly keyLabels: readonly MonitoringLabel[];

  /**
   * Lists the backends of this kind. It throws if some backends cannot be listed.
   *
   * @param context The context, from which the `GoogleApisService` is obtained.
   * @param projects The projects of the graph's URL maps, in which backends are listed.
   * @param resources The resources of the kind's types, e.g. to only list regional backends in their regions.
   * @returns The backends.
   */
  list(
    context: WorkspaceContext,
    projects: readonly string[],
    resources: readonly GoogleResource[],
  ): Promise<LoadBalancerBackend[]>;
};

/**
 * Serverless network endpoint groups, routing requests to Cloud Run services.
 * They are listed in the regions of the services, in the projects of the URL maps.
 */
export const SERVERLESS_NEG_BACKENDS: LoadBalancerBackendKind = {
  nodeType: 'service',
  resourceType: 'run.googleapis.com/Service',
  keyLabels: ['resource.label.backend_scope', 'resource.label.backend_name'],
  list: async (context, projects, resources) => {
    const locations = new Map<string, { project: string; region: string }>();
    for (const { segments } of resources) {
      const { projects: project, locations: region } = segments;
      if (project && region && projects.includes(project)) {
        locations.set(`projects/${project}/regions/${region}`, {
          project,
          region,
        });
      }
    }
    if (locations.size === 0) {
      return [];
    }

    const { GoogleApisService } = await import('../../services/google-apis.js');
    const client = await context
      .service(GoogleApisService)
      .getClient('compute', 'v1', {});
    const backends = await Promise.all(
      [...locations.values()].map(async ({ project, region }) => {
        const groups: compute_v1.Schema$NetworkEndpointGroup[] = [];
        try {
          let pageToken: string | undefined;
          do {
            const { data } = await client.regionNetworkEndpointGroups.list({
              project,
              region,
              pageToken,
            });
            groups.push(...(data.items ?? []));
            pageToken = data.nextPageToken ?? undefined;
          } while (pageToken);
        } catch (error: any) {
          throw new Error(
            `Failed to list the network endpoint groups in project '${project}' and region '${region}': ${error.message ?? error}`,
            { cause: error },
          );
        }

        return groups.flatMap((group): LoadBalancerBackend[] => {
          const service = group.cloudRun?.service;
          if (
            group.networkEndpointType !== 'SERVERLESS' ||
            !group.name ||
            !service
          ) {
            return [];
          }

          return [
            {
              kind: SERVERLESS_NEG_BACKENDS,
              project,
              labels: {
                'resource.label.backend_scope': region,
                'resource.label.backend_name': group.name,
              },
              resource: `projects/${project}/locations/${region}/services/${service}`,
            },
          ];
        });
      }),
    );

    return backends.flat();
  },
};

/**
 * The kinds of backends through which requests can be routed to nodes.
 */
export const LOAD_BALANCER_BACKEND_KINDS: readonly LoadBalancerBackendKind[] = [
  SERVERLESS_NEG_BACKENDS,
];

/**
 * Lists the backends of all kinds, in the projects of the URL maps of the graph. No API is called if the graph has no
 * URL map. The fact fails if some backends cannot be listed.
 */
export class LoadBalancerBackendsFact extends GraphEnvironmentFact<
  readonly LoadBalancerBackend[]
> {
  async compute(
    environment: GraphEnvironmentContext,
  ): Promise<GraphFactOutput<readonly LoadBalancerBackend[]>> {
    const projects = [
      ...new Set(
        googleResources(
          environment,
          URL_MAP_MAPPING.resourceType,
          URL_MAP_MAPPING.nodeType,
        ).map(({ segments }) => segments.projects),
      ),
    ];
    if (projects.length === 0) {
      return { value: [] };
    }

    const backends = await Promise.all(
      LOAD_BALANCER_BACKEND_KINDS.map((kind) =>
        kind.list(
          environment.context,
          projects,
          googleResources(environment, kind.resourceType, kind.nodeType),
        ),
      ),
    );

    return { value: backends.flat() };
  }
}

/**
 * Builds the mapping of the backends of a kind, from load balancer labels to the resources they route requests to.
 *
 * @param kind The kind of backends.
 * @returns The mapping.
 */
export function loadBalancerBackendMapping(
  kind: LoadBalancerBackendKind,
): MonitoringResourceMapping {
  return {
    nodeType: kind.nodeType,
    resourceType: kind.resourceType,
    monitoredResource: URL_MAP_MAPPING.monitoredResource,
    keyLabels: kind.keyLabels,
    resolver: async (environment) => {
      const backends = await environment.get(LoadBalancerBackendsFact);
      const key = (
        project: string,
        labels: Readonly<Record<MonitoringLabel, string>>,
      ) => JSON.stringify([project, ...kind.keyLabels.map((l) => labels[l])]);
      const resources = new Map(
        backends
          .filter((b) => b.kind === kind)
          .map((b) => [key(b.project, b.labels), b.resource]),
      );
      return ({ project, labels }) => resources.get(key(project, labels));
    },
  };
}

/**
 * The mappings of load balancer labels to the resources backends route requests to, one per kind of backend.
 */
export const LOAD_BALANCER_BACKEND_MAPPINGS: readonly MonitoringResourceMapping[] =
  LOAD_BALANCER_BACKEND_KINDS.map(loadBalancerBackendMapping);

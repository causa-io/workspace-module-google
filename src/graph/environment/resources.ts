import type {
  GraphEnvironmentContext,
  GraphNodeEntry,
} from '@causa/workspace-core/graph';

/**
 * The segments of a Google Cloud resource name, keyed by collection.
 * For example, `projects/my-project/locations/europe-west1/services/my-service` is
 * `{ projects: 'my-project', locations: 'europe-west1', services: 'my-service' }`.
 */
export type ResourceNameSegments = Record<string, string>;

/**
 * Parses a Google Cloud resource name into its segments.
 * The `global` segment, which is not followed by an ID (e.g. in `projects/my-project/global/urlMaps/api`), is skipped.
 *
 * @param name The resource name.
 * @returns The segments, keyed by collection.
 */
export function parseResourceName(name: string): ResourceNameSegments {
  const tokens = name.split('/');
  const segments: ResourceNameSegments = {};
  for (let index = 0; index < tokens.length;) {
    const collection = tokens[index];
    if (collection === 'global') {
      index += 1;
      continue;
    }

    segments[collection] = tokens[index + 1] ?? '';
    index += 2;
  }

  return segments;
}

/**
 * A node whose resource is a Google Cloud resource, along with its full name.
 */
export type GoogleResource = {
  /**
   * The node.
   */
  readonly node: GraphNodeEntry;

  /**
   * The type of the resource, e.g. `run.googleapis.com/Service`.
   */
  readonly type: string;

  /**
   * The full resource name.
   */
  readonly name: string;

  /**
   * The segments of the resource name.
   */
  readonly segments: ResourceNameSegments;
};

/**
 * Returns whether a resource type is the type of a Google Cloud resource.
 *
 * @param type The type of the resource.
 * @returns `true` for Google Cloud resource types, e.g. `run.googleapis.com/Service`.
 */
function isGoogleResourceType(type: string): boolean {
  return type.includes('.googleapis.com/');
}

/**
 * Returns the Google Cloud resources of the graph, with the segments of their names.
 *
 * @param environment The context of the environment.
 * @param resourceType The type of the resources. Defaults to all Google Cloud resource types.
 * @param nodeType The type of the nodes. Defaults to all node types.
 * @returns The resources, in the order of the graph.
 */
export function googleResources(
  environment: GraphEnvironmentContext,
  resourceType?: string,
  nodeType?: string,
): GoogleResource[] {
  return environment
    .resources(resourceType, nodeType)
    .filter(({ resource }) => isGoogleResourceType(resource.type))
    .map(({ node, resource: { type, id } }) => ({
      node,
      type,
      name: id,
      segments: parseResourceName(id),
    }));
}

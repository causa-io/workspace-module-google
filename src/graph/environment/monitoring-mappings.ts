import {
  GraphFactError,
  type GraphEnvironmentContext,
  type GraphNodeEntry,
} from '@causa/workspace-core/graph';

/**
 * A label of Cloud Monitoring time series or alerts, written as in `groupByFields`.
 */
export type MonitoringLabel =
  `resource.label.${string}` | `metric.label.${string}`;

/**
 * What identifies a resource in a time series or an alert.
 */
export type MonitoringResourceKey = {
  /**
   * The GCP project of the resource.
   */
  readonly project: string;

  /**
   * The values of all the key labels of the mapping, keyed by label.
   */
  readonly labels: Readonly<Record<MonitoringLabel, string>>;
};

/**
 * Returns the full name of the resource identified by a key, or `undefined` if the key identifies no resource.
 */
export type MonitoringResourceResolver = (
  key: MonitoringResourceKey,
) => string | undefined;

/**
 * How time series and alerts on a Cloud Monitoring monitored resource identify the resources of the nodes of a type.
 */
export type MonitoringResourceMapping = {
  /**
   * The type of the nodes.
   */
  readonly nodeType: string;

  /**
   * The type of the nodes' resource, in their `data.resource.type`.
   */
  readonly resourceType: string;

  /**
   * The type of the monitored resource, e.g. `cloud_run_revision`.
   */
  readonly monitoredResource: string;

  /**
   * The labels identifying a resource within a project. A time series or alert missing one of them, or with an empty
   * value, is not mapped.
   */
  readonly keyLabels: readonly MonitoringLabel[];

  /**
   * Prepares the resolution of keys to resource names in the environment.
   * It is called through {@link prepareMonitoringMapping}, once per read or listing of alerts, and only when the mapping
   * may apply. It throws a `GraphFactError` when a fact it depends on cannot be computed.
   *
   * @param environment The context of the environment.
   * @returns The resolver.
   */
  resolver(
    environment: GraphEnvironmentContext,
  ): MonitoringResourceResolver | Promise<MonitoringResourceResolver>;
};

/**
 * A mapping whose resolver is prepared.
 */
export type PreparedMonitoringMapping = {
  /**
   * The mapping.
   */
  readonly mapping: MonitoringResourceMapping;

  /**
   * The resolver of the mapping.
   */
  readonly resolve: MonitoringResourceResolver;
};

/**
 * Returns the name of a label, without its source, e.g. `service_name` for `resource.label.service_name`.
 *
 * @param label The label.
 * @returns The name of the label.
 */
export function monitoringLabelName(label: MonitoringLabel): string {
  return label.slice(label.lastIndexOf('.') + 1);
}

/**
 * Builds a mapping whose resource names are made of the values of its key labels.
 *
 * @param mapping The mapping, with the template of the name. `{project}` is the project of the key. Other placeholders
 *   are labels, e.g. `projects/{project}/locations/{resource.label.location}/services/{resource.label.service_name}`,
 *   and make up the key labels, in order.
 * @returns The mapping.
 */
export function templateMapping(
  mapping: Pick<
    MonitoringResourceMapping,
    'nodeType' | 'resourceType' | 'monitoredResource'
  > & { readonly name: string },
): MonitoringResourceMapping {
  const { name, ...rest } = mapping;
  const placeholder = /\{([\w.]+)\}/g;
  const keyLabels = [...name.matchAll(placeholder)]
    .map(([, label]) => label)
    .filter((label) => label !== 'project') as MonitoringLabel[];
  return {
    ...rest,
    keyLabels,
    resolver:
      () =>
      ({ project, labels }) =>
        name.replace(placeholder, (_, label: string) =>
          label === 'project' ? project : labels[label as MonitoringLabel],
        ),
  };
}

/**
 * Reads the key of a mapping.
 *
 * @param mapping The mapping.
 * @param project The project of the time series or alert.
 * @param read Returns the value of a label of the time series or alert.
 * @returns The key, or `undefined` if a key label is missing or empty.
 */
export function readMonitoringResourceKey(
  mapping: MonitoringResourceMapping,
  project: string,
  read: (label: MonitoringLabel) => string | undefined,
): MonitoringResourceKey | undefined {
  const labels: Partial<Record<MonitoringLabel, string>> = {};
  for (const label of mapping.keyLabels) {
    const value = read(label);
    if (!value) {
      return undefined;
    }

    labels[label] = value;
  }

  return { project, labels: labels as Record<MonitoringLabel, string> };
}

/**
 * Prepares a mapping.
 *
 * @param environment The context of the environment.
 * @param mapping The mapping.
 * @returns The prepared mapping, or `undefined` if a fact its resolver depends on could not be computed. The failure is
 *   reported by the fact.
 */
export async function prepareMonitoringMapping(
  environment: GraphEnvironmentContext,
  mapping: MonitoringResourceMapping,
): Promise<PreparedMonitoringMapping | undefined> {
  try {
    return { mapping, resolve: await mapping.resolver(environment) };
  } catch (error) {
    if (error instanceof GraphFactError) {
      return undefined;
    }

    throw error;
  }
}

/**
 * A resource name resolved by a mapping, which no node of the graph holds.
 */
export type MissingMonitoredResource = {
  /**
   * The mapping that resolved the name.
   */
  readonly mapping: MonitoringResourceMapping;

  /**
   * The key from which the name was resolved.
   */
  readonly key: MonitoringResourceKey;

  /**
   * The resolved resource name.
   */
  readonly name: string;
};

/**
 * Finds the node of the resource identified by a time series or an alert, trying mappings from the one with the most
 * key labels. A mapping applies when its key can be read, and the name it resolves is held by a node of its node type.
 *
 * @param environment The context of the environment.
 * @param mappings The prepared mappings that may apply.
 * @param project The project of the time series or alert.
 * @param read Returns the value of a label of the time series or alert.
 * @returns The node, if a mapping applies, and the names resolved by mappings that are not held by a node of the graph.
 */
export function findMonitoredNode(
  environment: GraphEnvironmentContext,
  mappings: readonly PreparedMonitoringMapping[],
  project: string,
  read: (label: MonitoringLabel) => string | undefined,
): {
  readonly node?: GraphNodeEntry;
  readonly missing: MissingMonitoredResource[];
} {
  const missing: MissingMonitoredResource[] = [];
  const sorted = [...mappings].sort(
    (a, b) => b.mapping.keyLabels.length - a.mapping.keyLabels.length,
  );
  for (const { mapping, resolve } of sorted) {
    const key = readMonitoringResourceKey(mapping, project, read);
    const name = key && resolve(key);
    if (!key || !name) {
      continue;
    }

    const node = environment.resourceNode(mapping.resourceType, name);
    if (!node) {
      missing.push({ mapping, key, name });
    } else if (node.type === mapping.nodeType) {
      return { node, missing };
    }
  }

  return { missing };
}

import {
  GraphMetricKind,
  type GraphBucketLayoutsByName,
  type GraphEnvironmentNodeOutput,
  type GraphMetricMeasure,
  type GraphMetricValue,
  type GraphWarning,
} from '@causa/workspace-core';
import {
  sumGraphMetricMeasures,
  type GraphEnvironmentContext,
} from '@causa/workspace-core/graph';
import type { protos } from '@google-cloud/monitoring';
import {
  monitoringMetricKind,
  type MonitoringMetric,
} from './monitoring-catalog.js';
import {
  findMonitoredNode,
  monitoringLabelName,
  prepareMonitoringMapping,
  readMonitoringResourceKey,
  type MonitoringLabel,
  type PreparedMonitoringMapping,
} from './monitoring-mappings.js';
import {
  BucketLayoutRegistry,
  toMeasure,
  toNumber,
} from './monitoring-values.js';
import { googleResources } from './resources.js';

type TimeSeries = protos.google.monitoring.v3.ITimeSeries;
type ListTimeSeriesRequest = protos.google.monitoring.v3.IListTimeSeriesRequest;

/**
 * The gRPC code returned when a metric does not exist, e.g. because no data was ever written for it.
 */
const NOT_FOUND_CODE = 5;

/**
 * How time series are aligned over a period, for each kind of metric.
 * `ALIGN_RATE` returns a rate per second, `ALIGN_DELTA` the merged distribution over the period, and
 * `ALIGN_NEXT_OLDER` the latest point before the end of the period.
 */
const ALIGNERS: Record<
  GraphMetricKind,
  'ALIGN_RATE' | 'ALIGN_DELTA' | 'ALIGN_NEXT_OLDER'
> = {
  [GraphMetricKind.Rate]: 'ALIGN_RATE',
  [GraphMetricKind.Distribution]: 'ALIGN_DELTA',
  [GraphMetricKind.Gauge]: 'ALIGN_NEXT_OLDER',
};

/**
 * The minimum alignment period accepted by Cloud Monitoring, in seconds.
 */
export const MIN_ALIGNMENT_PERIOD = 60;

/**
 * The delay after which Cloud Monitoring is expected to expose complete data, in seconds.
 * Periods ending more recently may miss points, e.g. making rates look like 0.
 */
export const MONITORING_DATA_DELAY = 300;

/**
 * Returns the end of the periods over which metrics are read, which is at most {@link MONITORING_DATA_DELAY} before
 * now.
 *
 * @param end The requested end.
 * @returns The requested end, or {@link MONITORING_DATA_DELAY} before now if it is more recent.
 */
export function monitoringEnd(end: Date): Date {
  return new Date(
    Math.min(end.getTime(), Date.now() - MONITORING_DATA_DELAY * 1000),
  );
}

/**
 * The value of a metric of a node over one period, and the values of its groups when the metric is grouped.
 */
export type MonitoringPoint = Pick<GraphMetricValue, 'value' | 'groups'>;

/**
 * The group key whose values are the IDs of the nodes resolved from the {@link MonitoringMetric.groupByNode} mappings.
 */
const NODE_GROUP_KEY = 'node';

/**
 * Returns the value of a label of a time series.
 *
 * @param series The time series.
 * @param label The label, e.g. `resource.label.service_name` or `metric.label.response_code`.
 * @returns The value of the label.
 */
function labelValue(
  series: TimeSeries,
  label: MonitoringLabel,
): string | undefined {
  const labels = label.startsWith('resource.')
    ? series.resource?.labels
    : series.metric?.labels;
  return labels?.[monitoringLabelName(label)] ?? undefined;
}

/**
 * Combines several measures of the same node and group.
 */
function combine(
  measures: GraphMetricMeasure[],
  reducer: NonNullable<MonitoringMetric['reducer']>,
): GraphMetricMeasure {
  if (
    reducer === 'REDUCE_MAX' &&
    measures.every((m) => typeof m === 'number')
  ) {
    return Math.max(...measures);
  }

  return sumGraphMetricMeasures(measures);
}

/**
 * Returns whether a measure is empty, i.e. 0 or a distribution without values.
 */
function isEmpty(measure: GraphMetricMeasure): boolean {
  return typeof measure === 'number' ? measure === 0 : measure.count === 0;
}

/**
 * Builds the point of a period from the measures of its groups.
 * For rates and distributions, empty groups are dropped.
 *
 * @param byGroup The measures of the period, keyed by serialized group key.
 * @param metric The metric.
 * @param kind The kind of the values of the metric.
 * @param grouped Whether the values of the metric are grouped.
 * @returns The point, or `undefined` if all its groups are empty.
 */
function toPoint(
  byGroup: Map<
    string,
    { key: Record<string, string>; measures: GraphMetricMeasure[] }
  >,
  metric: MonitoringMetric,
  kind: GraphMetricKind,
  grouped: boolean,
): MonitoringPoint | undefined {
  const reducer = metric.reducer ?? 'REDUCE_SUM';
  const groups = [...byGroup.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, { key, measures }]) => ({
      key,
      value: combine(measures, reducer),
    }))
    .filter((g) => kind === GraphMetricKind.Gauge || !isEmpty(g.value));
  if (groups.length === 0) {
    return undefined;
  }

  const value = combine(
    groups.map((g) => g.value),
    reducer,
  );
  return grouped ? { value, groups } : { value };
}

/**
 * The consecutive periods over which {@link queryMonitoringMetric} reads a metric.
 */
export type MonitoringPeriods = {
  /**
   * The end of the last period.
   */
  readonly end: Date;

  /**
   * The length of each period, in seconds. It is at least {@link MIN_ALIGNMENT_PERIOD}.
   */
  readonly period: number;

  /**
   * The number of periods, ending at {@link MonitoringPeriods.end}.
   */
  readonly count: number;
};

/**
 * The result of {@link queryMonitoringMetric}.
 */
export type MonitoringQueryResult = {
  /**
   * The values for each period, keyed by node ID. A period without data is `undefined`.
   */
  readonly values: Map<string, (MonitoringPoint | undefined)[]>;

  /**
   * The names of the group keys of the values, when they are grouped.
   */
  readonly groupBy?: string[];

  /**
   * The time series that could not be read, e.g. in a project. The values of the nodes they measure are missing.
   */
  readonly errors: GraphWarning[];

  /**
   * Things worth reporting that don't affect the values, e.g. time series relating to resources missing from the graph.
   */
  readonly warnings: GraphWarning[];
};

/**
 * Optional restrictions on the values returned by {@link queryMonitoringMetric}.
 */
export type MonitoringQueryOptions = {
  /**
   * The IDs of the nodes for which values should be returned. Defaults to all the nodes measured by the metric.
   */
  readonly nodes?: readonly string[];
};

/**
 * Reads the values of a metric over consecutive periods from Cloud Monitoring, for the nodes of the graph it measures.
 * Time series are aligned over each period, and combined across the series of a node and group, within Cloud
 * Monitoring. Time series are read once per GCP project, and only those of the project are kept.
 * Metrics with {@link MonitoringMetric.groupByNode} mappings are also grouped by the nodes their time series relate to,
 * unless one of the mappings could not be prepared. Time series relating to resources that are not in the graph are
 * reported as warnings.
 *
 * @param environment The context of the environment, from which the Cloud Monitoring client and the resources of the
 *   graph are obtained.
 * @param metric The metric to read.
 * @param periods The periods over which the metric is read.
 * @param layouts The registry naming the bucket layouts of distributions.
 * @param options Restrictions on the nodes for which values are returned.
 * @returns The values for each node and period.
 */
export async function queryMonitoringMetric(
  environment: GraphEnvironmentContext,
  metric: MonitoringMetric,
  periods: MonitoringPeriods,
  layouts: BucketLayoutRegistry,
  options: MonitoringQueryOptions = {},
): Promise<MonitoringQueryResult> {
  const { CloudMonitoringService } =
    await import('../../services/cloud-monitoring.js');
  const { client } = environment.context.service(CloudMonitoringService);
  // Calls on a gax client crash the process when credentials cannot be loaded, while `initialize` rejects.
  await client.initialize();

  const { mapping } = metric;
  const { end, count } = periods;
  const period = Math.max(Math.round(periods.period), MIN_ALIGNMENT_PERIOD);
  const kind = monitoringMetricKind(metric);
  const errors: GraphWarning[] = [];

  const nodes = options.nodes && new Set(options.nodes);
  const measured = new Map(
    googleResources(environment, mapping.resourceType, mapping.nodeType)
      .filter(
        (r) =>
          (!nodes || nodes.has(r.node.id)) &&
          (!metric.measures || metric.measures(r.node, environment.graph)),
      )
      .map((r) => [r.name, r]),
  );

  // A mapping that could not be prepared is reported as a failure of the fact it depends on.
  const primary = await prepareMonitoringMapping(environment, mapping);
  if (!primary) {
    return { values: new Map(), errors, warnings: [] };
  }

  // Values are only grouped by node when all the mappings are prepared. Otherwise, a group without node could either
  // relate to a resource missing from the graph, or to one of a mapping that could not be prepared.
  const nodeMappings = metric.groupByNode ?? [];
  const preparedNodeMappings = await Promise.all(
    nodeMappings.map((m) => prepareMonitoringMapping(environment, m)),
  );
  const groupsByNode =
    nodeMappings.length > 0 && preparedNodeMappings.every((m) => !!m);
  const nodeResolvers: PreparedMonitoringMapping[] = groupsByNode
    ? (preparedNodeMappings as PreparedMonitoringMapping[])
    : [];

  // Time series relating to resources that are not in the graph are worth reporting, unlike the time series of other
  // resources of the metric, which are expected.
  const unmapped = new Set<string>();

  const groupByEntries = Object.entries(metric.groupBy ?? {});
  const groupBy = [
    ...groupByEntries.map(([name]) => name),
    ...(groupsByNode ? [NODE_GROUP_KEY] : []),
  ];
  const grouped = groupBy.length > 0;
  const endSeconds = Math.floor(end.getTime() / 1000);
  const request: ListTimeSeriesRequest = {
    interval: {
      startTime: { seconds: endSeconds - count * period },
      endTime: { seconds: endSeconds },
    },
    aggregation: {
      alignmentPeriod: { seconds: period },
      perSeriesAligner: metric.countRate ? 'ALIGN_DELTA' : ALIGNERS[kind],
      crossSeriesReducer: metric.reducer ?? 'REDUCE_SUM',
      groupByFields: [
        ...new Set([
          ...mapping.keyLabels,
          ...groupByEntries.map(([, label]) => label),
          ...nodeResolvers.flatMap(({ mapping }) => mapping.keyLabels),
        ]),
      ],
    },
    view: 'FULL',
  };
  const accumulated = new Map<
    string,
    Map<
      number,
      Map<
        string,
        { key: Record<string, string>; measures: GraphMetricMeasure[] }
      >
    >
  >();
  const succeededProjects = new Set<string>();

  const projects = new Set(
    [...measured.values()].map((r) => r.segments.projects),
  );
  for (const project of projects) {
    let series: TimeSeries[];
    try {
      [series] = await client.listTimeSeries({
        ...request,
        name: `projects/${project}`,
        // A project may be the scoping project of a metrics scope, whose time series include other projects'.
        filter: [
          `metric.type = "${metric.metricType}"`,
          `resource.type = "${mapping.monitoredResource}"`,
          `project = "${project}"`,
          ...(metric.filter ? [metric.filter] : []),
        ].join(' AND '),
      });
    } catch (error: any) {
      if (error.code === NOT_FOUND_CODE) {
        succeededProjects.add(project);
      } else {
        errors.push({
          message: `Failed to read the metric '${metric.metricType}' in project '${project}': ${error.message ?? error}`,
        });
      }

      continue;
    }

    succeededProjects.add(project);

    for (const timeSeries of series) {
      const read = (label: MonitoringLabel) => labelValue(timeSeries, label);
      const key = readMonitoringResourceKey(mapping, project, read);
      const name = key && primary.resolve(key);
      const node = name && measured.get(name)?.node.id;
      if (!node) {
        continue;
      }

      const groupKey: Record<string, string> = {};
      for (const [name, label] of groupByEntries) {
        const value = labelValue(timeSeries, label);
        if (value) {
          groupKey[name] = value;
        }
      }
      if (groupsByNode) {
        const { node: groupNode, missing } = findMonitoredNode(
          environment,
          nodeResolvers,
          project,
          read,
        );
        if (groupNode) {
          groupKey[NODE_GROUP_KEY] = groupNode.id;
        } else {
          missing.forEach(({ mapping, key, name }) => {
            const description = Object.entries(key.labels)
              .map(([label, value]) => `${label}=${value}`)
              .sort()
              .join(', ');
            unmapped.add(
              `The '${mapping.monitoredResource}' time series with ${description} relate to '${name}', which is not in the graph.`,
            );
          });
        }
      }
      const serializedGroupKey = JSON.stringify(groupKey);

      for (const point of timeSeries.points ?? []) {
        const pointEnd = toNumber(point.interval?.endTime?.seconds);
        const index = count - 1 - Math.round((endSeconds - pointEnd) / period);
        if (index < 0 || index >= count || !point.value) {
          continue;
        }

        const byIndex = accumulated.get(node) ?? new Map();
        accumulated.set(node, byIndex);
        const byGroup = byIndex.get(index) ?? new Map();
        byIndex.set(index, byGroup);
        const group = byGroup.get(serializedGroupKey) ?? {
          key: groupKey,
          measures: [],
        };
        byGroup.set(serializedGroupKey, group);
        group.measures.push(toMeasure(point.value, metric, period, layouts));
      }
    }
  }

  // Rates are 0 when nothing happened during a period, in which case Cloud Monitoring returns no point, or only empty
  // ones. Gauges and distributions without points are left missing, as there may simply be no sample during the period.
  const zero: MonitoringPoint | undefined =
    kind !== GraphMetricKind.Rate
      ? undefined
      : grouped
        ? { value: 0, groups: [] }
        : { value: 0 };
  const values = new Map<string, (MonitoringPoint | undefined)[]>();
  for (const { node, segments } of measured.values()) {
    const byIndex = accumulated.get(node.id);
    const succeeded = succeededProjects.has(segments.projects);
    if (!byIndex && (!zero || !succeeded)) {
      continue;
    }

    const points = Array.from({ length: count }, (_, index) => {
      const byGroup = byIndex?.get(index);
      const point = byGroup && toPoint(byGroup, metric, kind, grouped);
      return point ?? (succeeded ? zero : undefined);
    });
    values.set(node.id, points);
  }

  const warnings = [...unmapped].sort().map((message) => ({ message }));
  return { values, ...(grouped ? { groupBy } : {}), errors, warnings };
}

/**
 * The result of {@link queryPointInTimeMetrics}.
 */
export type PointInTimeMetrics = {
  /**
   * The values of the metrics, keyed by node ID.
   */
  readonly nodes: Record<string, GraphEnvironmentNodeOutput>;

  /**
   * The bucket layouts referenced by the distributions.
   */
  readonly bucketLayouts: GraphBucketLayoutsByName;

  /**
   * The warnings raised while reading the time series, or resolving the nodes of groups.
   */
  readonly warnings: GraphWarning[];
};

/**
 * Reads the values of metrics over the evaluation window of an enrichment, for all the nodes of the graph, using
 * {@link queryMonitoringMetric}.
 * The window ends at most {@link MONITORING_DATA_DELAY} before now, such that it only covers complete data.
 *
 * @param environment The context of the enrichment.
 * @param metrics The metrics to read.
 * @returns The values of the metrics for each node.
 */
export async function queryPointInTimeMetrics(
  environment: GraphEnvironmentContext,
  metrics: readonly MonitoringMetric[],
): Promise<PointInTimeMetrics> {
  const layouts = new BucketLayoutRegistry();
  const results = await Promise.all(
    metrics.map(async (metric) => ({
      metric,
      result: await queryMonitoringMetric(
        environment,
        metric,
        {
          end: monitoringEnd(environment.at),
          period: Math.max(environment.window, metric.minPeriod ?? 0),
          count: 1,
        },
        layouts,
      ),
    })),
  );

  const nodes: Record<string, { metrics: Record<string, GraphMetricValue> }> =
    {};
  for (const { metric, result } of results) {
    for (const [node, [point]] of result.values) {
      if (!point) {
        continue;
      }

      const { value, groups } = point;
      const { groupBy } = result;
      nodes[node] ??= { metrics: {} };
      nodes[node].metrics[metric.metric] =
        groups && groupBy ? { value, groupBy, groups } : { value };
    }
  }

  // Several metrics read from the same time series raise the same warnings, e.g. about resources not in the graph.
  const messages = new Set(
    results.flatMap(({ result }) =>
      [...result.errors, ...result.warnings].map((w) => w.message),
    ),
  );
  return {
    nodes,
    bucketLayouts: layouts.all,
    warnings: [...messages].map((message) => ({ message })),
  };
}

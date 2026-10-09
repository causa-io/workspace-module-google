import {
  GraphMetricKind,
  type GraphMetricMeasure,
  type GraphMetricSeries,
  type GraphMetricSeriesGroup,
} from '@causa/workspace-core';
import { GraphEnvironmentContext } from '@causa/workspace-core/graph';
import { monitoringMetricKind } from '../../graph/environment/monitoring-catalog.js';
import {
  MIN_ALIGNMENT_PERIOD,
  monitoringEnd,
  queryMonitoringMetric,
  type MonitoringPoint,
} from '../../graph/environment/monitoring-query.js';
import { BucketLayoutRegistry } from '../../graph/environment/monitoring-values.js';
import type { GraphFetchEnvironmentMetricSeriesForGoogle } from './fetch-environment-metric-series.js';

/**
 * The steps between points from which the default one is chosen, in seconds.
 */
const DEFAULT_STEPS = [
  60, 120, 300, 600, 900, 1800, 3600, 7200, 10800, 21600, 43200, 86400,
];

/**
 * The maximum number of points in a series when the step is chosen by default.
 */
const DEFAULT_MAX_POINTS = 300;

/**
 * Returns the default step for a series, as the smallest of {@link DEFAULT_STEPS} that results in at most
 * {@link DEFAULT_MAX_POINTS} points. For longer series, a whole number of days is used.
 *
 * @param duration The duration of the series, in seconds.
 * @returns The step, in seconds.
 */
function defaultStep(duration: number): number {
  const minimum = duration / DEFAULT_MAX_POINTS;
  const day = DEFAULT_STEPS[DEFAULT_STEPS.length - 1];
  return (
    DEFAULT_STEPS.find((step) => step >= minimum) ??
    Math.ceil(minimum / day) * day
  );
}

/**
 * The maximum number of points in a series.
 */
const MAX_POINTS = 10000;

export default async function call(
  this: GraphFetchEnvironmentMetricSeriesForGoogle,
): Promise<GraphMetricSeries> {
  const metric = this.findMetric();
  if (!metric) {
    throw new Error(
      `The metric '${this.metric}' of node '${this.node}' is not read from Cloud Monitoring.`,
    );
  }

  const { start: requestedStart } = this;
  if (isNaN(this.end.getTime()) || isNaN(requestedStart.getTime())) {
    throw new Error('The start and end of the series must be valid dates.');
  }

  const end = monitoringEnd(this.end);
  const duration = (end.getTime() - requestedStart.getTime()) / 1000;

  const requestedStep = this.step ?? defaultStep(duration);
  if (
    !Number.isInteger(requestedStep) ||
    requestedStep < MIN_ALIGNMENT_PERIOD
  ) {
    throw new Error(
      `The step must be a whole number of seconds, of at least ${MIN_ALIGNMENT_PERIOD} seconds.`,
    );
  }

  const requestedCount = Math.floor(duration / requestedStep);
  if (requestedCount < 1 || requestedCount > MAX_POINTS) {
    throw new Error(
      `The series must contain between 1 and ${MAX_POINTS} points, but contains ${Math.max(requestedCount, 0)}.`,
    );
  }

  // Metrics sampled less often than the step are read with a larger step, and at least one point, as for the
  // point-in-time value.
  const step = Math.max(requestedStep, metric.minPeriod ?? 0);
  const count =
    step === requestedStep
      ? requestedCount
      : Math.max(Math.floor(duration / step), 1);

  if (!this.graph.environment) {
    throw new Error(
      'The graph must be enriched with environment data to fetch a series.',
    );
  }

  const environment = await GraphEnvironmentContext.forEnrichedGraph(
    this._context,
    this.graph,
  );
  const layouts = new BucketLayoutRegistry();
  // Warnings, e.g. about time series relating to resources missing from the graph, don't affect the values.
  const { values, groupBy, errors } = await queryMonitoringMetric(
    environment,
    metric,
    { end, period: step, count },
    layouts,
    { nodes: [this.node] },
  );
  if (errors.length > 0) {
    throw new Error(errors.map((e) => e.message).join(' '));
  }

  const points: (MonitoringPoint | undefined)[] =
    values.get(this.node) ?? new Array(count).fill(undefined);
  const start = new Date(end.getTime() - count * step * 1000);
  return {
    start,
    step,
    values: points.map((p) => p?.value ?? null),
    ...(groupBy
      ? {
          groupBy,
          groups: seriesGroups(
            points,
            monitoringMetricKind(metric) === GraphMetricKind.Rate ? 0 : null,
          ),
        }
      : {}),
    bucketLayouts: layouts.all,
  };
}

/**
 * Returns the series of each group, from the points of the series.
 *
 * @param points The points of the series.
 * @param missing The value of a group in a period where the point exists but not the group, e.g. `0` for rates.
 * @returns The series of each group, sorted by key.
 */
function seriesGroups(
  points: (MonitoringPoint | undefined)[],
  missing: 0 | null,
): GraphMetricSeriesGroup[] {
  const groups = new Map<
    string,
    { key: Record<string, string>; values: (GraphMetricMeasure | null)[] }
  >();
  points.forEach((point, index) => {
    for (const { key, value } of point?.groups ?? []) {
      const serialized = JSON.stringify(key);
      const group = groups.get(serialized) ?? {
        key,
        values: points.map((p) => (p ? missing : null)),
      };
      groups.set(serialized, group);
      group.values[index] = value;
    }
  });

  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, group]) => group);
}

import type {
  GraphBucketLayoutsByName,
  GraphDistribution,
  GraphMetricMeasure,
} from '@causa/workspace-core';
import type { protos } from '@google-cloud/monitoring';
import type { MonitoringMetric } from './monitoring-catalog.js';

type TypedValue = protos.google.monitoring.v3.ITypedValue;
type Distribution = protos.google.api.IDistribution;

/**
 * The number of significant digits to which the bounds of buckets are rounded.
 * Computing bounds, e.g. `scale * growthFactor ** i`, leaves floating point noise in the last digits. Doubles guarantee
 * 15 significant digits. This leaves a margin for accumulated errors, while keeping more precision than bounds need.
 */
const BOUND_SIGNIFICANT_DIGITS = 12;

/**
 * Names the bucket layouts of distributions, such that distributions with the same bounds share a layout.
 */
export class BucketLayoutRegistry {
  /**
   * The registered layouts, keyed by name.
   */
  private readonly layouts: GraphBucketLayoutsByName = {};

  /**
   * Returns the name of the layout with the given bounds, registering it if needed.
   * Layouts are named after the metric type. Layouts of the same metric type with different bounds get a suffix.
   *
   * @param baseName The base name of the layout, e.g. the metric type.
   * @param bounds The bounds of the layout.
   * @returns The name of the layout.
   */
  register(baseName: string, bounds: number[]): string {
    const serialized = JSON.stringify(bounds);
    for (let index = 1; ; index++) {
      const name = index === 1 ? baseName : `${baseName}#${index}`;
      const existing = this.layouts[name];
      if (!existing) {
        this.layouts[name] = bounds;
        return name;
      }

      if (JSON.stringify(existing) === serialized) {
        return name;
      }
    }
  }

  /**
   * The registered layouts, keyed by name.
   */
  get all(): GraphBucketLayoutsByName {
    return { ...this.layouts };
  }
}

/**
 * Converts a protobuf number, which may be a string or a `Long` for 64-bit integers, to a number.
 */
export function toNumber(value: unknown): number {
  if (value === null || value === undefined) {
    return 0;
  }

  return typeof value === 'object' ? Number(value.toString()) : Number(value);
}

/**
 * Returns the bounds of the buckets of a Cloud Monitoring distribution.
 *
 * @param distribution The distribution.
 * @returns The bounds, or `undefined` if the bucket options are not supported.
 */
function distributionBounds(distribution: Distribution): number[] | undefined {
  const { linearBuckets, exponentialBuckets, explicitBuckets } =
    distribution.bucketOptions ?? {};
  if (linearBuckets) {
    const { numFiniteBuckets, width, offset } = linearBuckets;
    return Array.from(
      { length: (numFiniteBuckets ?? 0) + 1 },
      (_, i) => (offset ?? 0) + (width ?? 0) * i,
    );
  }

  if (exponentialBuckets) {
    const { numFiniteBuckets, growthFactor, scale } = exponentialBuckets;
    return Array.from(
      { length: (numFiniteBuckets ?? 0) + 1 },
      (_, i) => (scale ?? 0) * (growthFactor ?? 0) ** i,
    );
  }

  if (explicitBuckets?.bounds) {
    return [...explicitBuckets.bounds];
  }

  return undefined;
}

/**
 * A distribution read from Cloud Monitoring, whose layout is described by its bounds until it is named.
 */
export type MonitoringDistribution = Omit<GraphDistribution, 'layout'> & {
  /**
   * The bounds of the buckets, in the unit of the metric.
   */
  readonly bounds: number[];
};

/**
 * A value read from Cloud Monitoring, before the layouts of distributions are named.
 */
export type MonitoringMeasure = number | MonitoringDistribution;

/**
 * Converts a Cloud Monitoring distribution to a {@link MonitoringDistribution}.
 *
 * @param distribution The distribution.
 * @param scale The factor applied to the values.
 * @returns The distribution.
 */
function toMonitoringDistribution(
  distribution: Distribution,
  scale: number,
): MonitoringDistribution {
  const bounds = (distributionBounds(distribution) ?? []).map((b) =>
    Number((b * scale).toPrecision(BOUND_SIGNIFICANT_DIGITS)),
  );
  const count = toNumber(distribution.count);
  const buckets: Record<string, number> = {};
  (distribution.bucketCounts ?? []).forEach((bucketCount, index) => {
    const value = toNumber(bucketCount);
    if (value > 0) {
      buckets[index] = value;
    }
  });

  return {
    bounds,
    count,
    ...(count > 0 ? { mean: toNumber(distribution.mean) * scale } : {}),
    buckets,
  };
}

/**
 * Converts the value of a point to a {@link MonitoringMeasure}.
 *
 * @param value The value of the point.
 * @param metric The metric.
 * @param period The alignment period, in seconds.
 * @returns The measure.
 */
export function toMeasure(
  value: TypedValue,
  metric: MonitoringMetric,
  period: number,
): MonitoringMeasure {
  const scale = metric.scale ?? 1;
  if (value.distributionValue) {
    if (metric.countRate) {
      return toNumber(value.distributionValue.count) / period;
    }

    return toMonitoringDistribution(value.distributionValue, scale);
  }

  return toNumber(value.doubleValue ?? value.int64Value) * scale;
}

/**
 * Returns the bounds of the shortest layout of the distributions, if the bounds of all the other layouts start with
 * them.
 *
 * @param distributions The distributions.
 * @returns The bounds of the shortest layout, or `undefined` if there is no distribution, or if it is not a prefix of
 *   all the other layouts.
 */
function commonBounds(
  distributions: MonitoringDistribution[],
): number[] | undefined {
  if (distributions.length === 0) {
    return undefined;
  }

  const shortest = distributions
    .map((d) => d.bounds)
    .reduce((a, b) => (b.length < a.length ? b : a));
  return distributions.every(({ bounds }) =>
    shortest.every((bound, index) => bounds[index] === bound),
  )
    ? shortest
    : undefined;
}

/**
 * Moves the counts of the buckets past the last of the given bounds, which are a prefix of the layout of the buckets,
 * into the last bucket of the given bounds.
 *
 * @param buckets The counts of the buckets, keyed by index.
 * @param bounds The bounds of the layout to which the buckets are converted.
 * @returns The counts of the buckets in the layout.
 */
function foldBuckets(
  buckets: Record<string, number>,
  bounds: number[],
): Record<string, number> {
  // With N bounds, bucket N holds the values at or above the last bound.
  const last = bounds.length;
  const folded: Record<string, number> = {};
  for (const [index, count] of Object.entries(buckets)) {
    const target = Math.min(Number(index), last);
    folded[target] = (folded[target] ?? 0) + count;
  }

  return folded;
}

/**
 * Converts the measures read for a metric to {@link GraphMetricMeasure}s, naming the layouts of distributions.
 * The layout of a metric may gain buckets over time, e.g. for the latencies of Cloud Run requests, in which case periods
 * spanning the change return distributions with both layouts. When the bounds of all the layouts start with the bounds
 * of the shortest one, all the distributions are converted to the shortest layout, which only loses the detail of the
 * buckets past its last bound. Otherwise, each distribution keeps its own layout.
 *
 * @param measures All the measures read for the metric.
 * @param baseName The base name of the layouts, e.g. the metric type.
 * @param layouts The registry naming the layouts.
 * @returns The converted measures, in the same order.
 */
export function toGraphMeasures(
  measures: MonitoringMeasure[],
  baseName: string,
  layouts: BucketLayoutRegistry,
): GraphMetricMeasure[] {
  const common = commonBounds(
    measures.filter((m): m is MonitoringDistribution => typeof m !== 'number'),
  );

  return measures.map((measure) => {
    if (typeof measure === 'number') {
      return measure;
    }

    const { bounds, buckets, ...distribution } = measure;
    return {
      layout: layouts.register(baseName, common ?? bounds),
      ...distribution,
      buckets: common ? foldBuckets(buckets, common) : buckets,
    };
  });
}

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
 * Converts a Cloud Monitoring distribution to a {@link GraphDistribution}.
 *
 * @param distribution The distribution.
 * @param scale The factor applied to the values.
 * @param layoutBaseName The base name of the layout.
 * @param layouts The registry of layouts.
 * @returns The distribution.
 */
function toGraphDistribution(
  distribution: Distribution,
  scale: number,
  layoutBaseName: string,
  layouts: BucketLayoutRegistry,
): GraphDistribution {
  const bounds = (distributionBounds(distribution) ?? []).map((b) =>
    Number((b * scale).toPrecision(BOUND_SIGNIFICANT_DIGITS)),
  );
  const layout = layouts.register(layoutBaseName, bounds);
  const count = toNumber(distribution.count);
  const buckets: Record<string, number> = {};
  (distribution.bucketCounts ?? []).forEach((bucketCount, index) => {
    const value = toNumber(bucketCount);
    if (value > 0) {
      buckets[index] = value;
    }
  });

  return {
    layout,
    count,
    ...(count > 0 ? { mean: toNumber(distribution.mean) * scale } : {}),
    buckets,
  };
}

/**
 * Converts the value of a point to a {@link GraphMetricMeasure}.
 *
 * @param value The value of the point.
 * @param metric The metric.
 * @param period The alignment period, in seconds.
 * @param layouts The registry of layouts.
 * @returns The measure.
 */
export function toMeasure(
  value: TypedValue,
  metric: MonitoringMetric,
  period: number,
  layouts: BucketLayoutRegistry,
): GraphMetricMeasure {
  const scale = metric.scale ?? 1;
  if (value.distributionValue) {
    if (metric.countRate) {
      return toNumber(value.distributionValue.count) / period;
    }

    return toGraphDistribution(
      value.distributionValue,
      scale,
      metric.metricType,
      layouts,
    );
  }

  return toNumber(value.doubleValue ?? value.int64Value) * scale;
}

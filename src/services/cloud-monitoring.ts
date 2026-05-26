import { WorkspaceContext } from '@causa/workspace';
import { MetricServiceClient } from '@google-cloud/monitoring';
import type { GoogleConfiguration } from '../configurations/index.js';

/**
 * A single metric point with its server-side end timestamp (as milliseconds since epoch) and numeric value.
 */
export type MetricPoint = {
  /**
   * The end timestamp of the point's interval, as milliseconds since epoch.
   */
  readonly timestamp: number;

  /**
   * The numeric value of the point.
   */
  readonly value: number;
};

/**
 * A service exposing a thin wrapper around the Cloud Monitoring API.
 */
export class CloudMonitoringService {
  /**
   * The underlying Cloud Monitoring client.
   */
  readonly client: MetricServiceClient;

  /**
   * The ID of the GCP project from which metrics are read.
   */
  readonly projectId: string;

  constructor(context: WorkspaceContext) {
    this.projectId = context
      .asConfiguration<GoogleConfiguration>()
      .getOrThrow('google.project');
    this.client = new MetricServiceClient();
  }

  /**
   * Fetches the data points for a single time series over the given time interval.
   * Returns the points sorted in ascending timestamp order. Each point's timestamp is the end of the corresponding
   * interval, in milliseconds since epoch. An empty array is returned when no series matches the filter.
   *
   * @param filter The Cloud Monitoring metric filter expression (e.g. `metric.type = "..."`).
   * @param start The inclusive lower bound of the interval to fetch.
   * @param end The exclusive upper bound of the interval to fetch.
   * @param options Optional aggregation options.
   * @returns The list of points, ordered by ascending timestamp.
   */
  async listPoints(
    filter: string,
    start: Date,
    end: Date,
    options: {
      readonly alignmentPeriod?: number;
      readonly aligner?:
        | 'ALIGN_NONE'
        | 'ALIGN_DELTA'
        | 'ALIGN_RATE'
        | 'ALIGN_MEAN'
        | 'ALIGN_MAX';
    } = {},
  ): Promise<MetricPoint[]> {
    const aggregation =
      options.aligner && options.alignmentPeriod
        ? {
            alignmentPeriod: { seconds: options.alignmentPeriod },
            perSeriesAligner: options.aligner,
          }
        : undefined;
    const [series] = await this.client.listTimeSeries({
      name: `projects/${this.projectId}`,
      filter,
      interval: {
        startTime: { seconds: Math.floor(start.getTime() / 1000) },
        endTime: { seconds: Math.floor(end.getTime() / 1000) },
      },
      aggregation,
    });

    return (series.at(0)?.points ?? [])
      .map(({ interval, value: rawValue }) => {
        const endSeconds = Number(interval?.endTime?.seconds ?? 0);
        const endNanos = interval?.endTime?.nanos ?? 0;
        const timestamp = endSeconds * 1000 + Math.floor(endNanos / 1e6);
        const value = Number(
          rawValue?.int64Value ??
            rawValue?.doubleValue ??
            rawValue?.distributionValue?.count ??
            0,
        );
        return { timestamp, value };
      })
      .sort((a, b) => a.timestamp - b.timestamp);
  }
}

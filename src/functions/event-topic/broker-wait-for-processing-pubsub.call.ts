import type { WorkspaceContext } from '@causa/workspace';
import { setTimeout } from 'timers/promises';
import {
  CloudMonitoringService,
  type MetricPoint,
} from '../../services/cloud-monitoring.js';
import {
  PUBSUB_SUBSCRIPTION_ID_REGEX,
  shortSubscriptionId,
} from '../../services/index.js';
import type { EventTopicBrokerWaitForProcessingForPubSub } from './broker-wait-for-processing-pubsub.js';

/**
 * The interval between two consecutive polls of the Cloud Monitoring API, in milliseconds.
 */
const POLL_INTERVAL = 30 * 1000;

/**
 * The duration of the trailing window of points fetched on each poll, in milliseconds.
 * It must be greater than `QUIET_WINDOW` plus a margin for the Cloud Monitoring export lag.
 */
const TRAILING_WINDOW = 10 * 60 * 1000;

/**
 * The minimum duration (server-time, derived from point timestamps) over which all three monitored metrics must
 * continuously report zero before a subscription is considered drained, in milliseconds.
 */
const QUIET_WINDOW = 3 * 60 * 1000;

/**
 * The alignment period used when querying the cumulative `ack_message_count` metric so that points represent the
 * number of acks within each bucket (delta), rather than the absolute cumulative value, in seconds.
 */
const ALIGNMENT_PERIOD = 60;

/**
 * The overall timeout for waiting on a single subscription, in milliseconds.
 * On timeout the function throws so that the backfill file is preserved for manual cleanup.
 */
const TIMEOUT = 60 * 60 * 1000;

/**
 * Returns the Cloud Monitoring filter for the given metric on the given subscription.
 */
function buildFilter(metricType: string, subscriptionId: string): string {
  return [
    `metric.type = "${metricType}"`,
    `resource.type = "pubsub_subscription"`,
    `resource.labels.subscription_id = "${subscriptionId}"`,
  ].join(' AND ');
}

/**
 * Checks whether a gauge metric has been quiet (zero-valued) for at least {@link QUIET_WINDOW}.
 *
 * The check is purely server-side: the latest zero-valued point's timestamp must be at least `QUIET_WINDOW` after the
 * latest non-zero point's timestamp. When no non-zero point exists in the trailing window, the metric is considered
 * quiet (the outer liftoff gate is responsible for distinguishing "cold start" from "already drained").
 */
function isGaugeQuiet(points: readonly MetricPoint[]): boolean {
  const lastNonZeroTimestamp =
    points.filter(({ value }) => value > 0).at(-1)?.timestamp ?? -Infinity;
  const latestZeroTimestamp =
    points.filter(({ value }) => value === 0).at(-1)?.timestamp ?? -Infinity;
  return latestZeroTimestamp - lastNonZeroTimestamp >= QUIET_WINDOW;
}

/**
 * Checks whether a cumulative metric (queried with `ALIGN_DELTA`) has had no non-zero activity in the trailing
 * `QUIET_WINDOW` before the given reference time.
 *
 * Unlike a gauge, Pub/Sub stops writing samples for a cumulative metric while there is no activity. The server-side
 * "still has zero points" anchor used by {@link isGaugeQuiet} therefore does not apply: the absence of points must be
 * interpreted against an external time reference (the query end).
 */
function isCumulativeQuiet(
  points: readonly MetricPoint[],
  referenceTime: Date,
): boolean {
  const lastNonZeroTimestamp =
    points.filter(({ value }) => value > 0).at(-1)?.timestamp ?? -Infinity;
  return referenceTime.getTime() - lastNonZeroTimestamp >= QUIET_WINDOW;
}

/**
 * Result of a single observation of a subscription's metrics.
 */
type SubscriptionObservation = {
  /**
   * Whether any non-zero `ack_message_count` delta point was observed in the trailing window.
   * This is the proof that messages actually flowed through the subscription.
   */
  readonly liftoff: boolean;

  /**
   * The current backlog as reported by the latest `num_undelivered_messages` sample, or `null` when no sample is
   * available yet.
   */
  readonly backlog: number | null;

  /**
   * Whether the subscription is drained, i.e. the liftoff evidence is present and all three monitored metrics have
   * been quiet for the required window.
   */
  readonly drained: boolean;
};

/**
 * Observes a single subscription by fetching its three metrics over the configured trailing window and evaluating the
 * liftoff and quiet conditions.
 */
async function observeSubscription(
  context: WorkspaceContext,
  subscriptionId: string,
): Promise<SubscriptionObservation> {
  const cms = context.service(CloudMonitoringService);
  const end = new Date();
  const start = new Date(end.getTime() - TRAILING_WINDOW);

  const ackFilter = buildFilter(
    'pubsub.googleapis.com/subscription/ack_message_count',
    subscriptionId,
  );
  const backlogFilter = buildFilter(
    'pubsub.googleapis.com/subscription/num_undelivered_messages',
    subscriptionId,
  );
  const ageFilter = buildFilter(
    'pubsub.googleapis.com/subscription/oldest_unacked_message_age',
    subscriptionId,
  );

  const [ackPoints, backlogPoints, agePoints] = await Promise.all([
    cms.listPoints(ackFilter, start, end, {
      aligner: 'ALIGN_DELTA',
      alignmentPeriod: ALIGNMENT_PERIOD,
    }),
    cms.listPoints(backlogFilter, start, end),
    cms.listPoints(ageFilter, start, end),
  ]);

  const liftoff = ackPoints.some(({ value }) => value > 0);
  const backlog = backlogPoints.at(-1)?.value ?? null;
  const drained =
    liftoff &&
    isCumulativeQuiet(ackPoints, end) &&
    isGaugeQuiet(backlogPoints) &&
    isGaugeQuiet(agePoints);

  return { liftoff, backlog, drained };
}

/**
 * Waits for a single subscription to be drained, polling Cloud Monitoring until either the drained state is reached
 * or the overall timeout elapses.
 */
async function waitForSubscription(
  context: WorkspaceContext,
  subscriptionId: string,
): Promise<void> {
  const deadline = Date.now() + TIMEOUT;

  while (true) {
    const { drained, backlog, liftoff } = await observeSubscription(
      context,
      subscriptionId,
    );

    if (drained) {
      context.logger.debug(
        `✅ Subscription '${subscriptionId}' drained: backlog is empty and metrics have been quiet for at least ${QUIET_WINDOW / 1000}s.`,
      );
      return;
    }

    const backlogLabel =
      backlog === null ? 'no data yet' : `backlog=${backlog}`;
    context.logger.debug(
      `⏳ Subscription '${subscriptionId}' not drained yet (liftoff=${liftoff}, ${backlogLabel}).`,
    );

    if (Date.now() >= deadline) {
      throw new Error(
        `Timed out after ${Math.round(TIMEOUT / 60_000)} minute(s) waiting for subscription '${subscriptionId}' to drain.`,
      );
    }

    await setTimeout(POLL_INTERVAL);
  }
}

export default async function call(
  this: EventTopicBrokerWaitForProcessingForPubSub,
): Promise<void> {
  const subscriptionIds = this.temporaryData.temporaryTriggerResourceIds
    .filter((id) => PUBSUB_SUBSCRIPTION_ID_REGEX.test(id))
    .map(shortSubscriptionId);

  if (subscriptionIds.length === 0) {
    throw new Error(
      `Cannot wait for processing of backfill on event topic '${this.eventTopic}': no temporary Pub/Sub subscription was created. Only backfills with temporary triggers are supported.`,
    );
  }

  this._context.logger.info(
    `⏳ Waiting for processing of ${subscriptionIds.length} temporary Pub/Sub subscription(s) for event topic '${this.eventTopic}'.`,
  );

  await Promise.all(
    subscriptionIds.map((id) => waitForSubscription(this._context, id)),
  );

  this._context.logger.info(
    `✅ All temporary Pub/Sub subscriptions for event topic '${this.eventTopic}' have been drained.`,
  );
}

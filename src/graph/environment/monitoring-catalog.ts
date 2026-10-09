import {
  GraphMetricKind,
  type Graph,
  type GraphMetricDefinitionsByType,
} from '@causa/workspace-core';
import {
  CORE_GRAPH_METRIC_DEFINITIONS,
  type GraphNodeEntry,
} from '@causa/workspace-core/graph';
import {
  LOAD_BALANCER_BACKEND_MAPPINGS,
  URL_MAP_MAPPING,
} from './load-balancer-backends.js';
import {
  templateMapping,
  type MonitoringLabel,
  type MonitoringResourceMapping,
} from './monitoring-mappings.js';

export const CLOUD_RUN_SERVICE_MAPPING = templateMapping({
  nodeType: 'service',
  resourceType: 'run.googleapis.com/Service',
  monitoredResource: 'cloud_run_revision',
  name: 'projects/{project}/locations/{resource.label.location}/services/{resource.label.service_name}',
});

export const PUBSUB_TOPIC_MAPPING = templateMapping({
  nodeType: 'brokerTopic',
  resourceType: 'pubsub.googleapis.com/Topic',
  monitoredResource: 'pubsub_topic',
  name: 'projects/{project}/topics/{resource.label.topic_id}',
});

export const PUBSUB_SUBSCRIPTION_MAPPING = templateMapping({
  nodeType: 'brokerSubscription',
  resourceType: 'pubsub.googleapis.com/Subscription',
  monitoredResource: 'pubsub_subscription',
  name: 'projects/{project}/subscriptions/{resource.label.subscription_id}',
});

export const CLOUD_TASKS_QUEUE_MAPPING = templateMapping({
  nodeType: 'queue',
  resourceType: 'cloudtasks.googleapis.com/Queue',
  monitoredResource: 'cloud_tasks_queue',
  name: 'projects/{project}/locations/{resource.label.location}/queues/{resource.label.queue_id}',
});

export const SPANNER_INSTANCE_MAPPING = templateMapping({
  nodeType: 'google.spanner.instance',
  resourceType: 'spanner.googleapis.com/Instance',
  monitoredResource: 'spanner_instance',
  name: 'projects/{project}/instances/{resource.label.instance_id}',
});

export const SPANNER_DATABASE_MAPPING = templateMapping({
  nodeType: 'database',
  resourceType: 'spanner.googleapis.com/Database',
  monitoredResource: 'spanner_instance',
  name: 'projects/{project}/instances/{resource.label.instance_id}/databases/{metric.label.database}',
});

export const FIRESTORE_DATABASE_MAPPING = templateMapping({
  nodeType: 'database',
  resourceType: 'firestore.googleapis.com/Database',
  monitoredResource: 'firestore.googleapis.com/Database',
  name: 'projects/{project}/databases/{resource.label.database_id}',
});

export const BIGQUERY_DATASET_MAPPING = templateMapping({
  nodeType: 'database',
  resourceType: 'bigquery.googleapis.com/Dataset',
  monitoredResource: 'bigquery_dataset',
  name: 'projects/{project}/datasets/{resource.label.dataset_id}',
});

export const CLOUD_SCHEDULER_JOB_MAPPING = templateMapping({
  nodeType: 'scheduledJob',
  resourceType: 'cloudscheduler.googleapis.com/Job',
  monitoredResource: 'cloud_scheduler_job',
  name: 'projects/{project}/locations/{resource.label.location}/jobs/{resource.label.job_id}',
});

/**
 * All the mappings of Cloud Monitoring monitored resources to the resources of nodes.
 */
export const MONITORING_RESOURCE_MAPPINGS: readonly MonitoringResourceMapping[] =
  [
    CLOUD_RUN_SERVICE_MAPPING,
    PUBSUB_TOPIC_MAPPING,
    PUBSUB_SUBSCRIPTION_MAPPING,
    CLOUD_TASKS_QUEUE_MAPPING,
    SPANNER_INSTANCE_MAPPING,
    SPANNER_DATABASE_MAPPING,
    FIRESTORE_DATABASE_MAPPING,
    BIGQUERY_DATASET_MAPPING,
    ...LOAD_BALANCER_BACKEND_MAPPINGS,
    URL_MAP_MAPPING,
    CLOUD_SCHEDULER_JOB_MAPPING,
  ];

/**
 * A metric of a node type, read from Cloud Monitoring.
 */
export type MonitoringMetric = {
  /**
   * The name of the metric in the graph.
   */
  readonly metric: string;

  /**
   * How the time series of the metric map to the nodes it measures.
   */
  readonly mapping: MonitoringResourceMapping;

  /**
   * The Cloud Monitoring metric type.
   */
  readonly metricType: string;

  /**
   * An additional filter on the time series.
   */
  readonly filter?: string;

  /**
   * How time series of the same node and group are combined. Defaults to `REDUCE_SUM`.
   */
  readonly reducer?: 'REDUCE_SUM' | 'REDUCE_MAX';

  /**
   * The labels of the time series by which values are grouped, keyed by the name of the group key in the graph.
   */
  readonly groupBy?: Record<string, MonitoringLabel>;

  /**
   * How the time series of the metric map to other nodes the values relate to, e.g. the services load balancers route
   * requests to. Values are also grouped by the `node` key, whose values are node IDs. The mappings are tried from the
   * one with the most key labels, and share the monitored resource of {@link MonitoringMetric.mapping}.
   */
  readonly groupByNode?: readonly MonitoringResourceMapping[];

  /**
   * The factor applied to values, e.g. to convert microseconds to milliseconds. Defaults to `1`.
   */
  readonly scale?: number;

  /**
   * Whether the value is the number of values in the distribution, per second.
   */
  readonly countRate?: boolean;

  /**
   * The minimum alignment period, in seconds, for metrics sampled less often than the evaluation window.
   */
  readonly minPeriod?: number;

  /**
   * Whether the metric measures the resource of a node, when it doesn't measure all the resources of its mapping.
   * Nodes for which it returns `false` get no value, and their series are not supported. Defaults to all nodes.
   *
   * @param node The node.
   * @param graph The graph containing the node.
   * @returns Whether the metric measures the node.
   */
  readonly measures?: (node: GraphNodeEntry, graph: Graph) => boolean;
};

/**
 * Returns whether a subscription pushes messages to a service, rather than e.g. writing them to a table.
 *
 * @param node The node of the subscription.
 * @param graph The graph containing the node.
 * @returns `true` if the subscription targets a service.
 */
export function isPushSubscription(
  node: GraphNodeEntry,
  graph: Graph,
): boolean {
  return (graph.edges?.targets ?? []).some(
    (edge) => edge.from === node.id && !!edge.to?.startsWith('service:'),
  );
}

const CODE = 'code';
const METHOD = 'method';

/**
 * The metrics read from Cloud Monitoring.
 */
export const MONITORING_METRICS: readonly MonitoringMetric[] = [
  {
    metric: 'requests',
    mapping: CLOUD_RUN_SERVICE_MAPPING,
    metricType: 'run.googleapis.com/request_count',
    groupBy: { [CODE]: 'metric.label.response_code_class' },
  },
  {
    metric: 'latency',
    mapping: CLOUD_RUN_SERVICE_MAPPING,
    metricType: 'run.googleapis.com/request_latencies',
    groupBy: { [CODE]: 'metric.label.response_code_class' },
  },
  {
    metric: 'instances',
    mapping: CLOUD_RUN_SERVICE_MAPPING,
    metricType: 'run.googleapis.com/container/instance_count',
    filter: 'metric.label.state = "active"',
  },
  {
    metric: 'cpuUtilization',
    mapping: CLOUD_RUN_SERVICE_MAPPING,
    metricType: 'run.googleapis.com/container/cpu/utilizations',
    scale: 100,
  },
  {
    metric: 'memoryUtilization',
    mapping: CLOUD_RUN_SERVICE_MAPPING,
    metricType: 'run.googleapis.com/container/memory/utilizations',
    scale: 100,
  },
  {
    metric: 'concurrency',
    mapping: CLOUD_RUN_SERVICE_MAPPING,
    metricType: 'run.googleapis.com/container/max_request_concurrencies',
    // Idle instances serve no request, and would pull the distribution down.
    filter: 'metric.label.state = "active"',
  },
  {
    metric: 'errorLogs',
    mapping: CLOUD_RUN_SERVICE_MAPPING,
    metricType: 'logging.googleapis.com/log_entry_count',
    filter:
      'metric.label.severity = one_of("ERROR", "CRITICAL", "ALERT", "EMERGENCY")',
  },
  {
    metric: 'requests',
    mapping: URL_MAP_MAPPING,
    metricType: 'loadbalancing.googleapis.com/https/request_count',
    groupBy: { [CODE]: 'metric.label.response_code_class' },
    groupByNode: LOAD_BALANCER_BACKEND_MAPPINGS,
  },
  {
    metric: 'latency',
    mapping: URL_MAP_MAPPING,
    metricType: 'loadbalancing.googleapis.com/https/total_latencies',
    groupBy: { [CODE]: 'metric.label.response_code_class' },
    groupByNode: LOAD_BALANCER_BACKEND_MAPPINGS,
  },
  {
    metric: 'backendLatency',
    mapping: URL_MAP_MAPPING,
    metricType: 'loadbalancing.googleapis.com/https/backend_latencies',
    groupBy: { [CODE]: 'metric.label.response_code_class' },
    groupByNode: LOAD_BALANCER_BACKEND_MAPPINGS,
  },
  {
    metric: 'published',
    mapping: PUBSUB_TOPIC_MAPPING,
    metricType: 'pubsub.googleapis.com/topic/message_sizes',
    countRate: true,
  },
  {
    metric: 'publishRequests',
    mapping: PUBSUB_TOPIC_MAPPING,
    metricType: 'pubsub.googleapis.com/topic/send_request_count',
    groupBy: { [CODE]: 'metric.label.response_class' },
  },
  {
    metric: 'publishLatency',
    mapping: PUBSUB_TOPIC_MAPPING,
    metricType: 'pubsub.googleapis.com/topic/send_request_latencies',
    scale: 0.001,
  },
  {
    metric: 'messageSize',
    mapping: PUBSUB_TOPIC_MAPPING,
    metricType: 'pubsub.googleapis.com/topic/message_sizes',
  },
  {
    metric: 'backlog',
    mapping: PUBSUB_SUBSCRIPTION_MAPPING,
    metricType: 'pubsub.googleapis.com/subscription/num_undelivered_messages',
  },
  {
    metric: 'backlogAge',
    mapping: PUBSUB_SUBSCRIPTION_MAPPING,
    metricType: 'pubsub.googleapis.com/subscription/oldest_unacked_message_age',
    reducer: 'REDUCE_MAX',
  },
  {
    metric: 'delivered',
    mapping: PUBSUB_SUBSCRIPTION_MAPPING,
    metricType: 'pubsub.googleapis.com/subscription/sent_message_count',
  },
  {
    metric: 'acked',
    mapping: PUBSUB_SUBSCRIPTION_MAPPING,
    metricType: 'pubsub.googleapis.com/subscription/ack_message_count',
    // Messages not matching the subscription's filter are acknowledged by Pub/Sub, without being delivered.
    filter: 'metric.label.delivery_type != "filter"',
  },
  {
    metric: 'pushRequests',
    mapping: PUBSUB_SUBSCRIPTION_MAPPING,
    metricType: 'pubsub.googleapis.com/subscription/push_request_count',
    groupBy: { [CODE]: 'metric.label.response_class' },
    measures: isPushSubscription,
  },
  {
    metric: 'pushLatency',
    mapping: PUBSUB_SUBSCRIPTION_MAPPING,
    metricType: 'pubsub.googleapis.com/subscription/push_request_latencies',
    groupBy: { [CODE]: 'metric.label.response_code' },
    scale: 0.001,
    measures: isPushSubscription,
  },
  {
    metric: 'backlog',
    mapping: CLOUD_TASKS_QUEUE_MAPPING,
    metricType: 'cloudtasks.googleapis.com/queue/depth',
  },
  {
    metric: 'published',
    mapping: CLOUD_TASKS_QUEUE_MAPPING,
    metricType: 'cloudtasks.googleapis.com/api/request_count',
    filter: 'metric.label.api_method = "CreateTask"',
    groupBy: { [CODE]: 'metric.label.response_code' },
  },
  {
    metric: 'pushRequests',
    mapping: CLOUD_TASKS_QUEUE_MAPPING,
    metricType: 'cloudtasks.googleapis.com/queue/task_attempt_count',
    groupBy: { [CODE]: 'metric.label.response_code' },
  },
  {
    metric: 'dispatchDelay',
    mapping: CLOUD_TASKS_QUEUE_MAPPING,
    metricType: 'cloudtasks.googleapis.com/queue/task_attempt_delays',
  },
  {
    metric: 'cpuUtilization',
    mapping: SPANNER_INSTANCE_MAPPING,
    metricType: 'spanner.googleapis.com/instance/cpu/utilization',
    scale: 100,
  },
  {
    metric: 'storageUtilization',
    mapping: SPANNER_INSTANCE_MAPPING,
    metricType: 'spanner.googleapis.com/instance/storage/utilization',
    reducer: 'REDUCE_MAX',
    scale: 100,
  },
  {
    metric: 'nodes',
    mapping: SPANNER_INSTANCE_MAPPING,
    metricType: 'spanner.googleapis.com/instance/processing_units',
    reducer: 'REDUCE_MAX',
    scale: 0.001,
  },
  {
    metric: 'requests',
    mapping: SPANNER_DATABASE_MAPPING,
    metricType: 'spanner.googleapis.com/api/api_request_count',
    groupBy: {
      [METHOD]: 'metric.label.method',
      [CODE]: 'metric.label.status',
    },
  },
  {
    metric: 'latency',
    mapping: SPANNER_DATABASE_MAPPING,
    metricType: 'spanner.googleapis.com/api/request_latencies',
    groupBy: { [METHOD]: 'metric.label.method' },
    scale: 1000,
  },
  {
    metric: 'storage',
    mapping: SPANNER_DATABASE_MAPPING,
    metricType: 'spanner.googleapis.com/instance/storage/used_bytes',
  },
  {
    metric: 'cpuUtilization',
    mapping: SPANNER_DATABASE_MAPPING,
    metricType: 'spanner.googleapis.com/instance/cpu/utilization',
    scale: 100,
  },
  {
    metric: 'requests',
    mapping: FIRESTORE_DATABASE_MAPPING,
    metricType: 'firestore.googleapis.com/api/request_count',
    groupBy: {
      [METHOD]: 'metric.label.api_method',
      [CODE]: 'metric.label.response_code',
    },
  },
  {
    metric: 'latency',
    mapping: FIRESTORE_DATABASE_MAPPING,
    metricType: 'firestore.googleapis.com/api/request_latencies',
    groupBy: { [METHOD]: 'metric.label.api_method' },
    scale: 1000,
  },
  {
    metric: 'storage',
    mapping: FIRESTORE_DATABASE_MAPPING,
    metricType: 'firestore.googleapis.com/storage/data_and_index_storage_bytes',
    // Sampled every minute, but written hours late, and in stretches separated by gaps of up to 13 hours.
    minPeriod: 24 * 3600,
  },
  {
    metric: 'storage',
    mapping: BIGQUERY_DATASET_MAPPING,
    metricType: 'bigquery.googleapis.com/storage/stored_bytes',
    // Sampled every 30 minutes, and visible up to 3 hours later.
    minPeriod: 4 * 3600,
  },
];

/**
 * The definitions of the metrics of the node types defined by the Google module.
 */
export const GOOGLE_GRAPH_METRIC_DEFINITIONS: GraphMetricDefinitionsByType = {
  'google.spanner.instance': {
    cpuUtilization: {
      name: 'CPU utilization',
      description: 'CPU utilization of the instance, across all databases.',
      kind: GraphMetricKind.Gauge,
      unit: '%',
    },
    storageUtilization: {
      name: 'Storage utilization',
      description:
        'Storage used, as a percentage of the limit of the provisioned capacity.',
      kind: GraphMetricKind.Gauge,
      unit: '%',
    },
    nodes: {
      name: 'Nodes',
      description:
        'Provisioned compute capacity, where 1,000 processing units make a node.',
      kind: GraphMetricKind.Gauge,
      unit: '{node}',
    },
  },
};

/**
 * Returns the kind of a metric read from Cloud Monitoring, from its definition for the type of its nodes.
 *
 * @param metric The metric.
 * @returns The kind of the metric.
 */
export function monitoringMetricKind(
  metric: MonitoringMetric,
): GraphMetricKind {
  const { nodeType } = metric.mapping;
  const definition =
    CORE_GRAPH_METRIC_DEFINITIONS[nodeType]?.[metric.metric] ??
    GOOGLE_GRAPH_METRIC_DEFINITIONS[nodeType]?.[metric.metric];
  if (!definition) {
    throw new Error(
      `The metric '${metric.metric}' of node type '${nodeType}' has no definition.`,
    );
  }

  return definition.kind;
}

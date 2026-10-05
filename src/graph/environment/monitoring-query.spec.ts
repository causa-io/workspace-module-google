import type {
  GraphEnvironmentContext,
  GraphEnvironmentFactType,
} from '@causa/workspace-core/graph';
import { jest } from '@jest/globals';
import 'jest-extended';
import {
  CloudMonitoringService,
  GoogleApisService,
} from '../../services/index.js';
import { AT, makeContext, makeEnvironment } from './fixture.test.js';
import {
  LOAD_BALANCER_BACKEND_MAPPINGS,
  LoadBalancerBackendsFact,
  SERVERLESS_NEG_BACKENDS,
  URL_MAP_MAPPING,
  type LoadBalancerBackend,
} from './load-balancer-backends.js';
import {
  CLOUD_RUN_SERVICE_MAPPING,
  CLOUD_TASKS_QUEUE_MAPPING,
  PUBSUB_SUBSCRIPTION_MAPPING,
  PUBSUB_TOPIC_MAPPING,
  type MonitoringMetric,
} from './monitoring-catalog.js';
import { queryMonitoringMetric } from './monitoring-query.js';
import { BucketLayoutRegistry } from './monitoring-values.js';

const END_SECONDS = AT.getTime() / 1000;

const point = (value: object, endSeconds = END_SECONDS) => ({
  interval: { endTime: { seconds: `${endSeconds}` } },
  value,
});

const backend = (name: string, service: string): LoadBalancerBackend => ({
  kind: SERVERLESS_NEG_BACKENDS,
  project: 'my-project',
  labels: {
    'resource.label.backend_scope': 'europe-west1',
    'resource.label.backend_name': name,
  },
  resource: `projects/my-project/locations/europe-west1/services/${service}`,
});

const BACKENDS: LoadBalancerBackend[] = [
  backend('run-ordering-api', 'ordering-api'),
  backend('run-ordering-api-2', 'ordering-api'),
  backend('run-other', 'other'),
];

const requests: MonitoringMetric = {
  metric: 'requests',
  mapping: CLOUD_RUN_SERVICE_MAPPING,
  metricType: 'run.googleapis.com/request_count',
  groupBy: { code: 'metric.label.response_code_class' },
};

describe('queryMonitoringMetric', () => {
  let listTimeSeries: jest.Mock<(...args: any[]) => Promise<any>>;
  let environment: GraphEnvironmentContext;
  let layouts: BucketLayoutRegistry;

  /**
   * Creates the context of the environment, with the given backends of load balancers, or with backends that cannot be
   * listed.
   */
  async function makeQueryEnvironment(
    backends: LoadBalancerBackend[] | 'failing' = BACKENDS,
  ): Promise<GraphEnvironmentContext> {
    const context = makeContext();
    const { client } = context.service(CloudMonitoringService);
    jest.spyOn(client, 'initialize').mockResolvedValue({});
    jest
      .spyOn(client, 'listTimeSeries')
      .mockImplementation(listTimeSeries as any);
    jest
      .spyOn(context.service(GoogleApisService), 'getClient')
      .mockRejectedValue(new Error('💥'));
    const facts: [GraphEnvironmentFactType<unknown>, unknown][] = [];
    if (backends !== 'failing') {
      facts.push([LoadBalancerBackendsFact, backends]);
    }

    return await makeEnvironment(context, undefined, AT, facts);
  }

  beforeEach(async () => {
    listTimeSeries = jest.fn(async () => [[]]);
    environment = await makeQueryEnvironment();
    layouts = new BucketLayoutRegistry();
  });

  it('should read the time series of the project, and group the values of nodes', async () => {
    listTimeSeries.mockResolvedValueOnce([
      [
        {
          resource: {
            labels: { location: 'europe-west1', service_name: 'ordering-api' },
          },
          metric: { labels: { response_code_class: '5xx' } },
          points: [point({ doubleValue: 0.5 })],
        },
        {
          resource: {
            labels: { location: 'europe-west1', service_name: 'ordering-api' },
          },
          metric: { labels: { response_code_class: '2xx' } },
          points: [point({ doubleValue: 2 })],
        },
        {
          resource: {
            labels: { location: 'europe-west1', service_name: 'unknown' },
          },
          metric: { labels: { response_code_class: '2xx' } },
          points: [point({ doubleValue: 100 })],
        },
      ],
    ]);

    const actualResult = await queryMonitoringMetric(
      environment,
      requests,
      { end: AT, period: 300, count: 1 },
      layouts,
    );

    expect([...actualResult.values]).toEqual([
      [
        'service:domains/ordering/api#ordering-api',
        [
          {
            value: 2.5,
            groups: [
              { key: { code: '2xx' }, value: 2 },
              { key: { code: '5xx' }, value: 0.5 },
            ],
          },
        ],
      ],
      [
        'service:domains/ordering/api#ordering-events',
        [{ value: 0, groups: [] }],
      ],
    ]);
    expect(actualResult.groupBy).toEqual(['code']);
    expect(actualResult.warnings).toBeEmpty();
    expect(actualResult.errors).toBeEmpty();
    expect(listTimeSeries).toHaveBeenCalledExactlyOnceWith({
      name: 'projects/my-project',
      filter:
        'metric.type = "run.googleapis.com/request_count" AND resource.type = "cloud_run_revision" AND project = "my-project"',
      interval: {
        startTime: { seconds: END_SECONDS - 300 },
        endTime: { seconds: END_SECONDS },
      },
      aggregation: {
        alignmentPeriod: { seconds: 300 },
        perSeriesAligner: 'ALIGN_RATE',
        crossSeriesReducer: 'REDUCE_SUM',
        groupByFields: [
          'resource.label.location',
          'resource.label.service_name',
          'metric.label.response_code_class',
        ],
      },
      view: 'FULL',
    });
  });

  it('should convert distributions and name their layouts', async () => {
    const distribution = (scale: number, count: string) => ({
      distributionValue: {
        count,
        mean: 2000,
        bucketOptions: {
          exponentialBuckets: { numFiniteBuckets: 2, growthFactor: 2, scale },
        },
        bucketCounts: ['0', count, '0', '0'],
      },
    });
    listTimeSeries.mockResolvedValueOnce([
      [
        {
          resource: {
            labels: { subscription_id: 'run-ordering-events-handleOrder' },
          },
          metric: { labels: {} },
          points: [point(distribution(1000, '3'))],
        },
      ],
    ]);
    layouts.register(
      'pubsub.googleapis.com/subscription/push_request_latencies',
      [5],
    );

    const actualResult = await queryMonitoringMetric(
      environment,
      {
        metric: 'pushLatency',
        mapping: PUBSUB_SUBSCRIPTION_MAPPING,
        metricType: 'pubsub.googleapis.com/subscription/push_request_latencies',
        scale: 0.001,
      },
      { end: AT, period: 300, count: 1 },
      layouts,
    );

    expect(
      actualResult.values.get(
        'brokerSubscription:domains/ordering/api#handleOrder',
      ),
    ).toEqual([
      {
        value: {
          layout: 'pubsub.googleapis.com/subscription/push_request_latencies#2',
          count: 3,
          mean: 2,
          buckets: { 1: 3 },
        },
      },
    ]);
    expect(layouts.all).toEqual({
      'pubsub.googleapis.com/subscription/push_request_latencies': [5],
      'pubsub.googleapis.com/subscription/push_request_latencies#2': [1, 2, 4],
    });
  });

  it('should return the number of values per second for count rates', async () => {
    listTimeSeries.mockResolvedValueOnce([
      [
        {
          resource: { labels: { topic_id: 'ordering.order.v1' } },
          metric: { labels: {} },
          points: [
            point({
              distributionValue: {
                count: '600',
                bucketOptions: { explicitBuckets: { bounds: [1] } },
              },
            }),
          ],
        },
      ],
    ]);

    const actualResult = await queryMonitoringMetric(
      environment,
      {
        metric: 'published',
        mapping: PUBSUB_TOPIC_MAPPING,
        metricType: 'pubsub.googleapis.com/topic/message_sizes',
        countRate: true,
      },
      { end: AT, period: 300, count: 1 },
      layouts,
    );

    expect(actualResult.values.get('brokerTopic:ordering.order.v1')).toEqual([
      { value: 2 },
    ]);
    expect(layouts.all).toEqual({});
  });

  it('should match queues by their resolved names', async () => {
    const queue = (queueId: string, value: number) => ({
      resource: { labels: { location: 'europe-west1', queue_id: queueId } },
      metric: { labels: {} },
      points: [point({ int64Value: `${value}` })],
    });
    listTimeSeries.mockResolvedValueOnce([
      [
        queue('order-expiration-abc', 3),
        queue('order-expiration-def', 5),
        queue('order-expiration-late-ghi', 7),
      ],
    ]);

    const actualResult = await queryMonitoringMetric(
      environment,
      {
        metric: 'backlog',
        mapping: CLOUD_TASKS_QUEUE_MAPPING,
        metricType: 'cloudtasks.googleapis.com/queue/depth',
        reducer: 'REDUCE_MAX',
      },
      { end: AT, period: 300, count: 1 },
      layouts,
    );

    expect(Object.fromEntries(actualResult.values)).toEqual({
      'queue:order-expiration': [{ value: 3 }],
    });
  });

  describe('groupByNode', () => {
    const routerRequests: MonitoringMetric = {
      metric: 'requests',
      mapping: URL_MAP_MAPPING,
      metricType: 'loadbalancing.googleapis.com/https/request_count',
      groupBy: { code: 'metric.label.response_code_class' },
      groupByNode: LOAD_BALANCER_BACKEND_MAPPINGS,
    };
    const series = (backend: string, code: string, value: number) => ({
      resource: {
        labels: {
          url_map_name: 'api',
          backend_scope: 'europe-west1',
          backend_name: backend,
        },
      },
      metric: { labels: { response_code_class: code } },
      points: [point({ doubleValue: value })],
    });
    it('should group values by the nodes backends route requests to, and merge the groups of the same node', async () => {
      listTimeSeries.mockResolvedValueOnce([
        [
          series('run-ordering-api', '2xx', 1),
          series('run-ordering-api-2', '2xx', 2),
          series('run-ordering-api', '5xx', 4),
          series('run-other', '2xx', 8),
          series('', '3xx', 16),
        ],
      ]);

      const actualResult = await queryMonitoringMetric(
        environment,
        routerRequests,
        { end: AT, period: 300, count: 1 },
        layouts,
      );

      const node = 'service:domains/ordering/api#ordering-api';
      expect(actualResult.values).toEqual(
        new Map([
          [
            'apiRouter:api',
            [
              {
                value: 31,
                groups: [
                  { key: { code: '2xx', node }, value: 3 },
                  { key: { code: '2xx' }, value: 8 },
                  { key: { code: '3xx' }, value: 16 },
                  { key: { code: '5xx', node }, value: 4 },
                ],
              },
            ],
          ],
        ]),
      );
      expect(actualResult.groupBy).toEqual(['code', 'node']);
      expect(actualResult.warnings).toEqual([
        {
          message:
            "The 'https_lb_rule' time series with resource.label.backend_name=run-other, resource.label.backend_scope=europe-west1 relate to 'projects/my-project/locations/europe-west1/services/other', which is not in the graph.",
        },
      ]);
      expect(listTimeSeries).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({
          aggregation: expect.objectContaining({
            groupByFields: [
              'resource.label.url_map_name',
              'metric.label.response_code_class',
              'resource.label.backend_scope',
              'resource.label.backend_name',
            ],
          }),
        }),
      );
    });

    it('should not group values by node when the backends cannot be listed', async () => {
      environment = await makeQueryEnvironment('failing');
      listTimeSeries.mockResolvedValueOnce([
        [series('run-ordering-api', '2xx', 1)],
      ]);

      const actualResult = await queryMonitoringMetric(
        environment,
        routerRequests,
        { end: AT, period: 300, count: 1 },
        layouts,
      );

      expect(actualResult.values.get('apiRouter:api')).toEqual([
        { value: 1, groups: [{ key: { code: '2xx' }, value: 1 }] },
      ]);
      expect(actualResult.groupBy).toEqual(['code']);
      expect(actualResult.warnings).toBeEmpty();
      expect(environment.failures).toEqual([
        {
          name: 'LoadBalancerBackendsFact',
          message: expect.toInclude('💥'),
        },
      ]);
      expect(listTimeSeries).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({
          aggregation: expect.objectContaining({
            groupByFields: [
              'resource.label.url_map_name',
              'metric.label.response_code_class',
            ],
          }),
        }),
      );
    });
  });

  it('should place points in their periods', async () => {
    listTimeSeries.mockResolvedValueOnce([
      [
        {
          resource: {
            labels: { location: 'europe-west1', service_name: 'ordering-api' },
          },
          metric: { labels: {} },
          points: [
            point({ doubleValue: 1 }, END_SECONDS),
            point({ doubleValue: 3 }, END_SECONDS - 120),
            point({ doubleValue: 9 }, END_SECONDS - 360),
          ],
        },
      ],
    ]);

    const actualResult = await queryMonitoringMetric(
      environment,
      { ...requests, groupBy: undefined },
      { end: AT, period: 30, count: 3 },
      layouts,
      { nodes: ['service:domains/ordering/api#ordering-api'] },
    );

    expect(Object.fromEntries(actualResult.values)).toEqual({
      'service:domains/ordering/api#ordering-api': [
        { value: 3 },
        { value: 0 },
        { value: 1 },
      ],
    });
    expect(listTimeSeries).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        interval: {
          startTime: { seconds: END_SECONDS - 180 },
          endTime: { seconds: END_SECONDS },
        },
        aggregation: expect.objectContaining({
          alignmentPeriod: { seconds: 60 },
        }),
      }),
    );
  });

  it('should drop empty groups and distributions, but keep zero gauges', async () => {
    const series = (labels: object, value: object) => ({
      resource: {
        labels: { subscription_id: 'run-ordering-events-handleOrder' },
      },
      metric: { labels },
      points: [point(value)],
    });
    const emptyDistribution = {
      distributionValue: {
        count: '0',
        bucketOptions: { explicitBuckets: { bounds: [1] } },
      },
    };
    listTimeSeries
      .mockResolvedValueOnce([
        [
          series({ response_class: 'ack' }, { doubleValue: 1 }),
          series({ response_class: 'nack' }, { doubleValue: 0 }),
        ],
      ])
      .mockResolvedValueOnce([
        [series({ response_code: 'success' }, emptyDistribution)],
      ])
      .mockResolvedValueOnce([[series({}, { int64Value: '0' })]]);
    const subscription = 'brokerSubscription:domains/ordering/api#handleOrder';

    const actualRate = await queryMonitoringMetric(
      environment,
      {
        metric: 'pushRequests',
        mapping: PUBSUB_SUBSCRIPTION_MAPPING,
        metricType: 'pubsub.googleapis.com/subscription/push_request_count',
        groupBy: { code: 'metric.label.response_class' },
      },
      { end: AT, period: 300, count: 1 },
      layouts,
    );
    const actualDistribution = await queryMonitoringMetric(
      environment,
      {
        metric: 'pushLatency',
        mapping: PUBSUB_SUBSCRIPTION_MAPPING,
        metricType: 'pubsub.googleapis.com/subscription/push_request_latencies',
        groupBy: { code: 'metric.label.response_code' },
      },
      { end: AT, period: 300, count: 1 },
      layouts,
    );
    const actualGauge = await queryMonitoringMetric(
      environment,
      {
        metric: 'backlog',
        mapping: PUBSUB_SUBSCRIPTION_MAPPING,
        metricType:
          'pubsub.googleapis.com/subscription/num_undelivered_messages',
      },
      { end: AT, period: 300, count: 1 },
      layouts,
    );

    expect(actualRate.values.get(subscription)).toEqual([
      { value: 1, groups: [{ key: { code: 'ack' }, value: 1 }] },
    ]);
    expect(actualDistribution.values.get(subscription)).toEqual([undefined]);
    expect(actualGauge.values.get(subscription)).toEqual([{ value: 0 }]);
  });

  it('should not return gauges and distributions without data', async () => {
    const actualResult = await queryMonitoringMetric(
      environment,
      {
        metric: 'backlog',
        mapping: PUBSUB_SUBSCRIPTION_MAPPING,
        metricType:
          'pubsub.googleapis.com/subscription/num_undelivered_messages',
      },
      { end: AT, period: 300, count: 1 },
      layouts,
    );

    expect(actualResult.values.size).toEqual(0);
  });

  it('should not query projects without nodes', async () => {
    const actualResult = await queryMonitoringMetric(
      environment,
      requests,
      { end: AT, period: 300, count: 1 },
      layouts,
      { nodes: [] },
    );

    expect(actualResult.values.size).toEqual(0);
    expect(listTimeSeries).not.toHaveBeenCalled();
  });

  it('should ignore metrics that do not exist and warn about other errors', async () => {
    listTimeSeries.mockRejectedValueOnce(
      Object.assign(new Error('not found'), { code: 5 }),
    );

    const actualNotFound = await queryMonitoringMetric(
      environment,
      requests,
      { end: AT, period: 300, count: 1 },
      layouts,
    );
    listTimeSeries.mockRejectedValueOnce(
      Object.assign(new Error('💥'), { code: 7 }),
    );
    const actualError = await queryMonitoringMetric(
      environment,
      requests,
      { end: AT, period: 300, count: 1 },
      layouts,
    );

    expect(actualNotFound).toEqual({
      values: new Map([
        [
          'service:domains/ordering/api#ordering-api',
          [{ value: 0, groups: [] }],
        ],
        [
          'service:domains/ordering/api#ordering-events',
          [{ value: 0, groups: [] }],
        ],
      ]),
      groupBy: ['code'],
      errors: [],
      warnings: [],
    });
    expect(actualError).toEqual({
      values: new Map(),
      groupBy: ['code'],
      errors: [
        {
          message:
            "Failed to read the metric 'run.googleapis.com/request_count' in project 'my-project': 💥",
        },
      ],
      warnings: [],
    });
  });

  it('should return a rate of 0 when all the groups of a period are empty', async () => {
    listTimeSeries.mockResolvedValueOnce([
      [
        {
          resource: {
            labels: { location: 'europe-west1', service_name: 'ordering-api' },
          },
          metric: { labels: { response_code_class: '2xx' } },
          points: [point({ doubleValue: 0 })],
        },
      ],
    ]);

    const actualResult = await queryMonitoringMetric(
      environment,
      requests,
      { end: AT, period: 300, count: 1 },
      layouts,
      { nodes: ['service:domains/ordering/api#ordering-api'] },
    );

    expect(Object.fromEntries(actualResult.values)).toEqual({
      'service:domains/ordering/api#ordering-api': [{ value: 0, groups: [] }],
    });
  });

  it('should only return the values of the nodes the metric measures', async () => {
    const actualResult = await queryMonitoringMetric(
      environment,
      {
        ...requests,
        measures: (node) => node.id.endsWith('#ordering-events'),
      },
      { end: AT, period: 300, count: 1 },
      layouts,
    );

    expect([...actualResult.values.keys()]).toEqual([
      'service:domains/ordering/api#ordering-events',
    ]);
  });
});

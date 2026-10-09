import { WorkspaceContext } from '@causa/workspace';
import { jest } from '@jest/globals';
import 'jest-extended';
import {
  CloudMonitoringService,
  GoogleApisService,
} from '../../../services/index.js';
import {
  AT,
  ENVIRONMENT_GRAPH,
  makeContext,
  makeEnvironment,
} from '../fixture.test.js';
import { googleCloudMonitoring } from './cloud-monitoring.js';

const END_SECONDS = AT.getTime() / 1000;

describe('googleCloudMonitoring', () => {
  let context: WorkspaceContext;
  let listTimeSeries: jest.Mock<(request: any) => Promise<any>>;
  let listGroups: jest.Mock<(request: any) => Promise<any>>;

  beforeEach(() => {
    context = makeContext();
    listTimeSeries = jest.fn(async (request: any) => {
      const point = (value: object) => [
        { interval: { endTime: { seconds: END_SECONDS } }, value },
      ];
      if (
        request.filter.includes(
          '"loadbalancing.googleapis.com/https/request_count"',
        )
      ) {
        const series = (backend: string, value: number) => ({
          resource: {
            labels: {
              url_map_name: 'api',
              backend_scope: 'europe-west1',
              backend_name: backend,
            },
          },
          metric: { labels: { response_code_class: '2xx' } },
          points: point({ doubleValue: value }),
        });
        return [[series('run-ordering-api', 2), series('run-other', 1)]];
      }

      if (request.filter.includes('"run.googleapis.com/request_count"')) {
        return [
          [
            {
              resource: {
                labels: {
                  location: 'europe-west1',
                  service_name: 'ordering-api',
                },
              },
              metric: { labels: { response_code_class: '2xx' } },
              points: point({ doubleValue: 4 }),
            },
          ],
        ];
      }

      if (request.filter.includes('"run.googleapis.com/request_latencies"')) {
        return [
          [
            {
              resource: {
                labels: {
                  location: 'europe-west1',
                  service_name: 'ordering-api',
                },
              },
              metric: { labels: { response_code_class: '2xx' } },
              points: point({
                distributionValue: {
                  count: 2,
                  mean: 15,
                  bucketOptions: { explicitBuckets: { bounds: [10, 20] } },
                  bucketCounts: [0, 2],
                },
              }),
            },
          ],
        ];
      }

      if (
        request.filter.includes(
          '"spanner.googleapis.com/instance/processing_units"',
        )
      ) {
        return [
          [
            {
              resource: { labels: { instance_id: 'main' } },
              metric: { labels: {} },
              points: point({ int64Value: '100' }),
            },
          ],
        ];
      }

      if (
        request.filter.includes('"pubsub.googleapis.com/topic/message_sizes"')
      ) {
        throw Object.assign(new Error('💥'), { code: 7 });
      }

      return [[]];
    });
    listGroups = jest.fn(async () => ({
      data: {
        items: ['ordering-api', 'other'].map((service) => ({
          name: `run-${service}`,
          networkEndpointType: 'SERVERLESS',
          cloudRun: { service },
        })),
      },
    }));
    jest
      .spyOn(context.service(GoogleApisService), 'getClient')
      .mockImplementation(
        async () =>
          ({ regionNetworkEndpointGroups: { list: listGroups } }) as never,
      );
    jest
      .spyOn(context.service(CloudMonitoringService).client, 'initialize')
      .mockResolvedValue({});
    jest
      .spyOn(context.service(CloudMonitoringService).client, 'listTimeSeries')
      .mockImplementation(listTimeSeries as any);
  });

  it('should return the metrics of nodes', async () => {
    const actualOutput = await googleCloudMonitoring.fetch(
      await makeEnvironment(context),
    );

    const nodes = actualOutput.nodes ?? {};
    expect(nodes['service:domains/ordering/api#ordering-api'].metrics).toEqual({
      requests: {
        value: 4,
        groupBy: ['code'],
        groups: [{ key: { code: '2xx' }, value: 4 }],
      },
      latency: {
        value: {
          layout: 'run.googleapis.com/request_latencies',
          count: 2,
          mean: 15,
          buckets: { 1: 2 },
        },
        groupBy: ['code'],
        groups: [
          {
            key: { code: '2xx' },
            value: {
              layout: 'run.googleapis.com/request_latencies',
              count: 2,
              mean: 15,
              buckets: { 1: 2 },
            },
          },
        ],
      },
      errorLogs: { value: 0 },
    });
    expect(nodes['google.spanner.instance:main'].metrics).toEqual({
      nodes: { value: 0.1 },
    });
    expect(nodes['brokerTopic:ordering.order.v1'].metrics).toEqual({
      publishRequests: { value: 0, groupBy: ['code'], groups: [] },
    });
    expect(
      nodes['service:domains/ordering/api#ordering-events'].metrics,
    ).toEqual({
      requests: { value: 0, groupBy: ['code'], groups: [] },
      errorLogs: { value: 0 },
    });
    expect(actualOutput.bucketLayouts).toEqual({
      'run.googleapis.com/request_latencies': [10, 20],
    });
    expect(actualOutput.warnings).toEqual([
      {
        message:
          "The 'https_lb_rule' time series with resource.label.backend_name=run-other, resource.label.backend_scope=europe-west1 relate to 'projects/my-project/locations/europe-west1/services/other', which is not in the graph.",
      },
      {
        message:
          "Failed to read the metric 'pubsub.googleapis.com/topic/message_sizes' in project 'my-project': 💥",
      },
    ]);
  });

  it('should only return push metrics for subscriptions pushing messages to services', async () => {
    const subscription = 'brokerSubscription:domains/ordering/api#handleOrder';
    const pushGraph = {
      ...ENVIRONMENT_GRAPH,
      edges: {
        ...ENVIRONMENT_GRAPH.edges,
        targets: [
          {
            from: subscription,
            to: 'service:domains/ordering/api#ordering-events',
            origin: ENVIRONMENT_GRAPH.edges!.routes![0].origin,
          },
        ],
      },
    };

    const actualPullOutput = await googleCloudMonitoring.fetch(
      await makeEnvironment(context),
    );
    const actualPushOutput = await googleCloudMonitoring.fetch(
      await makeEnvironment(context, pushGraph),
    );

    expect(actualPullOutput.nodes?.[subscription].metrics).not.toHaveProperty(
      'pushRequests',
    );
    expect(actualPushOutput.nodes?.[subscription].metrics).toHaveProperty(
      'pushRequests',
      { value: 0, groupBy: ['code'], groups: [] },
    );
  });

  it('should only count the concurrency of active instances', async () => {
    await googleCloudMonitoring.fetch(await makeEnvironment(context));

    const request = listTimeSeries.mock.calls
      .map(([r]) => r)
      .find((r) =>
        r.filter.includes(
          '"run.googleapis.com/container/max_request_concurrencies"',
        ),
      );
    expect(request.filter).toEndWith(' AND metric.label.state = "active"');
  });

  it('should group the metrics of API routers by the nodes their backends route requests to', async () => {
    const actualOutput = await googleCloudMonitoring.fetch(
      await makeEnvironment(context),
    );

    expect(actualOutput.nodes?.['apiRouter:api'].metrics?.requests).toEqual({
      value: 3,
      groupBy: ['code', 'node'],
      groups: [
        {
          key: {
            code: '2xx',
            node: 'service:domains/ordering/api#ordering-api',
          },
          value: 2,
        },
        { key: { code: '2xx' }, value: 1 },
      ],
    });
    expect(listGroups).toHaveBeenCalledExactlyOnceWith({
      project: 'my-project',
      region: 'europe-west1',
      pageToken: undefined,
    });
  });

  it('should not group the metrics of API routers by node when backends cannot be listed', async () => {
    listGroups.mockRejectedValueOnce(new Error('💥'));

    const actualOutput = await googleCloudMonitoring.fetch(
      await makeEnvironment(context),
    );

    expect(actualOutput.nodes?.['apiRouter:api'].metrics?.requests).toEqual({
      value: 3,
      groupBy: ['code'],
      groups: [{ key: { code: '2xx' }, value: 3 }],
    });
    expect(actualOutput.warnings).not.toContainEqual({
      message: expect.toInclude('which is not in the graph'),
    });
  });

  it('should exclude messages discarded by the subscription filter from acknowledged messages', async () => {
    await googleCloudMonitoring.fetch(await makeEnvironment(context));

    const request = listTimeSeries.mock.calls
      .map(([r]) => r)
      .find((r) =>
        r.filter.includes(
          '"pubsub.googleapis.com/subscription/ack_message_count"',
        ),
      );
    expect(request.filter).toEndWith(
      ' AND metric.label.delivery_type != "filter"',
    );
  });

  it('should read gauges sampled less often over their minimum period', async () => {
    await googleCloudMonitoring.fetch(await makeEnvironment(context));

    const request = listTimeSeries.mock.calls
      .map(([r]) => r)
      .find((r) =>
        r.filter.includes('"bigquery.googleapis.com/storage/stored_bytes"'),
      );
    expect(request.interval).toEqual({
      startTime: { seconds: END_SECONDS - 14400 },
      endTime: { seconds: END_SECONDS },
    });
    expect(request.aggregation.alignmentPeriod).toEqual({ seconds: 14400 });
  });

  it('should end the window early when the end of the evaluation window is too recent', async () => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(AT.getTime());

    await googleCloudMonitoring.fetch(await makeEnvironment(context));
    now.mockRestore();

    const request = listTimeSeries.mock.calls
      .map(([r]) => r)
      .find((r) => r.filter.includes('"run.googleapis.com/request_count"'));
    expect(request.interval).toEqual({
      startTime: { seconds: END_SECONDS - 600 },
      endTime: { seconds: END_SECONDS - 300 },
    });
  });

  it('should fail without calling Cloud Monitoring when credentials cannot be loaded', async () => {
    jest
      .spyOn(context.service(CloudMonitoringService).client, 'initialize')
      .mockRejectedValue(new Error('🔑'));

    const actualPromise = googleCloudMonitoring.fetch(
      await makeEnvironment(context),
    );

    await expect(actualPromise).rejects.toThrow('🔑');
    expect(listTimeSeries).not.toHaveBeenCalled();
  });
});

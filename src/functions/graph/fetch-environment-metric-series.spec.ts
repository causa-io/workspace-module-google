import { WorkspaceContext } from '@causa/workspace';
import { GraphFetchEnvironmentMetricSeries } from '@causa/workspace-core';
import type { ImplementableFunctionArguments } from '@causa/workspace/function-registry';
import { createContext } from '@causa/workspace/testing';
import { jest } from '@jest/globals';
import 'jest-extended';
import { pino } from 'pino';
import { ENVIRONMENT_GRAPH } from '../../graph/environment/fixture.test.js';
import {
  CloudMonitoringService,
  GoogleApisService,
} from '../../services/index.js';
import { GraphFetchEnvironmentMetricSeriesForGoogle } from './fetch-environment-metric-series.js';

const END = new Date('2026-10-01T12:00:00Z');
const END_SECONDS = END.getTime() / 1000;
const SERVICE = 'service:domains/ordering/api#ordering-api';

describe('GraphFetchEnvironmentMetricSeriesForGoogle', () => {
  let context: WorkspaceContext;
  let listTimeSeries: jest.Mock<(request: any) => Promise<any>>;
  let listQueues: jest.Mock<(request: any) => Promise<any>>;
  let listGroups: jest.Mock<(request: any) => Promise<any>>;

  const args = {
    graph: ENVIRONMENT_GRAPH,
    node: SERVICE,
    metric: 'requests',
    start: new Date('2026-10-01T11:56:30Z'),
    end: END,
    step: 60,
  };

  beforeEach(() => {
    ({ context } = createContext({
      environment: 'prod',
      configuration: {
        workspace: { name: 'shop' },
        google: { project: 'my-project' },
      },
      logger: pino({ level: 'silent' }),
      functions: [GraphFetchEnvironmentMetricSeriesForGoogle],
    }));
    listTimeSeries = jest.fn(async () => [[]]);
    listQueues = jest.fn(async () => ({ data: {} }));
    listGroups = jest.fn(async () => ({ data: {} }));
    jest
      .spyOn(context.service(GoogleApisService), 'getClient')
      .mockImplementation(
        async () =>
          ({
            projects: { locations: { queues: { list: listQueues } } },
            regionNetworkEndpointGroups: { list: listGroups },
          }) as never,
      );
    jest
      .spyOn(context.service(CloudMonitoringService).client, 'initialize')
      .mockResolvedValue({});
    jest
      .spyOn(context.service(CloudMonitoringService).client, 'listTimeSeries')
      .mockImplementation(listTimeSeries as any);
  });

  it('should return the series of the metric and its groups', async () => {
    const series = (code: string, points: [number, number][]) => ({
      resource: {
        labels: { location: 'europe-west1', service_name: 'ordering-api' },
      },
      metric: { labels: { response_code_class: code } },
      points: points.map(([offset, value]) => ({
        interval: { endTime: { seconds: END_SECONDS - offset } },
        value: { doubleValue: value },
      })),
    });
    listTimeSeries.mockResolvedValueOnce([
      [
        series('2xx', [
          [0, 3],
          [120, 1],
        ]),
        series('5xx', [[0, 1]]),
      ],
    ]);

    const actualSeries = await context.call(
      GraphFetchEnvironmentMetricSeries,
      args,
    );

    expect(actualSeries).toEqual({
      start: new Date('2026-10-01T11:57:00Z'),
      step: 60,
      values: [1, 0, 4],
      groupBy: ['code'],
      groups: [
        { key: { code: '2xx' }, values: [1, 0, 3] },
        { key: { code: '5xx' }, values: [0, 0, 1] },
      ],
      bucketLayouts: {},
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

  it('should return null values for a series without data', async () => {
    const actualSeries = await context.call(GraphFetchEnvironmentMetricSeries, {
      ...args,
      metric: 'instances',
    });

    expect(actualSeries).toEqual({
      start: new Date('2026-10-01T11:57:00Z'),
      step: 60,
      values: [null, null, null],
      bucketLayouts: {},
    });
  });

  it('should leave out points that are too recent to be complete', async () => {
    const now = jest
      .spyOn(Date, 'now')
      .mockReturnValue(END.getTime() + 150 * 1000);

    const actualSeries = await context.call(GraphFetchEnvironmentMetricSeries, {
      ...args,
      end: new Date(END.getTime() + 150 * 1000),
    });
    now.mockRestore();

    expect(actualSeries).toEqual(
      expect.objectContaining({
        start: new Date('2026-10-01T11:56:30Z'),
        values: [0],
      }),
    );
    expect(listTimeSeries).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        interval: {
          startTime: { seconds: END_SECONDS - 210 },
          endTime: { seconds: END_SECONDS - 150 },
        },
      }),
    );
  });

  it('should only support the metrics read from Cloud Monitoring for the type of resource', () => {
    const supports = (
      overrides: Partial<
        ImplementableFunctionArguments<GraphFetchEnvironmentMetricSeries>
      >,
    ) =>
      context.getFunctionImplementations(GraphFetchEnvironmentMetricSeries, {
        ...args,
        ...overrides,
      }).length > 0;

    expect(supports({})).toBeTrue();
    expect(supports({ node: 'apiRouter:api' })).toBeTrue();
    expect(supports({ metric: 'unknown' })).toBeFalse();
    expect(supports({ node: 'service:unknown' })).toBeFalse();
    expect(supports({ node: 'unknown' })).toBeFalse();
    expect(supports({ node: 'project:domains/ordering/api' })).toBeFalse();
    expect(
      supports({ node: 'service:domains/other/api#other-api' }),
    ).toBeFalse();
    expect(
      supports({ node: 'queue:order-expiration-late', metric: 'backlog' }),
    ).toBeFalse();
  });

  it('should only support push metrics for subscriptions pushing messages to services', () => {
    const subscription = 'brokerSubscription:domains/ordering/api#handleOrder';
    const supports = (graph: typeof ENVIRONMENT_GRAPH) =>
      context.getFunctionImplementations(GraphFetchEnvironmentMetricSeries, {
        ...args,
        graph,
        node: subscription,
        metric: 'pushRequests',
      }).length > 0;
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

    expect(supports(ENVIRONMENT_GRAPH)).toBeFalse();
    expect(supports(pushGraph)).toBeTrue();
  });

  it('should use the minimum period of metrics sampled less often as the step', async () => {
    const actualSeries = await context.call(GraphFetchEnvironmentMetricSeries, {
      ...args,
      node: 'database:google.firestore/(default)',
      metric: 'storage',
      start: new Date(END.getTime() - 3600 * 1000),
      step: undefined,
    });

    expect(actualSeries).toEqual({
      start: new Date(END.getTime() - 86400 * 1000),
      step: 86400,
      values: [null],
      bucketLayouts: {},
    });
    expect(listTimeSeries).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        interval: {
          startTime: { seconds: END_SECONDS - 86400 },
          endTime: { seconds: END_SECONDS },
        },
        aggregation: expect.objectContaining({
          alignmentPeriod: { seconds: 86400 },
        }),
      }),
    );
  });

  it.each([
    [3600, 60, 60],
    [86400, 300, 288],
    [30 * 86400, 10800, 240],
    [400 * 86400, 2 * 86400, 200],
  ])(
    'should choose a step for a series of %d seconds without one',
    async (duration, expectedStep, expectedCount) => {
      const actualSeries = await context.call(
        GraphFetchEnvironmentMetricSeries,
        {
          ...args,
          start: new Date(END.getTime() - duration * 1000),
          step: undefined,
        },
      );

      expect(actualSeries.step).toEqual(expectedStep);
      expect(actualSeries.values).toHaveLength(expectedCount);
      expect(listTimeSeries).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({
          aggregation: expect.objectContaining({
            alignmentPeriod: { seconds: expectedStep },
          }),
        }),
      );
    },
  );

  it('should throw for an invalid step or range', async () => {
    await expect(
      context.call(GraphFetchEnvironmentMetricSeries, {
        ...args,
        step: 30,
      }),
    ).rejects.toThrow(
      'The step must be a whole number of seconds, of at least 60 seconds.',
    );
    await expect(
      context.call(GraphFetchEnvironmentMetricSeries, {
        ...args,
        start: args.end,
      }),
    ).rejects.toThrow(
      'The series must contain between 1 and 10000 points, but contains 0.',
    );
  });

  it('should throw when the graph is not enriched', async () => {
    const actualPromise = context.call(GraphFetchEnvironmentMetricSeries, {
      ...args,
      graph: { ...ENVIRONMENT_GRAPH, environment: undefined },
    });

    await expect(actualPromise).rejects.toThrow(
      'The graph must be enriched with environment data to fetch a series.',
    );
    expect(listTimeSeries).not.toHaveBeenCalled();
  });

  it('should group the series of API router metrics by the nodes their backends route requests to', async () => {
    listGroups.mockResolvedValueOnce({
      data: {
        items: [
          {
            name: 'run-ordering-api',
            networkEndpointType: 'SERVERLESS',
            cloudRun: { service: 'ordering-api' },
          },
        ],
      },
    });
    listTimeSeries.mockResolvedValueOnce([
      [
        {
          resource: {
            labels: {
              url_map_name: 'api',
              backend_scope: 'europe-west1',
              backend_name: 'run-ordering-api',
            },
          },
          metric: { labels: { response_code_class: '2xx' } },
          points: [
            {
              interval: { endTime: { seconds: END_SECONDS } },
              value: { doubleValue: 2 },
            },
          ],
        },
      ],
    ]);

    const actualSeries = await context.call(GraphFetchEnvironmentMetricSeries, {
      ...args,
      node: 'apiRouter:api',
    });

    expect(actualSeries).toEqual({
      start: new Date('2026-10-01T11:57:00Z'),
      step: 60,
      values: [0, 0, 2],
      groupBy: ['code', 'node'],
      groups: [
        {
          key: { code: '2xx', node: SERVICE },
          values: [0, 0, 2],
        },
      ],
      bucketLayouts: {},
    });
    expect(listGroups).toHaveBeenCalledExactlyOnceWith({
      project: 'my-project',
      region: 'europe-west1',
      pageToken: undefined,
    });
  });

  it('should not throw when time series relate to resources missing from the graph', async () => {
    listGroups.mockResolvedValueOnce({
      data: {
        items: [
          {
            name: 'run-other',
            networkEndpointType: 'SERVERLESS',
            cloudRun: { service: 'other' },
          },
        ],
      },
    });
    listTimeSeries.mockResolvedValueOnce([
      [
        {
          resource: {
            labels: {
              url_map_name: 'api',
              backend_scope: 'europe-west1',
              backend_name: 'run-other',
            },
          },
          metric: { labels: { response_code_class: '2xx' } },
          points: [
            {
              interval: { endTime: { seconds: END_SECONDS } },
              value: { doubleValue: 2 },
            },
          ],
        },
      ],
    ]);

    const actualSeries = await context.call(GraphFetchEnvironmentMetricSeries, {
      ...args,
      node: 'apiRouter:api',
    });

    expect(actualSeries).toEqual(
      expect.objectContaining({
        values: [0, 0, 2],
        groupBy: ['code', 'node'],
        groups: [{ key: { code: '2xx' }, values: [0, 0, 2] }],
      }),
    );
  });

  it('should throw when the time series cannot be read', async () => {
    listTimeSeries.mockRejectedValueOnce(new Error('💥'));

    const actualPromise = context.call(GraphFetchEnvironmentMetricSeries, args);

    await expect(actualPromise).rejects.toThrow(
      "Failed to read the metric 'run.googleapis.com/request_count' in project 'my-project': 💥",
    );
  });
});

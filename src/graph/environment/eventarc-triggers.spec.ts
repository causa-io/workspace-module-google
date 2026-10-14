import { WorkspaceContext } from '@causa/workspace';
import { GraphOriginKind, type Graph } from '@causa/workspace-core';
import { GraphFactError } from '@causa/workspace-core/graph';
import { jest } from '@jest/globals';
import 'jest-extended';
import {
  CloudMonitoringService,
  GoogleApisService,
} from '../../services/index.js';
import {
  EVENTARC_TRIGGER_MAPPING,
  EventarcTriggersFact,
} from './eventarc-triggers.js';
import { googleCloudMonitoringAlerts } from './fetchers/cloud-monitoring-alerts.js';
import { AT, makeContext, makeEnvironment } from './fixture.test.js';
import {
  MONITORING_METRICS,
  PUBSUB_SUBSCRIPTION_MAPPING,
} from './monitoring-catalog.js';
import { prepareMonitoringMapping } from './monitoring-mappings.js';
import { queryMonitoringMetric } from './monitoring-query.js';
import { BucketLayoutRegistry } from './monitoring-values.js';

const UPLOAD =
  'projects/my-project/locations/europe-west1/triggers/run-ordering-api-onupload';
const AUDIT =
  'projects/my-project/locations/global/triggers/run-ordering-api-onaudit';
const MISSING =
  'projects/my-project/locations/europe-west1/triggers/run-ordering-api-onmissing';
const UPLOAD_SUBSCRIPTION_ID = 'eventarc-europe-west1-onupload-sub-123';
const UPLOAD_SUBSCRIPTION = `projects/my-project/subscriptions/${UPLOAD_SUBSCRIPTION_ID}`;
const ORDER_SUBSCRIPTION_ID = 'run-ordering-api-onOrder';

const origin = {
  kind: GraphOriginKind.Declared,
  rule: 'test',
  sources: [{ path: 'causa.yaml' }],
};

const subscription = (name: string, type: string, id: string) => ({
  name,
  origin,
  data: { resource: { type, id } },
});

const GRAPH: Graph = {
  name: 'shop',
  nodes: {
    infrastructure: {
      brokerSubscription: {
        'domains/ordering/api#onUpload': subscription(
          'run-ordering-api-onupload',
          'eventarc.googleapis.com/Trigger',
          UPLOAD,
        ),
        'domains/ordering/api#onAudit': subscription(
          'run-ordering-api-onaudit',
          'eventarc.googleapis.com/Trigger',
          AUDIT,
        ),
        'domains/ordering/api#onMissing': subscription(
          'run-ordering-api-onmissing',
          'eventarc.googleapis.com/Trigger',
          MISSING,
        ),
        'domains/ordering/api#onOrder': subscription(
          ORDER_SUBSCRIPTION_ID,
          'pubsub.googleapis.com/Subscription',
          `projects/my-project/subscriptions/${ORDER_SUBSCRIPTION_ID}`,
        ),
      },
    },
  },
};

const TRANSPORTS = new Map([[UPLOAD, { subscription: UPLOAD_SUBSCRIPTION }]]);

describe('eventarc-triggers', () => {
  let context: WorkspaceContext;
  let listTriggers: jest.Mock<(request: any) => Promise<any>>;

  beforeEach(() => {
    context = makeContext();
    listTriggers = jest.fn(async ({ parent, pageToken }) => {
      if (parent === 'projects/my-project/locations/global') {
        return { data: { triggers: [{ name: AUDIT }] } };
      }

      return pageToken
        ? {
            data: {
              triggers: [
                {
                  name: 'projects/my-project/locations/europe-west1/triggers/other',
                  transport: { pubsub: { subscription: 'other' } },
                },
              ],
            },
          }
        : {
            data: {
              triggers: [
                {
                  name: UPLOAD,
                  transport: { pubsub: { subscription: UPLOAD_SUBSCRIPTION } },
                },
              ],
              nextPageToken: '📄',
            },
          };
    });
    jest
      .spyOn(context.service(GoogleApisService), 'getClient')
      .mockImplementation(
        async () =>
          ({
            projects: { locations: { triggers: { list: listTriggers } } },
          }) as never,
      );
  });

  describe('EventarcTriggersFact', () => {
    it('should not list triggers when the graph has no Eventarc trigger', async () => {
      const environment = await makeEnvironment(context);

      const actualTransports = await environment.get(EventarcTriggersFact);

      expect(actualTransports).toEqual(new Map());
      expect(
        context.service(GoogleApisService).getClient,
      ).not.toHaveBeenCalled();
    });

    it('should list the triggers once per project and location, and return their subscriptions', async () => {
      const environment = await makeEnvironment(context, GRAPH);

      const actualTransports = await environment.get(EventarcTriggersFact);

      expect(actualTransports).toEqual(TRANSPORTS);
      expect(listTriggers).toHaveBeenCalledTimes(3);
      expect(listTriggers).toHaveBeenCalledWith({
        parent: 'projects/my-project/locations/europe-west1',
        pageSize: 1000,
        pageToken: undefined,
      });
      expect(listTriggers).toHaveBeenCalledWith({
        parent: 'projects/my-project/locations/europe-west1',
        pageSize: 1000,
        pageToken: '📄',
      });
      expect(listTriggers).toHaveBeenCalledWith({
        parent: 'projects/my-project/locations/global',
        pageSize: 1000,
        pageToken: undefined,
      });
      const fact = environment.facts.find(
        (f) => f.name === 'EventarcTriggersFact',
      );
      expect(fact?.warnings).toIncludeSameMembers([
        {
          message: `The Eventarc trigger '${AUDIT}' of 'brokerSubscription:domains/ordering/api#onAudit' does not deliver events through a Pub/Sub subscription.`,
        },
        {
          message: `The Eventarc trigger '${MISSING}' of 'brokerSubscription:domains/ordering/api#onMissing' does not exist.`,
        },
      ]);
    });

    it('should fail when some triggers cannot be listed', async () => {
      listTriggers.mockRejectedValueOnce(new Error('💥'));
      const environment = await makeEnvironment(context, GRAPH);

      const actualPromise = environment.get(EventarcTriggersFact);

      await expect(actualPromise).rejects.toThrow(GraphFactError);
      expect(environment.failures).toEqual([
        {
          name: 'EventarcTriggersFact',
          message: expect.stringMatching(
            /^Failed to list the Eventarc triggers in 'projects\/my-project\/locations\/[\w-]+': 💥$/,
          ),
        },
      ]);
    });
  });

  describe('EVENTARC_TRIGGER_MAPPING', () => {
    it('should resolve the subscriptions of Eventarc triggers to the triggers', async () => {
      const environment = await makeEnvironment(context, GRAPH, AT, [
        [EventarcTriggersFact, TRANSPORTS],
      ]);
      const key = (id: string) => ({
        project: 'my-project',
        labels: { 'resource.label.subscription_id': id },
      });

      const prepared = await prepareMonitoringMapping(
        environment,
        EVENTARC_TRIGGER_MAPPING,
      );

      expect(prepared?.resolve(key(UPLOAD_SUBSCRIPTION_ID))).toEqual(UPLOAD);
      expect(prepared?.resolve(key(ORDER_SUBSCRIPTION_ID))).toBeUndefined();
    });

    it('should extend the metrics of Pub/Sub subscriptions to Eventarc triggers', () => {
      const pubSubMetrics = MONITORING_METRICS.filter(
        (m) => m.mapping === PUBSUB_SUBSCRIPTION_MAPPING,
      );

      const actualMetrics = MONITORING_METRICS.filter(
        (m) => m.mapping === EVENTARC_TRIGGER_MAPPING,
      );

      expect(actualMetrics).toEqual(
        pubSubMetrics.map((m) => ({
          ...m,
          mapping: EVENTARC_TRIGGER_MAPPING,
        })),
      );
      expect(actualMetrics.map((m) => m.metric)).toEqual([
        'backlog',
        'backlogAge',
        'delivered',
        'acked',
        'pushRequests',
        'pushLatency',
      ]);
    });

    it('should read the metrics of the subscriptions of Eventarc triggers', async () => {
      const { client } = context.service(CloudMonitoringService);
      jest.spyOn(client, 'initialize').mockResolvedValue({});
      const point = (value: number) => ({
        interval: { endTime: { seconds: `${AT.getTime() / 1000}` } },
        value: { int64Value: `${value}` },
      });
      const listTimeSeries = jest
        .spyOn(client, 'listTimeSeries')
        .mockResolvedValue([
          [
            {
              resource: { labels: { subscription_id: UPLOAD_SUBSCRIPTION_ID } },
              metric: { labels: {} },
              points: [point(5)],
            },
            {
              resource: { labels: { subscription_id: ORDER_SUBSCRIPTION_ID } },
              metric: { labels: {} },
              points: [point(7)],
            },
          ],
        ] as never);
      const environment = await makeEnvironment(context, GRAPH, AT, [
        [EventarcTriggersFact, TRANSPORTS],
      ]);
      const backlog = MONITORING_METRICS.find(
        (m) => m.metric === 'backlog' && m.mapping === EVENTARC_TRIGGER_MAPPING,
      )!;

      const actualResult = await queryMonitoringMetric(
        environment,
        backlog,
        { end: AT, period: 300, count: 1 },
        new BucketLayoutRegistry(),
      );

      expect([...actualResult.values]).toEqual([
        ['brokerSubscription:domains/ordering/api#onUpload', [{ value: 5 }]],
      ]);
      expect(actualResult.errors).toBeEmpty();
      expect(actualResult.warnings).toBeEmpty();
      expect(listTimeSeries).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({
          name: 'projects/my-project',
          filter:
            'metric.type = "pubsub.googleapis.com/subscription/num_undelivered_messages" AND resource.type = "pubsub_subscription" AND project = "my-project"',
        }),
      );
    });

    it('should attach the alerts on the subscriptions of Eventarc triggers', async () => {
      const subscriptionAlert = (id: string, subscriptionId: string) => ({
        name: `projects/my-project/alerts/${id}`,
        policy: { displayName: 'Unacked messages', severity: 'ERROR' },
        openTime: '2026-10-01T11:50:00Z',
        resource: {
          type: 'pubsub_subscription',
          labels: { project_id: 'my-project', subscription_id: subscriptionId },
        },
      });
      const listAlerts = jest.fn(async () => ({
        data: {
          alerts: [
            subscriptionAlert('upload', UPLOAD_SUBSCRIPTION_ID),
            subscriptionAlert('order', ORDER_SUBSCRIPTION_ID),
          ],
        },
      }));
      jest
        .spyOn(context.service(GoogleApisService), 'getClient')
        .mockImplementation(
          async () => ({ projects: { alerts: { list: listAlerts } } }) as never,
        );
      const environment = await makeEnvironment(context, GRAPH, AT, [
        [EventarcTriggersFact, TRANSPORTS],
      ]);

      const actualOutput = await googleCloudMonitoringAlerts.fetch(environment);

      expect(Object.keys(actualOutput.nodes ?? {})).toIncludeSameMembers([
        'brokerSubscription:domains/ordering/api#onUpload',
        'brokerSubscription:domains/ordering/api#onOrder',
      ]);
      expect(actualOutput.warnings).toBeEmpty();
    });
  });
});

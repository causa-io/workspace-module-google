import { WorkspaceContext } from '@causa/workspace';
import { GraphOriginKind, type Graph } from '@causa/workspace-core';
import {
  GraphEnvironmentContext,
  listGraphNodes,
  type GraphEnvironmentFactType,
} from '@causa/workspace-core/graph';
import { createContext } from '@causa/workspace/testing';
import { pino } from 'pino';

const origin = {
  kind: GraphOriginKind.Declared,
  rule: 'test',
  sources: [{ path: 'causa.yaml' }],
};

const node = (name: string, resource?: Record<string, string>) => ({
  name,
  origin,
  ...(resource ? { data: { resource } } : {}),
});

export const AT = new Date('2026-10-01T12:00:00Z');

export const ENVIRONMENT_GRAPH: Graph = {
  name: 'shop',
  environment: { name: 'prod', at: AT, window: 300 },
  nodes: {
    architecture: {
      project: { 'domains/ordering/api': node('ordering-api') },
    },
    infrastructure: {
      service: {
        'domains/ordering/api#ordering-api': node('ordering-api', {
          type: 'run.googleapis.com/Service',
          id: 'projects/my-project/locations/europe-west1/services/ordering-api',
        }),
        'domains/ordering/api#ordering-events': node('ordering-events', {
          type: 'run.googleapis.com/Service',
          id: 'projects/my-project/locations/europe-west1/services/ordering-events',
        }),
        // A service whose resource could not be resolved, and was removed.
        'domains/other/api#other-api': node('other-api'),
      },
      apiRouter: {
        api: node('api', {
          type: 'compute.googleapis.com/UrlMap',
          id: 'projects/my-project/global/urlMaps/api',
        }),
      },
      brokerTopic: {
        'ordering.order.v1': node('ordering.order.v1', {
          type: 'pubsub.googleapis.com/Topic',
          id: 'projects/my-project/topics/ordering.order.v1',
        }),
      },
      brokerSubscription: {
        'domains/ordering/api#handleOrder': node('handleOrder', {
          type: 'pubsub.googleapis.com/Subscription',
          id: 'projects/my-project/subscriptions/run-ordering-events-handleOrder',
        }),
      },
      queue: {
        'order-expiration': node('order-expiration', {
          type: 'cloudtasks.googleapis.com/Queue',
          id: 'projects/my-project/locations/europe-west1/queues/order-expiration-abc',
        }),
        // A queue only known by its prefix, which could not be resolved, and was removed.
        'order-expiration-late': node('order-expiration-late'),
      },
      scheduledJob: {
        'domains/ordering/api#expireOrders': node('expireOrders', {
          type: 'cloudscheduler.googleapis.com/Job',
          id: 'projects/my-project/locations/europe-west1/jobs/run-ordering-events-expireOrders',
        }),
      },
      'google.spanner.instance': {
        main: node('main', {
          type: 'spanner.googleapis.com/Instance',
          id: 'projects/my-project/instances/main',
        }),
      },
      database: {
        'google.spanner/main.ordering': node('ordering', {
          type: 'spanner.googleapis.com/Database',
          id: 'projects/my-project/instances/main/databases/ordering',
        }),
        'google.firestore/(default)': node('(default)', {
          type: 'firestore.googleapis.com/Database',
          id: 'projects/my-project/databases/(default)',
        }),
        'google.bigquery/raw_events': node('raw_events', {
          type: 'bigquery.googleapis.com/Dataset',
          id: 'projects/my-project/datasets/raw_events',
        }),
      },
      table: {
        'google.bigquery/raw_events#ordering_order_v1': node(
          'ordering_order_v1',
          {
            type: 'bigquery.googleapis.com/Table',
            id: 'projects/my-project/datasets/raw_events/tables/ordering_order_v1',
          },
        ),
      },
    },
  },
  edges: {
    routes: [
      {
        from: 'apiRouter:api',
        to: 'service:domains/ordering/api#ordering-api',
        origin,
        data: { paths: ['/orders'] },
      },
    ],
  },
};

export const ENVIRONMENT_NODES = listGraphNodes(ENVIRONMENT_GRAPH);

export function makeContext(): WorkspaceContext {
  return createContext({
    environment: 'prod',
    configuration: {
      workspace: { name: 'shop' },
      google: { project: 'my-project' },
    },
    logger: pino({ level: 'silent' }),
  }).context;
}

export async function makeEnvironment(
  context: WorkspaceContext = makeContext(),
  graph: Graph = ENVIRONMENT_GRAPH,
  at: Date = AT,
  facts: [GraphEnvironmentFactType<unknown>, unknown][] = [],
): Promise<GraphEnvironmentContext> {
  return await GraphEnvironmentContext.create(
    context,
    { ...graph, environment: undefined },
    { at, window: 300, facts },
  );
}

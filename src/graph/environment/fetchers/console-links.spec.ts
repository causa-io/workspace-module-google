import { GraphOriginKind, type Graph } from '@causa/workspace-core';
import { jest } from '@jest/globals';
import 'jest-extended';
import { GoogleApisService } from '../../../services/index.js';
import { EventarcTriggersFact } from '../eventarc-triggers.js';
import { AT, makeContext, makeEnvironment } from '../fixture.test.js';
import { googleConsoleLinks } from './console-links.js';

const TRIGGER =
  'projects/my-project/locations/europe-west1/triggers/run-ordering-api-onupload';

const EVENTARC_GRAPH: Graph = {
  name: 'shop',
  nodes: {
    infrastructure: {
      brokerSubscription: {
        'domains/ordering/api#onUpload': {
          name: 'run-ordering-api-onupload',
          origin: {
            kind: GraphOriginKind.Declared,
            rule: 'test',
            sources: [{ path: 'causa.yaml' }],
          },
          data: {
            resource: { type: 'eventarc.googleapis.com/Trigger', id: TRIGGER },
          },
        },
      },
    },
  },
};

const EVENTARC_LINK = {
  label: 'Eventarc trigger',
  url: 'https://console.cloud.google.com/eventarc/triggers/europe-west1/run-ordering-api-onupload?project=my-project',
};

describe('googleConsoleLinks', () => {
  it('should build links to the console for resources with a full name', async () => {
    const actualOutput = await googleConsoleLinks.fetch(
      await makeEnvironment(),
    );

    const links = Object.fromEntries(
      Object.entries(actualOutput.nodes ?? {}).map(([id, { data }]) => [
        id,
        data?.links,
      ]),
    );
    expect(links).toEqual({
      'service:domains/ordering/api#ordering-api': [
        {
          label: 'Cloud Run service',
          url: 'https://console.cloud.google.com/run/detail/europe-west1/ordering-api/metrics?project=my-project',
        },
        {
          label: 'Cloud Run service logs',
          url: 'https://console.cloud.google.com/run/detail/europe-west1/ordering-api/logs?project=my-project',
        },
      ],
      'service:domains/ordering/api#ordering-events': [
        {
          label: 'Cloud Run service',
          url: 'https://console.cloud.google.com/run/detail/europe-west1/ordering-events/metrics?project=my-project',
        },
        {
          label: 'Cloud Run service logs',
          url: 'https://console.cloud.google.com/run/detail/europe-west1/ordering-events/logs?project=my-project',
        },
      ],
      'apiRouter:api': [
        {
          label: 'Load balancers',
          url: 'https://console.cloud.google.com/net-services/loadbalancing/list/loadBalancers?project=my-project',
        },
      ],
      'brokerTopic:ordering.order.v1': [
        {
          label: 'Pub/Sub topic',
          url: 'https://console.cloud.google.com/cloudpubsub/topic/detail/ordering.order.v1?project=my-project',
        },
      ],
      'brokerSubscription:domains/ordering/api#handleOrder': [
        {
          label: 'Pub/Sub subscription',
          url: 'https://console.cloud.google.com/cloudpubsub/subscription/detail/run-ordering-events-handleOrder?project=my-project',
        },
      ],
      'queue:order-expiration': [
        {
          label: 'Cloud Tasks queue',
          url: 'https://console.cloud.google.com/cloudtasks/queue/europe-west1/order-expiration-abc/tasks?project=my-project',
        },
      ],
      'scheduledJob:domains/ordering/api#expireOrders': [
        {
          label: 'Cloud Scheduler jobs',
          url: 'https://console.cloud.google.com/cloudscheduler?project=my-project',
        },
      ],
      'google.spanner.instance:main': [
        {
          label: 'Spanner instance',
          url: 'https://console.cloud.google.com/spanner/instances/main/details/databases?project=my-project',
        },
      ],
      'database:google.spanner/main.ordering': [
        {
          label: 'Spanner database',
          url: 'https://console.cloud.google.com/spanner/instances/main/databases/ordering/details/tables?project=my-project',
        },
      ],
      'database:google.firestore/(default)': [
        {
          label: 'Firestore database',
          url: 'https://console.cloud.google.com/firestore/databases/-default-/data?project=my-project',
        },
      ],
      'database:google.bigquery/raw_events': [
        {
          label: 'BigQuery dataset',
          url: 'https://console.cloud.google.com/bigquery?project=my-project&p=my-project&d=raw_events&page=dataset',
        },
      ],
      'table:google.bigquery/raw_events#ordering_order_v1': [
        {
          label: 'BigQuery table',
          url: 'https://console.cloud.google.com/bigquery?project=my-project&p=my-project&d=raw_events&t=ordering_order_v1&page=table',
        },
      ],
    });
  });

  it('should link Eventarc triggers to the Pub/Sub subscription through which they deliver events', async () => {
    const environment = await makeEnvironment(
      makeContext(),
      EVENTARC_GRAPH,
      AT,
      [
        [
          EventarcTriggersFact,
          new Map([
            [
              TRIGGER,
              {
                subscription: 'projects/my-project/subscriptions/eventarc-sub',
              },
            ],
          ]),
        ],
      ],
    );

    const actualOutput = await googleConsoleLinks.fetch(environment);

    expect(actualOutput.nodes).toEqual({
      'brokerSubscription:domains/ordering/api#onUpload': {
        data: {
          links: [
            EVENTARC_LINK,
            {
              label: 'Pub/Sub subscription',
              url: 'https://console.cloud.google.com/cloudpubsub/subscription/detail/eventarc-sub?project=my-project',
            },
          ],
        },
      },
    });
  });

  it('should only link Eventarc triggers when their subscriptions cannot be listed', async () => {
    const context = makeContext();
    jest
      .spyOn(context.service(GoogleApisService), 'getClient')
      .mockRejectedValue(new Error('💥'));
    const environment = await makeEnvironment(context, EVENTARC_GRAPH);

    const actualOutput = await googleConsoleLinks.fetch(environment);

    expect(actualOutput.nodes).toEqual({
      'brokerSubscription:domains/ordering/api#onUpload': {
        data: { links: [EVENTARC_LINK] },
      },
    });
    expect(environment.failures).toEqual([
      { name: 'EventarcTriggersFact', message: '💥' },
    ]);
  });
});

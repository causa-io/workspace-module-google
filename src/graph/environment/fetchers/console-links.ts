import type {
  GraphEnvironmentFetcher,
  GraphEnvironmentNodeOutput,
  GraphLink,
} from '@causa/workspace-core';
import {
  GraphFactError,
  type GraphEnvironmentContext,
} from '@causa/workspace-core/graph';
import { EventarcTriggersFact } from '../eventarc-triggers.js';
import {
  googleResources,
  parseResourceName,
  type ResourceNameSegments,
} from '../resources.js';

/**
 * The base URL of the Google Cloud console.
 */
const CONSOLE_URL = 'https://console.cloud.google.com';

/**
 * Builds the URL of a page of the Google Cloud console.
 *
 * @param segments The segments of the path of the page, which are encoded.
 * @param project The GCP project.
 * @param query Additional query parameters.
 * @returns The URL.
 */
export function consoleUrl(
  segments: string[],
  project: string,
  query: Record<string, string> = {},
): string {
  const path = segments.map(encodeURIComponent).join('/');
  const parameters = new URLSearchParams({ project, ...query });
  return `${CONSOLE_URL}/${path}?${parameters}`;
}

/**
 * Builds the links of a resource from the segments of its name, or from the environment when the name is not enough.
 */
type LinkBuilder = (
  segments: ResourceNameSegments,
  environment: GraphEnvironmentContext,
) => GraphLink[] | Promise<GraphLink[]>;

/**
 * Builds the link to a Pub/Sub subscription.
 */
const pubSubSubscriptionLinks = ({
  projects,
  subscriptions,
}: ResourceNameSegments): GraphLink[] => [
  {
    label: 'Pub/Sub subscription',
    url: consoleUrl(
      ['cloudpubsub', 'subscription', 'detail', subscriptions],
      projects,
    ),
  },
];

/**
 * The builders of links, keyed by resource type.
 */
const LINK_BUILDERS: Record<string, LinkBuilder> = {
  'run.googleapis.com/Service': ({ projects, locations, services }) => [
    {
      label: 'Cloud Run service',
      url: consoleUrl(
        ['run', 'detail', locations, services, 'metrics'],
        projects,
      ),
    },
    {
      label: 'Cloud Run service logs',
      url: consoleUrl(['run', 'detail', locations, services, 'logs'], projects),
    },
  ],
  'pubsub.googleapis.com/Topic': ({ projects, topics }) => [
    {
      label: 'Pub/Sub topic',
      url: consoleUrl(['cloudpubsub', 'topic', 'detail', topics], projects),
    },
  ],
  'pubsub.googleapis.com/Subscription': pubSubSubscriptionLinks,
  // Eventarc triggers also link to the Pub/Sub subscription through which they deliver events.
  'eventarc.googleapis.com/Trigger': async (segments, environment) => {
    const { projects, locations, triggers } = segments;
    let subscription: string | undefined;
    try {
      const transports = await environment.get(EventarcTriggersFact);
      subscription = transports.get(
        `projects/${projects}/locations/${locations}/triggers/${triggers}`,
      )?.subscription;
    } catch (error) {
      // The failure to list the triggers is reported by the fact.
      if (!(error instanceof GraphFactError)) {
        throw error;
      }
    }

    return [
      {
        label: 'Eventarc trigger',
        url: consoleUrl(
          ['eventarc', 'triggers', locations, triggers],
          projects,
        ),
      },
      ...(subscription
        ? pubSubSubscriptionLinks(parseResourceName(subscription))
        : []),
    ];
  },
  'cloudtasks.googleapis.com/Queue': ({ projects, locations, queues }) => [
    {
      label: 'Cloud Tasks queue',
      url: consoleUrl(
        ['cloudtasks', 'queue', locations, queues, 'tasks'],
        projects,
      ),
    },
  ],
  'cloudscheduler.googleapis.com/Job': ({ projects }) => [
    {
      label: 'Cloud Scheduler jobs',
      url: consoleUrl(['cloudscheduler'], projects),
    },
  ],
  'spanner.googleapis.com/Instance': ({ projects, instances }) => [
    {
      label: 'Spanner instance',
      url: consoleUrl(
        ['spanner', 'instances', instances, 'details', 'databases'],
        projects,
      ),
    },
  ],
  'spanner.googleapis.com/Database': ({ projects, instances, databases }) => [
    {
      label: 'Spanner database',
      url: consoleUrl(
        [
          'spanner',
          'instances',
          instances,
          'databases',
          databases,
          'details',
          'tables',
        ],
        projects,
      ),
    },
  ],
  'firestore.googleapis.com/Database': ({ projects, databases }) => [
    {
      label: 'Firestore database',
      url: consoleUrl(
        [
          'firestore',
          'databases',
          databases === '(default)' ? '-default-' : databases,
          'data',
        ],
        projects,
      ),
    },
  ],
  'bigquery.googleapis.com/Dataset': ({ projects, datasets }) => [
    {
      label: 'BigQuery dataset',
      url: consoleUrl(['bigquery'], projects, {
        p: projects,
        d: datasets,
        page: 'dataset',
      }),
    },
  ],
  'bigquery.googleapis.com/Table': ({ projects, datasets, tables }) => [
    {
      label: 'BigQuery table',
      url: consoleUrl(['bigquery'], projects, {
        p: projects,
        d: datasets,
        t: tables,
        page: 'table',
      }),
    },
  ],
  'compute.googleapis.com/UrlMap': ({ projects }) => [
    {
      label: 'Load balancers',
      url: consoleUrl(
        ['net-services', 'loadbalancing', 'list', 'loadBalancers'],
        projects,
      ),
    },
  ],
};

/**
 * Builds links to the Google Cloud console for the nodes' resources.
 */
export const googleConsoleLinks: GraphEnvironmentFetcher = {
  name: 'googleConsoleLinks',
  description:
    'The `links` of nodes whose resource is a Google Cloud resource, to the Google Cloud console.',
  fetch: async (environment) => {
    const nodes: Record<string, GraphEnvironmentNodeOutput> = {};
    for (const { node, type, segments } of googleResources(environment)) {
      const builder = LINK_BUILDERS[type];
      if (builder && segments.projects) {
        nodes[node.id] = {
          data: { links: await builder(segments, environment) },
        };
      }
    }

    return { nodes };
  },
};

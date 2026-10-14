import {
  GraphEnvironmentFact,
  type GraphEnvironmentContext,
  type GraphFactOutput,
} from '@causa/workspace-core/graph';
import type { eventarc_v1 } from 'googleapis';
import type { MonitoringResourceMapping } from './monitoring-mappings.js';
import { googleResources } from './resources.js';

/**
 * The type of the resource of nodes realized by Eventarc triggers.
 */
export const EVENTARC_TRIGGER_RESOURCE_TYPE = 'eventarc.googleapis.com/Trigger';

/**
 * The Pub/Sub resources through which an Eventarc trigger delivers events.
 */
export type EventarcTriggerTransport = {
  /**
   * The full name of the Pub/Sub subscription, managed by Eventarc.
   */
  readonly subscription: string;
};

/**
 * Lists the Eventarc triggers of the graph's nodes, once per project and location, and returns the Pub/Sub subscription
 * through which each delivers events, keyed by the full name of the trigger. No API is called if the graph has no
 * Eventarc trigger. The fact fails if some triggers cannot be listed, and warns about the triggers of the graph that do
 * not exist, or have no subscription.
 */
export class EventarcTriggersFact extends GraphEnvironmentFact<
  ReadonlyMap<string, EventarcTriggerTransport>
> {
  async compute(
    environment: GraphEnvironmentContext,
  ): Promise<GraphFactOutput<ReadonlyMap<string, EventarcTriggerTransport>>> {
    const resources = googleResources(
      environment,
      EVENTARC_TRIGGER_RESOURCE_TYPE,
    );
    if (resources.length === 0) {
      return { value: new Map() };
    }

    const parents = new Set(
      resources.map(
        ({ segments }) =>
          `projects/${segments.projects}/locations/${segments.locations}`,
      ),
    );
    const { GoogleApisService } = await import('../../services/google-apis.js');
    const client = await environment.context
      .service(GoogleApisService)
      .getClient('eventarc', 'v1', {});
    const listed = await Promise.all(
      [...parents].map(async (parent) => {
        const triggers: eventarc_v1.Schema$Trigger[] = [];
        try {
          let pageToken: string | undefined;
          do {
            const { data } = await client.projects.locations.triggers.list({
              parent,
              pageSize: 1000,
              pageToken,
            });
            triggers.push(...(data.triggers ?? []));
            pageToken = data.nextPageToken ?? undefined;
          } while (pageToken);
        } catch (error: any) {
          throw new Error(
            `Failed to list the Eventarc triggers in '${parent}': ${error.message ?? error}`,
            { cause: error },
          );
        }

        return triggers;
      }),
    );

    const subscriptions = new Map(
      listed
        .flat()
        .flatMap(({ name, transport }) =>
          name ? [[name, transport?.pubsub?.subscription ?? undefined]] : [],
        ),
    );
    const value = new Map<string, EventarcTriggerTransport>();
    const warnings = resources.flatMap(({ node, name }) => {
      if (!subscriptions.has(name)) {
        return [
          {
            message: `The Eventarc trigger '${name}' of '${node.id}' does not exist.`,
          },
        ];
      }

      const subscription = subscriptions.get(name);
      if (!subscription) {
        return [
          {
            message: `The Eventarc trigger '${name}' of '${node.id}' does not deliver events through a Pub/Sub subscription.`,
          },
        ];
      }

      value.set(name, { subscription });
      return [];
    });

    return { value, warnings };
  }
}

/**
 * The mapping of the time series and alerts of the Pub/Sub subscriptions managed by Eventarc to the nodes realized by
 * Eventarc triggers. Subscriptions are resolved from the triggers listed by {@link EventarcTriggersFact}.
 */
export const EVENTARC_TRIGGER_MAPPING: MonitoringResourceMapping = {
  nodeType: 'brokerSubscription',
  resourceType: EVENTARC_TRIGGER_RESOURCE_TYPE,
  monitoredResource: 'pubsub_subscription',
  keyLabels: ['resource.label.subscription_id'],
  resolver: async (environment) => {
    const triggers = await environment.get(EventarcTriggersFact);
    const bySubscription = new Map(
      [...triggers].map(([trigger, { subscription }]) => [
        subscription,
        trigger,
      ]),
    );
    return ({ project, labels }) =>
      bySubscription.get(
        `projects/${project}/subscriptions/${labels['resource.label.subscription_id']}`,
      );
  },
};

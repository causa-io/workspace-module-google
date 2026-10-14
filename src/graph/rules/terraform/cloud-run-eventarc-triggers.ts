import {
  type BrokerSubscriptionGraphNodeData,
  type GraphRuleEdge,
  type GraphRuleNode,
  type GraphRuleOutput,
  type GraphWarning,
} from '@causa/workspace-core';
import {
  brokerSubscriptionId,
  nodeId,
  triggerId,
  triggerLocator,
  type GraphContext,
  type GraphTemplatePart,
} from '@causa/workspace-core/graph';
import { terraformDeploys } from '@causa/workspace-terraform';
import {
  CloudRunFact,
  type CloudRunService,
  type ServiceContainerTrigger,
} from '../../cloud-run.js';
import { blockResource } from '../../terraform-modules.js';

/**
 * Returns the location part of the name of an Eventarc trigger, as the module sets it: the trigger's
 * `google.eventarc.location`, defaulting to the location of the service.
 * A location that is not a literal, e.g. a `$format` template, references its path in the project configuration, such
 * that it is rendered along with the rest of the identifier.
 *
 * @param service The Cloud Run service the trigger targets.
 * @param name The name of the trigger.
 * @param trigger The trigger.
 * @returns The location part.
 */
function locationPart(
  service: CloudRunService,
  name: string,
  trigger: ServiceContainerTrigger,
): GraphTemplatePart {
  const location = (trigger['google.eventarc'] as any)?.location;
  if (location === undefined || location === null) {
    return service.locationPart;
  }

  if (typeof location === 'string') {
    return location;
  }

  return {
    configuration: `serviceContainer.triggers[${JSON.stringify(name)}]["google.eventarc"].location`,
  };
}

/**
 * A `brokerSubscription` per Eventarc trigger of a project, for each Cloud Run module block deploying it with Eventarc
 * triggers enabled. Eventarc delivers events through a Pub/Sub push subscription it manages, which the node stands for.
 * The locator is the trigger's. The module names the Eventarc trigger `run-<service>-<trigger>`, lowercased and with
 * `_` replaced by `-`. The subscription is only known from the Eventarc trigger, which is the resource of the node.
 *
 * Each subscription `realizes` its trigger, and `targets` the service its module block deploys. Its `eventType` is the
 * value of the trigger's `type` filter, when it is a literal.
 *
 * @param graph The context of the extraction.
 * @returns The subscriptions, and their edges.
 */
export async function cloudRunEventarcTriggers(
  graph: GraphContext,
): Promise<GraphRuleOutput> {
  const { locator } = graph;
  const cloudRun = await graph.get(CloudRunFact);
  const nodes: GraphRuleNode[] = [];
  const edges: GraphRuleEdge[] = [];
  const warnings: GraphWarning[] = [];

  const subscriptions = new Set<string>();
  for (const service of cloudRun) {
    const source = service.block.declaration;
    for (const [name, trigger] of service.eventarcTriggers) {
      const subscriptionLocator = triggerLocator(
        service.project.directory,
        name,
      );
      const subscriptionId = brokerSubscriptionId(subscriptionLocator);
      if (subscriptions.has(subscriptionLocator)) {
        warnings.push({
          message: `Trigger '${name}' of '${service.project.name}' is deployed with Eventarc triggers by several module blocks. A single subscription node stands for several subscriptions.`,
          sources: [source],
        });
      }
      subscriptions.add(subscriptionLocator);

      const filters = (trigger['google.eventarc'] as any)?.filters;
      const eventType = Array.isArray(filters)
        ? filters.find((f) => f?.attribute === 'type')?.value
        : undefined;
      const eventarcTrigger = `run-${service.name}-${name}`
        .toLowerCase()
        .replaceAll('_', '-');
      const data: BrokerSubscriptionGraphNodeData = {
        eventType: typeof eventType === 'string' ? eventType : undefined,
        resource: await blockResource(
          graph,
          service.block,
          {
            type: 'eventarc.googleapis.com/Trigger',
            scope: service.project,
            id: [
              'projects/',
              service.projectPart,
              '/locations/',
              locationPart(service, name, trigger),
              `/triggers/${eventarcTrigger}`,
            ],
          },
          warnings,
        ),
      };
      nodes.push({
        layer: 'infrastructure',
        type: 'brokerSubscription',
        locator: subscriptionLocator,
        name: eventarcTrigger,
        sources: [
          source,
          await locator.configurationSource(service.project.context, [
            'serviceContainer',
            'triggers',
            name,
          ]),
        ],
        data,
      });
      edges.push(
        ...terraformDeploys(
          service.block,
          nodeId('brokerSubscription', subscriptionLocator),
        ),
        {
          type: 'realizes',
          from: subscriptionId,
          to: triggerId(service.project.directory, name),
          sources: [source],
        },
        {
          type: 'targets',
          from: subscriptionId,
          to: service.id,
          label: trigger.endpoint?.path,
          sources: [source],
        },
      );
    }
  }

  return { nodes, edges, warnings };
}

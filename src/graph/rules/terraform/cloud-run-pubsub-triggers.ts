import {
  type BrokerSubscriptionGraphNodeData,
  type GraphRuleEdge,
  type GraphRuleNode,
  type GraphRuleOutput,
  type GraphWarning,
} from '@causa/workspace-core';
import {
  brokerSubscriptionId,
  brokerTopicId,
  ModelFact,
  nodeId,
  triggerId,
  triggerLocator,
  type GraphContext,
} from '@causa/workspace-core/graph';
import { terraformDeploys } from '@causa/workspace-terraform';
import { CloudRunFact } from '../../cloud-run.js';
import { blockResource } from '../../terraform-modules.js';

/**
 * A push `brokerSubscription` per Pub/Sub trigger of a project, for each Cloud Run module block deploying it with
 * Pub/Sub triggers enabled. The locator is the trigger's. The module names the subscription `run-<service>-<trigger>`.
 *
 * Each subscription `realizes` its trigger, `targets` the service its module block deploys, and is delivered to by the
 * broker topic of its trigger. A topic that no event schema of the workspace defines is created outside of it, and
 * gets its own `brokerTopic` node.
 *
 * @param graph The context of the extraction.
 * @returns The subscriptions, the external broker topics, and their edges.
 */
export async function cloudRunPubSubTriggers(
  graph: GraphContext,
): Promise<GraphRuleOutput> {
  const { locator } = graph;
  const [cloudRun, model] = await Promise.all([
    graph.get(CloudRunFact),
    graph.get(ModelFact),
  ]);
  const nodes: GraphRuleNode[] = [];
  const edges: GraphRuleEdge[] = [];
  const warnings: GraphWarning[] = [];

  const subscriptions = new Set<string>();
  for (const service of cloudRun) {
    const source = service.block.declaration;
    for (const [name, trigger] of service.pubsubTriggers) {
      const subscriptionLocator = triggerLocator(
        service.project.directory,
        name,
      );
      const subscriptionId = brokerSubscriptionId(subscriptionLocator);
      if (subscriptions.has(subscriptionLocator)) {
        warnings.push({
          message: `Trigger '${name}' of '${service.project.name}' is deployed with Pub/Sub triggers by several module blocks. A single subscription node stands for several subscriptions.`,
          sources: [source],
        });
      }
      subscriptions.add(subscriptionLocator);

      const filter = (trigger['google.pubSub'] as any)?.filter;
      const subscription = `run-${service.name}-${name}`;
      const data: BrokerSubscriptionGraphNodeData = {
        filter: typeof filter === 'string' ? filter : undefined,
        resource: await blockResource(
          graph,
          service.block,
          {
            type: 'pubsub.googleapis.com/Subscription',
            scope: service.project,
            id: [
              'projects/',
              service.projectPart,
              `/subscriptions/${subscription}`,
            ],
          },
          warnings,
        ),
      };
      nodes.push({
        layer: 'infrastructure',
        type: 'brokerSubscription',
        locator: subscriptionLocator,
        name: subscription,
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

      if (typeof trigger.topic !== 'string') {
        continue;
      }

      const topicSource = await locator.configurationSource(
        service.project.context,
        ['serviceContainer', 'triggers', name, 'topic'],
      );
      edges.push({
        type: 'delivers',
        from: brokerTopicId(trigger.topic),
        to: subscriptionId,
        sources: [source, topicSource],
      });

      if (!model.topics.has(trigger.topic)) {
        nodes.push({
          layer: 'infrastructure',
          type: 'brokerTopic',
          locator: trigger.topic,
          name: trigger.topic,
          description:
            'A topic no event schema of the workspace defines, created outside of it.',
          sources: [topicSource],
        });
      }
    }
  }

  return { nodes, edges, warnings };
}

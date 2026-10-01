import {
  GraphOriginKind,
  type DatabaseGraphNodeData,
  type GraphOriginSource,
  type GraphRule,
  type GraphRuleEdge,
  type GraphRuleNode,
  type GraphWarning,
} from '@causa/workspace-core';
import {
  brokerSubscriptionId,
  brokerTopicId,
  databaseId,
  ModelFact,
  nodeId,
  tableId,
  tableLocator,
  topicId,
  type GraphContext,
  type GraphTemplatePart,
} from '@causa/workspace-core/graph';
import { terraformDeploys } from '@causa/workspace-terraform';
import { relative } from 'path';
import type { GoogleConfiguration } from '../../../configurations/index.js';
import { rawEventsTableName } from '../../../functions/google-pubsub/index.js';
import {
  BIGQUERY_ENGINE,
  bigQueryDatasetLocator,
  rawEventsSubscriptionLocator,
} from '../../ids.js';
import {
  blockResource,
  infrastructureModules,
  argumentOrConfiguration,
  type InfrastructureModule,
} from '../../terraform-modules.js';

/**
 * The source of the Causa Terraform module creating the Pub/Sub topics, and the raw events BigQuery tables.
 */
export const EVENT_TOPICS_MODULE_SOURCE = 'causa-io/event-topics-pubsub/google';

/**
 * The configuration defining the raw events BigQuery dataset, when the block does not set it.
 */
const RAW_EVENTS_DATASET_CONFIGURATION =
  'google.pubSub.bigQueryStorage.rawEventsDatasetId';

/**
 * The raw events BigQuery dataset of an event topics module block.
 */
type RawEventsDataset = {
  /**
   * The ID of the dataset.
   */
  readonly dataset: string;

  /**
   * The dataset part of resource names.
   */
  readonly part: GraphTemplatePart;

  /**
   * The locator of the `database` node.
   */
  readonly locator: string;

  /**
   * The sources of the dataset, in addition to the block: the configuration defining it, if any.
   */
  readonly sources: GraphOriginSource[];
};

/**
 * Returns the raw events dataset of an event topics module block: its `bigquery_raw_events_dataset` argument, or the
 * `google.pubSub.bigQueryStorage.rawEventsDatasetId` configuration.
 *
 * @param graph The context of the extraction.
 * @param module The event topics module block.
 * @param warnings The warnings of the rule, to which the one about a computed argument is added.
 * @returns The dataset, or `undefined` if raw events are not stored.
 */
async function rawEventsDataset(
  graph: GraphContext,
  module: InfrastructureModule,
  warnings: GraphWarning[],
): Promise<RawEventsDataset | undefined> {
  const part = argumentOrConfiguration(
    module.block,
    'bigquery_raw_events_dataset',
    RAW_EVENTS_DATASET_CONFIGURATION,
    warnings,
  );
  if (typeof part === 'string') {
    return {
      dataset: part,
      part,
      locator: bigQueryDatasetLocator(part),
      sources: [],
    };
  }

  const dataset = module.context
    .asConfiguration<GoogleConfiguration>()
    .get(RAW_EVENTS_DATASET_CONFIGURATION);
  if (typeof dataset !== 'string') {
    return undefined;
  }

  return {
    dataset,
    part,
    locator: bigQueryDatasetLocator(dataset),
    sources: [
      await graph.locator.configurationSource(
        module.context,
        RAW_EVENTS_DATASET_CONFIGURATION.split('.'),
      ),
    ],
  };
}

/**
 * The resources created by the event topics module block.
 *
 * - A `brokerTopic` node per event topic, named by the topic ID: the module creates one Pub/Sub topic per topic listed
 *   by `EventTopicList`. It `realizes` the event topic of the same ID.
 * - When the block has a raw events dataset (`bigquery_raw_events_dataset`, or
 *   `google.pubSub.bigQueryStorage.rawEventsDatasetId`), a `database` node for the BigQuery dataset, and for each
 *   topic:
 *   - A `table` node, named by the topic ID with `.` and `-` replaced by `_`.
 *   - A BigQuery `brokerSubscription` node: the module creates one `bq-<topic>` subscription per topic, writing events
 *     to the topic's raw table. The broker topic `delivers` to it, and it `targets` the table.
 */
export const eventTopicsModule: GraphRule = {
  name: 'eventTopicsModule',
  kind: GraphOriginKind.Declared,
  description:
    'One `brokerTopic` per event topic for the first event topics module block, realizing the topic. When the block has a raw events BigQuery dataset, one `database` node for the dataset, and for each topic one `table` node, named by the topic ID with `.` and `-` replaced by `_`, and one `brokerSubscription` (`rawEvents/<topic>`) delivered to by the broker topic and targeting the table. Each resource is linked by a `deploys` edge from the projects applying the block.',
  async run(graph) {
    const { context } = graph;
    const [eventTopics, model] = await Promise.all([
      infrastructureModules(graph, EVENT_TOPICS_MODULE_SOURCE),
      graph.get(ModelFact),
    ]);
    const nodes: GraphRuleNode[] = [];
    const edges: GraphRuleEdge[] = [];
    const warnings: GraphWarning[] = [];

    const [module, ...skipped] = eventTopics;
    if (!module) {
      if (model.topics.size > 0) {
        warnings.push({
          message:
            'There is no event topics module block: no broker topics are created for the event topics.',
        });
      }

      return { warnings };
    }

    warnings.push(
      ...skipped.map((m) => ({
        message:
          'The event topics module block is skipped: only the first one is processed, as several blocks would create resources with the same IDs.',
        sources: [m.block.declaration],
      })),
    );

    const source = module.block.declaration;
    const projectPart = argumentOrConfiguration(
      module.block,
      'gcp_project_id',
      'google.project',
      warnings,
    );
    const rawEvents = await rawEventsDataset(graph, module, warnings);

    if (rawEvents) {
      const data: DatabaseGraphNodeData = {
        engine: BIGQUERY_ENGINE,
        resource: await blockResource(
          graph,
          module.block,
          {
            type: 'bigquery.googleapis.com/Dataset',
            scope: module.project,
            id: ['projects/', projectPart, '/datasets/', rawEvents.part],
          },
          warnings,
        ),
      };
      nodes.push({
        layer: 'infrastructure',
        type: 'database',
        locator: rawEvents.locator,
        name: rawEvents.dataset,
        description: 'Raw events from Pub/Sub, one table per topic.',
        sources: [source, ...rawEvents.sources],
        data,
      });
      edges.push(
        ...terraformDeploys(
          module.block,
          nodeId('database', rawEvents.locator),
        ),
      );
    }

    for (const topic of model.topics.values()) {
      const schemaSource = {
        path: relative(context.rootPath, topic.schemaFilePath),
      };
      nodes.push({
        layer: 'infrastructure',
        type: 'brokerTopic',
        locator: topic.id,
        name: topic.id,
        sources: [source, schemaSource],
        data: {
          resource: await blockResource(
            graph,
            module.block,
            {
              type: 'pubsub.googleapis.com/Topic',
              scope: module.project,
              id: ['projects/', projectPart, `/topics/${topic.id}`],
            },
            warnings,
          ),
        },
      });
      edges.push(
        ...terraformDeploys(module.block, nodeId('brokerTopic', topic.id)),
        {
          type: 'realizes',
          from: brokerTopicId(topic.id),
          to: topicId(topic.id),
          sources: [source],
        },
      );

      if (!rawEvents) {
        continue;
      }

      const tableName = rawEventsTableName(topic.id);
      const rawTableLocator = tableLocator(rawEvents.locator, tableName);
      nodes.push({
        layer: 'infrastructure',
        type: 'table',
        locator: rawTableLocator,
        parent: databaseId(rawEvents.locator),
        name: tableName,
        description: `Raw \`${topic.id}\` events.`,
        sources: [source, schemaSource],
        data: {
          resource: await blockResource(
            graph,
            module.block,
            {
              type: 'bigquery.googleapis.com/Table',
              scope: module.project,
              id: [
                'projects/',
                projectPart,
                '/datasets/',
                rawEvents.part,
                `/tables/${tableName}`,
              ],
            },
            warnings,
          ),
        },
      });
      edges.push(
        ...terraformDeploys(module.block, nodeId('table', rawTableLocator)),
      );

      const subscriptionLocator = rawEventsSubscriptionLocator(topic.id);
      const subscription = `bq-${topic.id}`;
      nodes.push({
        layer: 'infrastructure',
        type: 'brokerSubscription',
        locator: subscriptionLocator,
        name: subscription,
        sources: [source, ...rawEvents.sources],
        data: {
          resource: await blockResource(
            graph,
            module.block,
            {
              type: 'pubsub.googleapis.com/Subscription',
              scope: module.project,
              id: ['projects/', projectPart, `/subscriptions/${subscription}`],
            },
            warnings,
          ),
        },
      });
      edges.push(
        ...terraformDeploys(
          module.block,
          nodeId('brokerSubscription', subscriptionLocator),
        ),
        {
          type: 'delivers',
          from: brokerTopicId(topic.id),
          to: brokerSubscriptionId(subscriptionLocator),
          sources: [source],
        },
        {
          type: 'targets',
          from: brokerSubscriptionId(subscriptionLocator),
          to: tableId(rawEvents.locator, tableName),
          sources: [source],
        },
      );
    }

    return { nodes, edges, warnings };
  },
};

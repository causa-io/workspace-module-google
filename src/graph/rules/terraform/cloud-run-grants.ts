import {
  type GraphRuleEdge,
  type GraphRuleOutput,
  type GraphWarning,
  type ServiceContainerConfiguration,
} from '@causa/workspace-core';
import {
  brokerTopicId,
  databaseId,
  databaseLocator,
  ModelFact,
  tableId,
  type GraphContext,
} from '@causa/workspace-core/graph';
import type { GoogleConfiguration } from '../../../configurations/index.js';
import { CloudRunFact } from '../../cloud-run.js';
import {
  FIRESTORE_ENGINE,
  firestoreCollectionPath,
  firestoreDatabaseLocator,
  SPANNER_ENGINE,
} from '../../ids.js';

/**
 * The edges granted by the IAM bindings of the Cloud Run module blocks deploying a project.
 *
 * - A `publishes` edge from every service of the project to each broker topic of its `outputs.eventTopics`, when any
 *   block grants the publisher role.
 * - An `accesses` edge from every service of the project to each datastore of its outputs, when any block grants
 *   access. Spanner access is granted on each database. Firestore access is granted on
 *   the whole database, but is declared for the collections listed in the outputs: edges target the collections under
 *   each listed root.
 *
 * @param graph The context of the extraction.
 * @returns The edges granted by the blocks.
 */
export async function cloudRunGrants(
  graph: GraphContext,
): Promise<GraphRuleOutput> {
  const { locator, context } = graph;
  const [cloudRun, model] = await Promise.all([
    graph.get(CloudRunFact),
    graph.get(ModelFact),
  ]);
  const edges: GraphRuleEdge[] = [];
  const warnings: GraphWarning[] = [];

  const firestoreDatabase = context
    .asConfiguration<GoogleConfiguration>()
    .get('google.firestore.database');
  const firestorePaths = [...model.entities.values()].flatMap((e) => {
    const table = e.schema.definition.databases.find(
      (d) => d.engine === FIRESTORE_ENGINE,
    )?.table;
    const path = table ? firestoreCollectionPath(table) : undefined;
    return path ? [path] : [];
  });

  // What the project declares is granted to all its services as soon as one of its blocks grants it.
  for (const [project, services] of Map.groupBy(cloudRun, (s) => s.project)) {
    const configuration =
      project.context.asConfiguration<ServiceContainerConfiguration>();

    const publisherBlocks = services
      .filter((s) => s.setPubsubPermissions)
      .map((s) => s.block.declaration);
    if (publisherBlocks.length > 0) {
      const topics =
        configuration.get('serviceContainer.outputs.eventTopics') ?? [];
      for (const [index, topic] of topics.entries()) {
        const source = await locator.configurationSource(project.context, [
          'serviceContainer',
          'outputs',
          'eventTopics',
          index,
        ]);
        for (const service of services) {
          edges.push({
            type: 'publishes',
            from: service.id,
            to: brokerTopicId(topic),
            sources: [...publisherBlocks, source],
          });
        }
      }
    }

    const outputs = configuration.get('serviceContainer.outputs', {
      unsafe: true,
    });

    const spannerBlocks = services
      .filter((s) => s.setSpannerPermissions)
      .map((s) => s.block.declaration);
    if (spannerBlocks.length > 0) {
      const databases = (outputs?.[SPANNER_ENGINE] ?? []) as string[];
      for (const [index, database] of databases.entries()) {
        const source = await locator.configurationSource(project.context, [
          'serviceContainer',
          'outputs',
          SPANNER_ENGINE,
          index,
        ]);
        for (const service of services) {
          edges.push({
            type: 'accesses',
            from: service.id,
            to: databaseId(databaseLocator(SPANNER_ENGINE, database)),
            sources: [...spannerBlocks, source],
          });
        }
      }
    }

    const firestoreBlocks = services
      .filter((s) => s.setFirestorePermissions)
      .map((s) => s.block.declaration);
    if (firestoreBlocks.length === 0 || !firestoreDatabase) {
      continue;
    }

    const collections = (outputs?.[FIRESTORE_ENGINE] ?? []) as string[];
    for (const [index, collection] of collections.entries()) {
      const source = await locator.configurationSource(project.context, [
        'serviceContainer',
        'outputs',
        FIRESTORE_ENGINE,
        index,
      ]);
      const paths = new Set(
        firestorePaths.filter((p) => p.split('/')[0] === collection),
      );
      if (paths.size === 0) {
        warnings.push({
          message: `Project '${project.name}' is granted Firestore access for '${collection}' but no schema binds to that collection.`,
          sources: [source],
        });
      }

      for (const path of paths) {
        for (const service of services) {
          edges.push({
            type: 'accesses',
            from: service.id,
            to: tableId(firestoreDatabaseLocator(firestoreDatabase), path),
            sources: [...firestoreBlocks, source],
          });
        }
      }
    }
  }

  return { edges, warnings };
}

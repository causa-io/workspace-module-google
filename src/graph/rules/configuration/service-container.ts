import {
  GraphOriginKind,
  type GraphRule,
  type GraphRuleEdge,
  type GraphWarning,
  type ServiceContainerConfiguration,
} from '@causa/workspace-core';
import {
  DomainsFact,
  ModelFact,
  projectId,
  ProjectsFact,
  topicId,
  triggerId,
} from '@causa/workspace-core/graph';
import {
  FIRESTORE_ENGINE,
  firestoreCollectionPath,
  SPANNER_ENGINE,
} from '../../ids.js';
import { ddlSource, resolveSpannerTable, SpannerFact } from '../../spanner.js';

/**
 * The elements declared by the Google-specific parts of the `serviceContainer` configuration of every service container
 * project.
 *
 * - A `delivers` edge from a topic to each `google.pubSub` trigger consuming it. A trigger on a topic that no event
 *   schema defines has no topic node to come from: its edge only exists in the infrastructure layer.
 * - An `accesses` edge from a project to each entity whose table lives in a datastore the project owns.
 *   `outputs['google.spanner']` lists databases (`<instance>.<database>`), and `outputs['google.firestore']` lists root
 *   collections. A Spanner entity belongs to the database whose DDL creates its table. A Firestore entity belongs to
 *   the root collection of its path.
 */
export const googleServiceContainerFromConfiguration: GraphRule = {
  name: 'googleServiceContainerFromConfiguration',
  kind: GraphOriginKind.Declared,
  description:
    'One `delivers` edge from a topic to each trigger of type `google.pubSub` naming it, when an event schema defines the topic. One `accesses` edge from a project to each entity persisted in a Spanner database or a Firestore collection listed in its `serviceContainer.outputs`.',
  async run(graph) {
    const { locator } = graph;
    const [domains, projects, model, spanner] = await Promise.all([
      graph.get(DomainsFact),
      graph.get(ProjectsFact),
      graph.get(ModelFact),
      graph.get(SpannerFact),
    ]);
    const edges: GraphRuleEdge[] = [];
    const warnings: GraphWarning[] = [];

    const entities = [...model.entities.values()];
    const spannerEntities = entities.flatMap((entity) => {
      const resolution = resolveSpannerTable(spanner, entity, domains);
      return resolution?.kind === 'resolved' ? [{ entity, resolution }] : [];
    });

    for (const project of projects.filter(
      (p) => p.type === 'serviceContainer',
    )) {
      const configuration =
        project.context.asConfiguration<ServiceContainerConfiguration>();

      const triggers =
        configuration.get('serviceContainer.triggers', { unsafe: true }) ?? {};
      for (const [name, trigger] of Object.entries(triggers)) {
        if (
          trigger.type !== 'google.pubSub' ||
          typeof trigger.topic !== 'string' ||
          !model.topics.has(trigger.topic)
        ) {
          continue;
        }

        edges.push({
          type: 'delivers',
          from: topicId(trigger.topic),
          to: triggerId(project.directory, name),
          sources: [
            await locator.configurationSource(project.context, [
              'serviceContainer',
              'triggers',
              name,
              'topic',
            ]),
          ],
        });
      }

      const outputs = configuration.get('serviceContainer.outputs', {
        unsafe: true,
      });
      const databases = (outputs?.[SPANNER_ENGINE] ?? []) as string[];
      for (const [index, database] of databases.entries()) {
        const source = await locator.configurationSource(project.context, [
          'serviceContainer',
          'outputs',
          SPANNER_ENGINE,
          index,
        ]);
        const owned = spannerEntities.filter(
          ({ resolution }) => resolution.database.name === database,
        );
        if (owned.length === 0) {
          warnings.push({
            message: `Project '${project.name}' owns Spanner database '${database}' but no entity resolves to it.`,
            sources: [source],
          });
        }

        for (const { entity, resolution } of owned) {
          edges.push({
            type: 'accesses',
            from: projectId(project.directory),
            to: entity.id,
            sources: [source, ddlSource(resolution.table)],
          });
        }
      }

      const collections = (outputs?.[FIRESTORE_ENGINE] ?? []) as string[];
      for (const [index, collection] of collections.entries()) {
        const source = await locator.configurationSource(project.context, [
          'serviceContainer',
          'outputs',
          FIRESTORE_ENGINE,
          index,
        ]);
        const owned = entities.filter((entity) => {
          const table = entity.schema.definition.databases.find(
            (d) => d.engine === FIRESTORE_ENGINE,
          )?.table;
          return (
            !!table &&
            firestoreCollectionPath(table)?.split('/')[0] === collection
          );
        });
        if (owned.length === 0) {
          warnings.push({
            message: `Project '${project.name}' owns Firestore collection '${collection}' but no schema binds to it.`,
            sources: [source],
          });
        }

        for (const entity of owned) {
          edges.push({
            type: 'accesses',
            from: projectId(project.directory),
            to: entity.id,
            sources: [
              source,
              await locator.source(entity.schema.file, [
                ...entity.schema.segments,
                'causa',
                'googleFirestoreCollection',
              ]),
            ],
          });
        }
      }
    }

    return { edges, warnings };
  },
};

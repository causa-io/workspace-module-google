import {
  GraphOriginKind,
  type DatabaseGraphNodeData,
  type GraphWarning,
  type GraphRule,
  type GraphRuleEdge,
  type GraphRuleNode,
} from '@causa/workspace-core';
import {
  tableId,
  tableLocator,
  databaseId,
  ModelFact,
  graphTemplate,
} from '@causa/workspace-core/graph';
import {
  FIRESTORE_ENGINE,
  firestoreCollectionPath,
  firestoreDatabaseLocator,
} from '../../ids.js';
import type { GoogleConfiguration } from '../../../configurations/index.js';

/**
 * The Firestore database of the workspace, `google.firestore.database`, and the collections schemas bind to:
 *
 * - A `database` node for the database.
 * - A `table` node per Firestore collection a schema binds to (`causa.googleFirestoreCollection`). The locator is the
 *   collection path, with `{}` in place of document IDs (e.g. `users/{}/bookmarks`), under the single Firestore database
 *   of the workspace. A binding that does not name its root collection is reported.
 * - A `realizes` edge from each collection to the entity whose binding declares it.
 */
export const firestoreFromConfiguration: GraphRule = {
  name: 'firestoreFromConfiguration',
  kind: GraphOriginKind.Declared,
  description:
    'One `database` node from `google.firestore.database`, located by the database name. One `table` node per schema with a Firestore binding, located by its collection path under that database, and one `realizes` edge from the table to the entity.',
  async run(graph) {
    const { locator, context } = graph;
    const model = await graph.get(ModelFact);
    const nodes: GraphRuleNode[] = [];
    const edges: GraphRuleEdge[] = [];
    const warnings: GraphWarning[] = [];

    const database = context
      .asConfiguration<GoogleConfiguration>()
      .get('google.firestore.database');
    if (typeof database === 'string') {
      const data: DatabaseGraphNodeData = {
        engine: FIRESTORE_ENGINE,
        resource: {
          type: 'firestore.googleapis.com/Database',
          id: graphTemplate(
            'projects/',
            { configuration: 'google.project' },
            '/databases/',
            { configuration: 'google.firestore.database' },
          ),
        },
      };
      nodes.push({
        layer: 'infrastructure',
        type: 'database',
        locator: firestoreDatabaseLocator(database),
        name: database,
        sources: [
          await locator.configurationSource(context, [
            'google',
            'firestore',
            'database',
          ]),
        ],
        data,
      });
    }

    for (const entity of model.entities.values()) {
      const { schema } = entity;
      const table = schema.definition.databases.find(
        (d) => d.engine === FIRESTORE_ENGINE,
      )?.table;
      if (!table) {
        continue;
      }

      const source = await locator.source(schema.file, [
        ...schema.segments,
        'causa',
        'googleFirestoreCollection',
      ]);
      if (typeof database !== 'string') {
        warnings.push({
          message: `Schema '${schema.definition.name}' binds to Firestore but 'google.firestore.database' is not set.`,
          sources: [source],
        });
        continue;
      }

      const collection = firestoreCollectionPath(table);
      if (!collection) {
        warnings.push({
          message: `Schema '${schema.definition.name}' binds to Firestore documents '${table}', whose root collection is not named.`,
          sources: [source],
        });
        continue;
      }

      const databaseLocator = firestoreDatabaseLocator(database);
      nodes.push({
        layer: 'infrastructure',
        type: 'table',
        locator: tableLocator(databaseLocator, collection),
        parent: databaseId(databaseLocator),
        name: collection,
        sources: [source],
      });
      edges.push({
        type: 'realizes',
        from: tableId(databaseLocator, collection),
        to: entity.id,
        sources: [source],
      });
    }

    return { nodes, edges, warnings };
  },
};

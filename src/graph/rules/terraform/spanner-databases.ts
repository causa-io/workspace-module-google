import {
  GraphOriginKind,
  type DatabaseGraphNodeData,
  type GraphWarning,
  type GraphRule,
  type GraphRuleEdge,
  type GraphRuleNode,
} from '@causa/workspace-core';
import {
  databaseId,
  tableId,
  tableLocator,
  DomainsFact,
  ModelFact,
  nodeId,
} from '@causa/workspace-core/graph';
import { terraformDeploys } from '@causa/workspace-terraform';
import { SPANNER_ENGINE, spannerInstanceId } from '../../ids.js';
import { ddlSource, resolveSpannerTable, SpannerFact } from '../../spanner.js';
import {
  blockResource,
  infrastructureModules,
  argumentOrConfiguration,
  type InfrastructureModule,
} from '../../terraform-modules.js';

/**
 * The source of the Causa Terraform module creating the Spanner instance and databases.
 */
export const SPANNER_DATABASES_MODULE_SOURCE =
  'causa-io/spanner-databases/google';

/**
 * Returns the GCP project and instance parts of the resource names created by a Spanner databases module block.
 */
function nameParts(module: InfrastructureModule, warnings: GraphWarning[]) {
  return {
    project: argumentOrConfiguration(
      module.block,
      'gcp_project_id',
      'google.project',
      warnings,
    ),
    instance: argumentOrConfiguration(
      module.block,
      'instance_name',
      'google.spanner.instance.name',
      warnings,
    ),
  };
}

/**
 * The resources created by the blocks of the Spanner databases module:
 *
 * - A `google.spanner.instance` node per block, which creates the instance from `google.spanner.instance.name`.
 * - A `database` node per Spanner database, as `GoogleSpannerListDatabases` lists them. The locator is
 *   `google.spanner/<instance>.<database>`, and the parent is the instance.
 * - A `table` node per `CREATE TABLE` statement in the DDL files of each database. Tables no schema declares (e.g. an
 *   outbox) are still nodes, realizing nothing.
 * - A `realizes` edge from a table to the entity whose binding names it. The table is the one created by the DDL of a
 *   database, disambiguated by domain when several databases create a table with the same name.
 */
export const spannerDatabasesModule: GraphRule = {
  name: 'spannerDatabasesModule',
  kind: GraphOriginKind.Declared,
  description:
    'One `google.spanner.instance` node per Spanner databases module block, named by `google.spanner.instance.name`. One `database` node per Spanner database listed by `GoogleSpannerListDatabases` from the DDL files, and one `table` node per `CREATE TABLE` in them, realizing the entity whose `googleSpannerTable` binding names it, disambiguated by domain. Each resource is linked by a `deploys` edge from the projects applying the block.',
  async run(graph) {
    const { locator, context } = graph;
    const [domains, model, spanner, spannerDatabases] = await Promise.all([
      graph.get(DomainsFact),
      graph.get(ModelFact),
      graph.get(SpannerFact),
      infrastructureModules(graph, SPANNER_DATABASES_MODULE_SOURCE),
    ]);
    const nodes: GraphRuleNode[] = [];
    const edges: GraphRuleEdge[] = [];
    const warnings: GraphWarning[] = [];

    for (const module of spannerDatabases) {
      const source = module.block.declaration;
      if (!spanner.instance) {
        warnings.push({
          message:
            "A Spanner databases module block exists, but 'google.spanner.instance.name' is not set.",
          sources: [source],
        });
        continue;
      }

      const { project, instance } = nameParts(module, warnings);

      if (module.block.arguments['instance_name'] !== undefined) {
        warnings.push({
          message: `The module overrides the instance name. Locators use the configured '${spanner.instance}'.`,
          sources: [source],
        });
      }

      nodes.push({
        layer: 'infrastructure',
        type: 'google.spanner.instance',
        locator: spanner.instance,
        name: spanner.instance,
        sources: [
          await locator.configurationSource(module.context, [
            'google',
            'spanner',
            'instance',
            'name',
          ]),
          source,
        ],
        data: {
          resource: await blockResource(
            graph,
            module.block,
            {
              type: 'spanner.googleapis.com/Instance',
              scope: module.project,
              id: ['projects/', project, '/instances/', instance],
            },
            warnings,
          ),
        },
      });
      edges.push(
        ...terraformDeploys(
          module.block,
          nodeId('google.spanner.instance', spanner.instance),
        ),
      );

      for (const database of spanner.databases) {
        const data: DatabaseGraphNodeData = {
          engine: SPANNER_ENGINE,
          resource: await blockResource(
            graph,
            module.block,
            {
              type: 'spanner.googleapis.com/Database',
              scope: module.project,
              id: [
                'projects/',
                project,
                '/instances/',
                instance,
                `/databases/${database.id}`,
              ],
            },
            warnings,
          ),
        };
        nodes.push({
          layer: 'infrastructure',
          type: 'database',
          locator: database.locator,
          parent: spannerInstanceId(spanner.instance),
          name: database.id,
          sources: [
            { path: database.directory },
            await locator.configurationSource(context, [
              'google',
              'spanner',
              'ddls',
            ]),
            source,
          ],
          data,
        });
        edges.push(
          ...terraformDeploys(
            module.block,
            nodeId('database', database.locator),
          ),
        );
      }
    }

    if (spanner.databases.length > 0 && spannerDatabases.length === 0) {
      warnings.push({
        message:
          'Spanner DDL files exist but no Spanner databases module block creates the databases.',
      });
    }

    if (!spanner.instance || spannerDatabases.length === 0) {
      return { nodes, edges, warnings };
    }

    const blocks = spannerDatabases.map((m) => m.block.declaration);
    for (const database of spanner.databases) {
      for (const table of database.tables) {
        const nodeLocator = tableLocator(database.locator, table.name);
        nodes.push({
          layer: 'infrastructure',
          type: 'table',
          locator: nodeLocator,
          parent: databaseId(database.locator),
          name: table.name,
          sources: [ddlSource(table), ...blocks],
        });
        edges.push(
          ...spannerDatabases.flatMap((module) =>
            terraformDeploys(module.block, nodeId('table', nodeLocator)),
          ),
        );
      }
    }

    for (const entity of model.entities.values()) {
      const resolution = resolveSpannerTable(spanner, entity, domains);
      if (!resolution) {
        continue;
      }

      const { file, segments, definition } = entity.schema;
      const binding = await locator.source(file, [
        ...segments,
        'causa',
        'googleSpannerTable',
      ]);
      const table = definition.databases.find(
        (d) => d.engine === SPANNER_ENGINE,
      )?.table;
      if (resolution.kind === 'missing') {
        warnings.push({
          message: `Entity '${definition.name}' binds to Spanner table '${table}', which no DDL creates.`,
          sources: [binding],
        });
        continue;
      }

      if (resolution.kind === 'ambiguous') {
        warnings.push({
          message: `Entity '${definition.name}' binds to Spanner table '${table}', which is created in several databases: ${resolution.candidates
            .map((c) => `'${c.id}'`)
            .join(', ')}.`,
          sources: [binding],
        });
        continue;
      }

      edges.push({
        type: 'realizes',
        from: tableId(resolution.database.locator, resolution.table.name),
        to: entity.id,
        sources: [binding, ddlSource(resolution.table)],
      });
    }

    return { nodes, edges, warnings };
  },
};

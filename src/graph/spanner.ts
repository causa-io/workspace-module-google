import type { GraphOriginSource } from '@causa/workspace-core';
import {
  GraphExtractionFact,
  type EntityFacts,
  type GraphContext,
  type GraphFactOutput,
  type GraphWarning,
  type WorkspaceDomain,
} from '@causa/workspace-core/graph';
import { splitSchemaPath } from '@causa/workspace-core/jsonschema';
import { dirname, relative } from 'path';
import type { GoogleConfiguration } from '../configurations/index.js';
import {
  GoogleSpannerListDatabases,
  resolveSpannerTable,
  type SpannerDatabase,
  type SpannerTable,
  type SpannerTableResolution,
} from '../functions/google-spanner/index.js';
import {
  SPANNER_ENGINE,
  spannerDatabaseLocator,
  spannerDatabaseName,
} from './ids.js';

/**
 * A Spanner database of the workspace, as `GoogleSpannerListDatabases` lists it, and its graph identifiers.
 */
export type SpannerDatabaseFacts = SpannerDatabase & {
  /**
   * The name of the database within its engine, `<instance>.<database>`, as `outputs['google.spanner']` lists it.
   */
  readonly name: string;

  /**
   * The locator of the `database` node.
   */
  readonly locator: string;

  /**
   * The directory holding the DDL files, relative to the workspace root.
   */
  readonly directory: string;
};

/**
 * The Spanner databases of the workspace.
 */
export type SpannerFacts = {
  /**
   * The Spanner instance, from `google.spanner.instance.name`.
   */
  readonly instance: string | undefined;

  /**
   * The databases, as `GoogleSpannerListDatabases` lists them.
   */
  readonly databases: SpannerDatabaseFacts[];
};

/**
 * The Spanner databases of the workspace, as `GoogleSpannerListDatabases` lists them.
 */
export class SpannerFact extends GraphExtractionFact<SpannerFacts> {
  async compute(graph: GraphContext): Promise<GraphFactOutput<SpannerFacts>> {
    const { context } = graph;
    const instance = context
      .asConfiguration<GoogleConfiguration>()
      .get('google.spanner.instance.name');

    const listed = await context.call(GoogleSpannerListDatabases, {});
    const databases = listed.map((database): SpannerDatabaseFacts => {
      const [file] = database.ddlFiles;
      return {
        ...database,
        name: spannerDatabaseName(instance ?? '', database.id),
        locator: spannerDatabaseLocator(instance ?? '', database.id),
        directory: file ? dirname(relative(context.rootPath, file)) : '',
      };
    });
    databases.sort((a, b) => a.id.localeCompare(b.id));

    const warnings: GraphWarning[] = [];
    for (const database of databases) {
      const names = new Set<string>();
      for (const table of database.tables) {
        if (names.has(table.name)) {
          warnings.push({
            message: `Table '${table.name}' is created twice in database '${database.id}'.`,
            sources: [ddlSource(context.rootPath, table)],
          });
        }
        names.add(table.name);
      }
    }

    return { value: { instance, databases }, warnings };
  }
}

/**
 * Resolves the Spanner binding of an entity to the database whose DDL creates a table of that name, using
 * {@link resolveSpannerTable}.
 *
 * @param spanner The Spanner databases.
 * @param entity The entity.
 * @param domains The domains of the workspace, in which the domain of the entity is looked up.
 * @returns The resolution, or `undefined` if the entity is not persisted in Spanner.
 */
export function resolveEntitySpannerTable(
  spanner: SpannerFacts,
  entity: EntityFacts,
  domains: readonly WorkspaceDomain[],
): SpannerTableResolution<SpannerDatabaseFacts> | undefined {
  const { definition, path } = entity.schema;
  const table = definition.databases.find(
    (d) => d.engine === SPANNER_ENGINE,
  )?.table;
  if (!table) {
    return undefined;
  }

  return resolveSpannerTable(
    spanner.databases,
    table,
    splitSchemaPath(path).file,
    // The working directory of a domain's context is the absolute path of the domain.
    domains.map((d) => d.context.workingDirectory),
  );
}

/**
 * Returns the origin source of a `CREATE TABLE` statement.
 *
 * @param rootPath The absolute path of the workspace root.
 * @param table The table.
 * @returns The origin source.
 */
export function ddlSource(
  rootPath: string,
  table: SpannerTable,
): GraphOriginSource {
  return {
    path: relative(rootPath, table.file),
    pointer: `CREATE TABLE ${table.name}`,
    location: { start: { line: table.line } },
  };
}

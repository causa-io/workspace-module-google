import type { WorkspaceContext } from '@causa/workspace';
import type { GraphOriginSource } from '@causa/workspace-core';
import {
  domainAt,
  domainOfFile,
  DomainsFact,
  GraphFact,
  type EntityFacts,
  type GraphContext,
  type GraphFactOutput,
  type GraphWarning,
  type WorkspaceDomain,
} from '@causa/workspace-core/graph';
import { readFile } from 'fs/promises';
import { dirname, join, relative } from 'path';
import type { GoogleConfiguration } from '../configurations/index.js';
import { GoogleSpannerListDatabases } from '../functions/google-spanner/index.js';
import {
  SPANNER_ENGINE,
  spannerDatabaseLocator,
  spannerDatabaseName,
} from './ids.js';

/**
 * A table created by a `CREATE TABLE` statement in a Spanner DDL file.
 */
export type SpannerTable = {
  /**
   * The name of the table.
   */
  readonly name: string;

  /**
   * The DDL file declaring the table, relative to the workspace root.
   */
  readonly file: string;

  /**
   * The line of the statement in the file.
   */
  readonly line: number;
};

/**
 * A Spanner database of the workspace, and the tables its DDL files create.
 */
export type SpannerDatabaseFacts = {
  /**
   * The ID of the database, as `GoogleSpannerListDatabases` returns it.
   */
  readonly id: string;

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

  /**
   * The domain the DDL files belong to.
   */
  readonly domain: WorkspaceDomain | undefined;

  /**
   * The tables created by the DDL files.
   */
  readonly tables: SpannerTable[];
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
 * The Spanner databases of the workspace, as `GoogleSpannerListDatabases` lists them, and the tables their DDL files
 * create.
 */
export class SpannerFact extends GraphFact<SpannerFacts> {
  async compute(graph: GraphContext): Promise<GraphFactOutput<SpannerFacts>> {
    const { context } = graph;
    const instance = context
      .asConfiguration<GoogleConfiguration>()
      .get('google.spanner.instance.name');

    const [listed, domains] = await Promise.all([
      context.call(GoogleSpannerListDatabases, {}),
      graph.get(DomainsFact),
    ]);
    const databases = await Promise.all(
      listed.map(async ({ id, ddlFiles }): Promise<SpannerDatabaseFacts> => {
        const files = ddlFiles.map((f) => relative(context.rootPath, f)).sort();
        const tables = await this.parseTables(context, files);
        const directory = files[0] ? dirname(files[0]) : '';
        return {
          id,
          name: spannerDatabaseName(instance ?? '', id),
          locator: spannerDatabaseLocator(instance ?? '', id),
          directory,
          domain: directory ? domainAt(domains, directory) : undefined,
          tables,
        };
      }),
    );
    databases.sort((a, b) => a.id.localeCompare(b.id));

    const warnings: GraphWarning[] = [];
    for (const database of databases) {
      const names = new Set<string>();
      for (const table of database.tables) {
        if (names.has(table.name)) {
          warnings.push({
            message: `Table '${table.name}' is created twice in database '${database.id}'.`,
            sources: [ddlSource(table)],
          });
        }
        names.add(table.name);
      }
    }

    return { value: { instance, databases }, warnings };
  }

  /**
   * Parses the tables created by the `CREATE TABLE` statements of DDL files.
   *
   * @param context The workspace context.
   * @param files The DDL files, relative to the workspace root.
   * @returns The tables, in the order of the files and statements.
   */
  private async parseTables(
    context: WorkspaceContext,
    files: readonly string[],
  ): Promise<SpannerTable[]> {
    const tables: SpannerTable[] = [];
    for (const file of files) {
      const content = await readFile(join(context.rootPath, file), 'utf-8');
      const withoutComments = content.replace(/--.*$/gm, (m) =>
        ' '.repeat(m.length),
      );
      const statements = withoutComments.matchAll(
        /\bCREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?[`"']?([A-Za-z_]\w*)[`"']?/gi,
      );
      for (const match of statements) {
        tables.push({
          name: match[1],
          file,
          line: withoutComments.slice(0, match.index).split('\n').length,
        });
      }
    }

    return tables;
  }
}

/**
 * The resolution of an entity's Spanner binding to a table.
 */
export type SpannerTableResolution =
  | {
      readonly kind: 'resolved';
      readonly database: SpannerDatabaseFacts;
      readonly table: SpannerTable;
    }
  | { readonly kind: 'ambiguous'; readonly candidates: SpannerDatabaseFacts[] }
  | { readonly kind: 'missing' };

/**
 * Resolves the Spanner binding of an entity to the database whose DDL creates a table of that name. When several
 * databases declare the name, the one in the entity's domain is chosen.
 *
 * @param spanner The Spanner databases.
 * @param entity The entity.
 * @param domains The domains of the workspace, in which the domain of the entity is looked up.
 * @returns The resolution, or `undefined` if the entity is not persisted in Spanner.
 */
export function resolveSpannerTable(
  spanner: SpannerFacts,
  entity: EntityFacts,
  domains: readonly WorkspaceDomain[],
): SpannerTableResolution | undefined {
  const { definition, file } = entity.schema;
  const table = definition.databases.find(
    (d) => d.engine === SPANNER_ENGINE,
  )?.table;
  if (!table) {
    return undefined;
  }

  const candidates = spanner.databases.filter((d) =>
    d.tables.some((t) => t.name === table),
  );
  const pick = (database: SpannerDatabaseFacts): SpannerTableResolution => ({
    kind: 'resolved',
    database,
    table: database.tables.find((t) => t.name === table)!,
  });
  if (candidates.length === 1) {
    return pick(candidates[0]);
  }

  if (candidates.length === 0) {
    return { kind: 'missing' };
  }

  const domain = domainOfFile(domains, file);
  const sameDomain = candidates.filter(
    (d) => domain && d.domain?.directory === domain.directory,
  );
  return sameDomain.length === 1
    ? pick(sameDomain[0])
    : { kind: 'ambiguous', candidates };
}

/**
 * Returns the origin source of a `CREATE TABLE` statement.
 *
 * @param table The table.
 * @returns The origin source.
 */
export function ddlSource(table: SpannerTable): GraphOriginSource {
  return {
    path: table.file,
    pointer: `CREATE TABLE ${table.name}`,
    location: { start: { line: table.line } },
  };
}

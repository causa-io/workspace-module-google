import { sep } from 'path';
import type { SpannerDatabase, SpannerTable } from './list-databases.js';

/**
 * The resolution of a table name to the database whose DDL creates it.
 */
export type SpannerTableResolution<
  D extends SpannerDatabase = SpannerDatabase,
> =
  | {
      readonly kind: 'resolved';
      readonly database: D;
      readonly table: SpannerTable;
    }
  | { readonly kind: 'ambiguous'; readonly candidates: D[] }
  | { readonly kind: 'missing' };

/**
 * Returns the deepest domain containing a path.
 *
 * @param domainPaths The absolute paths of the domains.
 * @param path The absolute path.
 * @returns The absolute path of the domain, or `undefined` if the path is not part of a domain.
 */
function domainOf(
  domainPaths: readonly string[],
  path: string,
): string | undefined {
  return domainPaths
    .filter((domain) => path.startsWith(`${domain}${sep}`))
    .sort((a, b) => b.length - a.length)[0];
}

/**
 * Resolves a table name to the database whose DDL creates it. When several databases create a table with that name, the
 * one with DDL files in the domain of the schema is chosen.
 *
 * @param databases The Spanner databases, as listed by `GoogleSpannerListDatabases`.
 * @param table The name of the table.
 * @param schemaFile The absolute path of the file declaring the schema persisted in the table.
 * @param domainPaths The absolute paths of the domains of the workspace.
 * @returns The resolution.
 */
export function resolveSpannerTable<D extends SpannerDatabase>(
  databases: readonly D[],
  table: string,
  schemaFile: string,
  domainPaths: readonly string[],
): SpannerTableResolution<D> {
  const candidates = databases.filter((d) =>
    d.tables.some((t) => t.name === table),
  );
  const pick = (database: D): SpannerTableResolution<D> => ({
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

  const domain = domainOf(domainPaths, schemaFile);
  const inDomain = domain
    ? candidates.filter(({ ddlFiles }) =>
        ddlFiles.some((f) => domainOf(domainPaths, f) === domain),
      )
    : [];
  return inDomain.length === 1
    ? pick(inDomain[0])
    : { kind: 'ambiguous', candidates };
}

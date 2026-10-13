import type { SpannerDatabase } from './list-databases.js';
import { resolveSpannerTable } from './resolve-table.js';

const database = (
  id: string,
  directory: string,
  tables: string[],
): SpannerDatabase => {
  const file = `/workspace/${directory}/0001.sql`;
  return {
    id,
    ddlFiles: [file],
    ddls: [],
    tables: tables.map((name, index) => ({ name, file, line: index + 1 })),
  };
};

const DOMAIN_PATHS = [
  '/workspace/domains/analytics',
  '/workspace/domains/content',
  '/workspace/domains/content/archive',
];

describe('resolveSpannerTable', () => {
  let databases: SpannerDatabase[];

  beforeEach(() => {
    databases = [
      database('content', 'domains/content/spanner', ['Post', 'Asset']),
      database('analytics', 'domains/analytics/spanner', ['Event']),
    ];
  });

  it('should resolve the only database creating the table', () => {
    const actualResolution = resolveSpannerTable(
      databases,
      'Asset',
      '/workspace/domains/other/asset.yaml',
      DOMAIN_PATHS,
    );

    expect(actualResolution).toEqual({
      kind: 'resolved',
      database: databases[0],
      table: databases[0].tables[1],
    });
  });

  it('should return missing when no database creates the table', () => {
    const actualResolution = resolveSpannerTable(
      databases,
      'Unknown',
      '/workspace/domains/content/entities/unknown.yaml',
      DOMAIN_PATHS,
    );

    expect(actualResolution).toEqual({ kind: 'missing' });
  });

  it('should choose the database in the domain of the schema when several create the table', () => {
    databases.push(
      database('archive', 'domains/content/archive/spanner', ['Post']),
    );

    const actualContent = resolveSpannerTable(
      databases,
      'Post',
      '/workspace/domains/content/entities/post.yaml',
      DOMAIN_PATHS,
    );
    const actualArchive = resolveSpannerTable(
      databases,
      'Post',
      '/workspace/domains/content/archive/entities/post.yaml',
      DOMAIN_PATHS,
    );

    expect(actualContent).toEqual({
      kind: 'resolved',
      database: databases[0],
      table: databases[0].tables[0],
    });
    expect(actualArchive).toEqual({
      kind: 'resolved',
      database: databases[2],
      table: databases[2].tables[0],
    });
  });

  it('should return ambiguous when several databases outside the domain of the schema create the table', () => {
    databases[1].tables.push({ name: 'Post', file: 'other.sql', line: 1 });

    const actualResolution = resolveSpannerTable(
      databases,
      'Post',
      '/workspace/domains/other/post.yaml',
      DOMAIN_PATHS,
    );

    expect(actualResolution).toEqual({
      kind: 'ambiguous',
      candidates: [databases[0], databases[1]],
    });
  });

  it('should return ambiguous when several databases in the domain of the schema create the table', () => {
    databases.push(
      database('content-copy', 'domains/content/copy/spanner', ['Post']),
    );

    const actualResolution = resolveSpannerTable(
      databases,
      'Post',
      '/workspace/domains/content/entities/post.yaml',
      DOMAIN_PATHS,
    );

    expect(actualResolution).toEqual({
      kind: 'ambiguous',
      candidates: [databases[0], databases[2]],
    });
  });
});

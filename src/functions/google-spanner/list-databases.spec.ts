import { WorkspaceContext } from '@causa/workspace';
import { createContext } from '@causa/workspace/testing';
import { mkdir, mkdtemp, rm, writeFile } from 'fs/promises';
import { join, resolve } from 'path';
import { GoogleSpannerListDatabases } from './list-databases.js';

describe('GoogleSpannerListDatabases', () => {
  let context: WorkspaceContext;
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = resolve(await mkdtemp('causa-test-'));
    ({ context } = createContext({
      rootPath: tmpDir,
      functions: [GoogleSpannerListDatabases],
    }));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true });
  });

  it('should return an empty list of databases', async () => {
    const actualList = await context.call(GoogleSpannerListDatabases, {});

    expect(actualList).toEqual([]);
  });

  it('should return a list of databases', async () => {
    const db1Path = join(tmpDir, 'domains/db1/spanner');
    const db2Path = join(tmpDir, 'domains/db2/spanner');
    await mkdir(db1Path, { recursive: true });
    await mkdir(db2Path, { recursive: true });
    await writeFile(
      join(db1Path, '1.sql'),
      'CREATE TABLE a; -- comment to discard\nALTER TABLE a1',
    );
    await writeFile(join(db1Path, '2.sql'), 'ALTER TABLE a2');
    await writeFile(
      join(db2Path, '1.sql'),
      'CREATE TABLE b(\nx,\ny,\nz,\n);\nALTER TABLE\nb1',
    );
    await writeFile(join(db2Path, '2.to-ignore'), '🙅');
    await writeFile(join(tmpDir, 'domains/db2/other.sql'), '🕵️');

    const actualList = await context.call(GoogleSpannerListDatabases, {});

    expect(actualList).toHaveLength(2);
    expect(actualList).toContainEqual({
      id: 'db1',
      ddlFiles: [join(db1Path, '1.sql'), join(db1Path, '2.sql')],
      ddls: ['CREATE TABLE a', 'ALTER TABLE a1', 'ALTER TABLE a2'],
      tables: [{ name: 'a', file: join(db1Path, '1.sql'), line: 1 }],
    });
    expect(actualList).toContainEqual({
      id: 'db2',
      ddlFiles: [join(db2Path, '1.sql')],
      ddls: ['CREATE TABLE b( x, y, z, )', 'ALTER TABLE b1'],
      tables: [{ name: 'b', file: join(db2Path, '1.sql'), line: 1 }],
    });
  });

  it('should return the tables created by the DDL statements and their lines', async () => {
    const dbPath = join(tmpDir, 'domains/db/spanner');
    await mkdir(dbPath, { recursive: true });
    await writeFile(
      join(dbPath, '1.sql'),
      `-- The first table.
CREATE TABLE First (
  id STRING(36), -- The ID; with a semicolon.
) PRIMARY KEY (id);

CREATE TABLE IF NOT EXISTS \`Second\` (id STRING(36)) PRIMARY KEY (id);
CREATE INDEX FirstById ON First(id);
  create table third (id STRING(36)) PRIMARY KEY (id);
`,
    );
    await writeFile(
      join(dbPath, '2.sql'),
      'ALTER TABLE First ADD COLUMN x STRING(MAX);\nCREATE TABLE Fourth (id STRING(36)) PRIMARY KEY (id)',
    );

    const actualList = await context.call(GoogleSpannerListDatabases, {});

    expect(actualList).toEqual([
      expect.objectContaining({
        id: 'db',
        tables: [
          { name: 'First', file: join(dbPath, '1.sql'), line: 2 },
          { name: 'Second', file: join(dbPath, '1.sql'), line: 6 },
          { name: 'third', file: join(dbPath, '1.sql'), line: 8 },
          { name: 'Fourth', file: join(dbPath, '2.sql'), line: 2 },
        ],
      }),
    ]);
  });

  it('should allow custom DDL file patterns', async () => {
    ({ context } = createContext({
      rootPath: tmpDir,
      configuration: {
        workspace: { name: '🏷️' },
        google: {
          spanner: {
            ddls: {
              globs: ['*.sql'],
              format: 'prefix-${ database }',
              regularExpression: 'ddl-(?<database>[\\w-]+)\\.sql',
            },
          },
        },
      },
      functions: [GoogleSpannerListDatabases],
    }));
    await writeFile(join(tmpDir, 'ddl-db1.sql'), 'CREATE TABLE a');
    await writeFile(join(tmpDir, 'ddl-db2.sql'), 'CREATE TABLE b');

    const actualList = await context.call(GoogleSpannerListDatabases, {});

    expect(actualList).toHaveLength(2);
    expect(actualList).toContainEqual({
      id: 'prefix-db1',
      ddlFiles: [join(tmpDir, 'ddl-db1.sql')],
      ddls: ['CREATE TABLE a'],
      tables: [{ name: 'a', file: join(tmpDir, 'ddl-db1.sql'), line: 1 }],
    });
    expect(actualList).toContainEqual({
      id: 'prefix-db2',
      ddlFiles: [join(tmpDir, 'ddl-db2.sql')],
      ddls: ['CREATE TABLE b'],
      tables: [{ name: 'b', file: join(tmpDir, 'ddl-db2.sql'), line: 1 }],
    });
  });
});

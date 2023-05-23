import { WorkspaceContext } from '@causa/workspace';
import { createContext } from '@causa/workspace/testing';
import { mkdir, mkdtemp, rm, writeFile } from 'fs/promises';
import { join, resolve } from 'path';
import { GoogleSpannerListDatabases } from './google-spanner-list-databases.js';

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
    });
    expect(actualList).toContainEqual({
      id: 'db2',
      ddlFiles: [join(db2Path, '1.sql')],
      ddls: ['CREATE TABLE b( x, y, z, )', 'ALTER TABLE b1'],
    });
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
    });
    expect(actualList).toContainEqual({
      id: 'prefix-db2',
      ddlFiles: [join(tmpDir, 'ddl-db2.sql')],
      ddls: ['CREATE TABLE b'],
    });
  });
});

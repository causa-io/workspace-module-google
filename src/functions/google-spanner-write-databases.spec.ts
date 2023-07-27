import { WorkspaceContext } from '@causa/workspace';
import { createContext } from '@causa/workspace/testing';
import { existsSync } from 'fs';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'fs/promises';
import 'jest-extended';
import { join, resolve } from 'path';
import { GoogleSpannerListDatabases } from './google-spanner-list-databases.js';
import { GoogleSpannerWriteDatabases } from './google-spanner-write-databases.js';

describe('GoogleSpannerWriteDatabases', () => {
  const expectedDirectory = join('.causa', 'spanner-databases');
  let context: WorkspaceContext;

  beforeEach(async () => {
    const rootPath = resolve(await mkdtemp('causa-test-'));
    ({ context } = createContext({
      rootPath,
      configuration: {
        workspace: { name: '🏷️' },
        google: {
          spanner: {
            ddls: {
              globs: ['*.sql'],
              format: '${ database }',
              regularExpression: '(?<database>[\\w-]+)-.+\\.sql',
            },
          },
        },
      },
      functions: [GoogleSpannerWriteDatabases, GoogleSpannerListDatabases],
    }));
  });

  afterEach(async () => {
    await rm(context.rootPath, { recursive: true, force: true });
  });

  it('should not write any database file', async () => {
    const actualResult = await context.call(GoogleSpannerWriteDatabases, {});

    expect(actualResult).toEqual({
      configuration: {
        google: {
          spanner: { databaseConfigurationsDirectory: expectedDirectory },
        },
      },
    });
    const actualFiles = await readdir(
      join(context.rootPath, expectedDirectory),
    );
    expect(actualFiles).toBeEmpty();
  });

  it('should write database files to the default directory', async () => {
    const db1File1 = join(context.rootPath, 'db1-1.sql');
    const db1File2 = join(context.rootPath, 'db1-2.sql');
    const db2File1 = join(context.rootPath, 'db2-1.sql');
    await writeFile(
      db1File1,
      'CREATE TABLE a; -- comment to discard\nALTER TABLE a1',
    );
    await writeFile(db1File2, 'ALTER TABLE a2');
    await writeFile(
      db2File1,
      'CREATE TABLE b(\nx,\ny,\nz,\n);\nALTER TABLE\nb1',
    );

    const actualResult = await context.call(GoogleSpannerWriteDatabases, {});

    expect(actualResult).toEqual({
      configuration: {
        google: {
          spanner: { databaseConfigurationsDirectory: expectedDirectory },
        },
      },
    });
    const actualDb1ConfigurationStr = await readFile(
      join(context.rootPath, expectedDirectory, 'db1.json'),
    );
    const actualDb1Configuration = JSON.parse(
      actualDb1ConfigurationStr.toString(),
    );
    expect(actualDb1Configuration).toEqual({
      id: 'db1',
      ddls: ['CREATE TABLE a', 'ALTER TABLE a1', 'ALTER TABLE a2'],
      ddlFiles: [db1File1, db1File2],
    });
    const actualDb2ConfigurationStr = await readFile(
      join(context.rootPath, expectedDirectory, 'db2.json'),
    );
    const actualDb2Configuration = JSON.parse(
      actualDb2ConfigurationStr.toString(),
    );
    expect(actualDb2Configuration).toEqual({
      id: 'db2',
      ddls: ['CREATE TABLE b( x, y, z, )', 'ALTER TABLE b1'],
      ddlFiles: [db2File1],
    });
  });

  it('should write database files to the configured directory', async () => {
    const db1File1 = join(context.rootPath, 'db1-1.sql');
    await writeFile(
      db1File1,
      'CREATE TABLE a; -- comment to discard\nALTER TABLE a1',
    );
    const expectedDirectory = 'somewhere-else';
    ({ context } = createContext({
      rootPath: context.rootPath,
      configuration: {
        workspace: { name: '🏷️' },
        google: {
          spanner: {
            ddls: {
              globs: ['*.sql'],
              format: '${ database }',
              regularExpression: '(?<database>[\\w-]+)-.+\\.sql',
            },
            databaseConfigurationsDirectory: expectedDirectory,
          },
        },
      },
      functions: [GoogleSpannerWriteDatabases, GoogleSpannerListDatabases],
    }));

    const actualResult = await context.call(GoogleSpannerWriteDatabases, {});

    expect(actualResult).toEqual({
      configuration: {
        google: {
          spanner: { databaseConfigurationsDirectory: expectedDirectory },
        },
      },
    });
    const actualDb1ConfigurationStr = await readFile(
      join(context.rootPath, expectedDirectory, 'db1.json'),
    );
    const actualDb1Configuration = JSON.parse(
      actualDb1ConfigurationStr.toString(),
    );
    expect(actualDb1Configuration).toEqual({
      id: 'db1',
      ddls: ['CREATE TABLE a', 'ALTER TABLE a1'],
      ddlFiles: [db1File1],
    });
  });

  it('should clean the directory during tear down', async () => {
    const db1File1 = join(context.rootPath, 'db1-1.sql');
    await writeFile(
      db1File1,
      'CREATE TABLE a; -- comment to discard\nALTER TABLE a1',
    );
    await context.call(GoogleSpannerWriteDatabases, {});
    const expectedAbsoluteDirectory = join(context.rootPath, expectedDirectory);
    const existsAfterWrite = existsSync(expectedAbsoluteDirectory);

    await context.call(GoogleSpannerWriteDatabases, { tearDown: true });
    const existsAfterTearDown = existsSync(expectedAbsoluteDirectory);

    expect(existsAfterWrite).toBeTrue();
    expect(existsAfterTearDown).toBeFalse();
  });
});

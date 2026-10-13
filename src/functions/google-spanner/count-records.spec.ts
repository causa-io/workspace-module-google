import { WorkspaceContext } from '@causa/workspace';
import {
  DatabaseCountRecords,
  type ObjectSchema,
  type Property,
} from '@causa/workspace-core';
import {
  FunctionRegistry,
  NoImplementationFoundError,
} from '@causa/workspace/function-registry';
import { createContext, registerMockFunction } from '@causa/workspace/testing';
import { Spanner } from '@google-cloud/spanner';
import { jest } from '@jest/globals';
import 'jest-extended';
import { DatabaseCountRecordsForSpanner } from './count-records.js';
import { GoogleSpannerListDatabases } from './list-databases.js';

const property = (name: string, extensions = {}): Property => ({
  name,
  type: { kind: 'primitive', type: 'string' },
  nullable: true,
  required: true,
  extensions,
});

const SCHEMA: ObjectSchema = {
  kind: 'object',
  name: 'Post',
  path: '/workspace/domains/content/entities/post.yaml',
  extensions: {},
  additionalProperties: false,
  properties: [
    property('id', { googleSpannerColumn: { name: 'postId' } }),
    property('state'),
    property('deletedAt'),
    property('publisher'),
  ],
  databases: [{ engine: 'google.spanner', table: 'Post', primaryKeys: ['id'] }],
};

describe('DatabaseCountRecordsForSpanner', () => {
  let context: WorkspaceContext;
  let functionRegistry: FunctionRegistry<WorkspaceContext>;
  let databases: any[];
  let runMock: jest.Mock<(query: any) => Promise<any>>;
  let databaseMock: jest.Mock<(id: string) => any>;
  let instanceMock: jest.SpiedFunction<Spanner['instance']>;

  beforeEach(() => {
    ({ context, functionRegistry } = createContext({
      configuration: {
        workspace: { name: '🧪' },
        google: {
          project: 'my-project',
          spanner: { instance: { name: 'main' } },
        },
      },
      functions: [DatabaseCountRecordsForSpanner],
    }));
    databases = [
      {
        id: 'content',
        ddlFiles: ['/workspace/domains/content/spanner/0001.sql'],
        tables: [
          {
            name: 'Post',
            file: '/workspace/domains/content/spanner/0001.sql',
            line: 1,
          },
        ],
      },
      {
        id: 'analytics',
        ddlFiles: ['/workspace/domains/analytics/spanner/0001.sql'],
        tables: [
          {
            name: 'Other',
            file: '/workspace/domains/analytics/spanner/0001.sql',
            line: 1,
          },
        ],
      },
    ];
    registerMockFunction(
      functionRegistry,
      GoogleSpannerListDatabases,
      async () => databases,
    );
    jest
      .spyOn(context, 'listDomainPaths')
      .mockResolvedValue([
        '/workspace/domains/analytics',
        '/workspace/domains/content',
      ]);
    runMock = jest.fn(async () => [[{ total: 10, f0: 3, f1: 2, f2: 10 }]]);
    const closeMock = jest.fn(async () => {});
    databaseMock = jest.fn(() => ({ run: runMock, close: closeMock }));
    instanceMock = jest
      .spyOn(Spanner.prototype, 'instance')
      .mockReturnValue({ database: databaseMock } as any);
    jest.spyOn(Spanner.prototype, 'close').mockReturnValue();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should not support other engines', () => {
    expect(() =>
      context.call(DatabaseCountRecords, {
        engine: 'google.firestore',
        schema: SCHEMA,
        filters: {},
      }),
    ).toThrow(NoImplementationFoundError);
  });

  it('should count the rows matching each filter in a single query', async () => {
    const actualCounts = await context.call(DatabaseCountRecords, {
      engine: 'google.spanner',
      schema: SCHEMA,
      filters: {
        published: [
          { path: ['state'], operator: 'equals', value: 'published' },
          { path: ['deletedAt'], operator: 'isNull' },
          { path: ['id'], operator: 'isNotNull' },
        ],
        byCompany: [
          { path: ['publisher', 'type'], operator: 'equals', value: 'company' },
          { path: ['publisher', 'size'], operator: 'equals', value: 3 },
          {
            path: ['publisher', 'is-verified'],
            operator: 'equals',
            value: true,
          },
          { path: ['publisher', 'deletedAt'], operator: 'isNull' },
        ],
        all: [],
      },
    });

    expect(actualCounts).toEqual({
      total: 10,
      counts: { published: 3, byCompany: 2, all: 10 },
    });
    expect(instanceMock).toHaveBeenCalledExactlyOnceWith('main');
    expect(databaseMock).toHaveBeenCalledExactlyOnceWith('content');
    expect(runMock).toHaveBeenCalledExactlyOnceWith({
      sql: [
        'SELECT COUNT(*) AS total',
        'COUNTIF(`state` = @p0 AND `deletedAt` IS NULL AND `postId` IS NOT NULL) AS f0',
        'COUNTIF(JSON_TYPE(`publisher`["type"]) = \'string\' AND JSON_VALUE(`publisher`["type"]) = @p1 AND JSON_TYPE(`publisher`["size"]) = \'number\' AND SAFE_CAST(JSON_VALUE(`publisher`["size"]) AS FLOAT64) = @p2 AND JSON_TYPE(`publisher`["is-verified"]) = \'boolean\' AND JSON_VALUE(`publisher`["is-verified"]) = @p3 AND JSON_VALUE(`publisher`["deletedAt"]) IS NULL) AS f1',
        'COUNTIF(TRUE) AS f2 FROM `Post`',
      ].join(', '),
      params: { p0: 'published', p1: 'company', p2: 3, p3: 'true' },
      json: true,
      jsonOptions: { wrapNumbers: false },
    });
  });

  it('should choose the database in the domain of the schema when several create the table', async () => {
    databases[1].tables.push({
      name: 'Post',
      file: '/workspace/domains/analytics/spanner/0001.sql',
      line: 2,
    });

    await context.call(DatabaseCountRecords, {
      engine: 'google.spanner',
      schema: {
        ...SCHEMA,
        path: '/workspace/domains/analytics/entities/post.yaml#/$defs/Post',
      },
      filters: {},
    });

    expect(databaseMock).toHaveBeenCalledExactlyOnceWith('analytics');
  });

  it('should throw when several databases outside the domain of the schema create the table', async () => {
    databases[1].tables.push({
      name: 'Post',
      file: '/workspace/domains/analytics/spanner/0001.sql',
      line: 2,
    });

    const actualPromise = context.call(DatabaseCountRecords, {
      engine: 'google.spanner',
      schema: { ...SCHEMA, path: '/workspace/domains/other/post.yaml' },
      filters: {},
    });

    await expect(actualPromise).rejects.toThrow(
      "The table 'Post' is created in several Spanner databases: 'content', 'analytics'.",
    );
    expect(runMock).not.toHaveBeenCalled();
  });

  it('should throw when no DDL creates the table', async () => {
    databases.splice(0, 1);

    const actualPromise = context.call(DatabaseCountRecords, {
      engine: 'google.spanner',
      schema: SCHEMA,
      filters: {},
    });

    await expect(actualPromise).rejects.toThrow(
      "No Spanner DDL creates the table 'Post'.",
    );
  });

  it('should throw when a condition is not on a property of the schema', async () => {
    const actualPromise = context.call(DatabaseCountRecords, {
      engine: 'google.spanner',
      schema: SCHEMA,
      filters: { unknown: [{ path: ['unknown'], operator: 'isNull' }] },
    });

    await expect(actualPromise).rejects.toThrow(
      "'unknown' is not a property of 'Post'.",
    );
  });

  it('should throw when the schema is not persisted in a Spanner table', async () => {
    const actualPromise = context.call(DatabaseCountRecords, {
      engine: 'google.spanner',
      schema: { ...SCHEMA, databases: [] },
      filters: {},
    });

    await expect(actualPromise).rejects.toThrow(
      "The schema 'Post' is not persisted in a Spanner table.",
    );
  });
});

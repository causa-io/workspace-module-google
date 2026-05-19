import {
  ModelSchemaExtractDatabase,
  type ObjectSchemaWithoutDatabases,
} from '@causa/workspace-core';
import { NoImplementationFoundError } from '@causa/workspace/function-registry';
import { createContext } from '@causa/workspace/testing';
import { ModelSchemaExtractDatabaseForGoogleSpanner } from './extract-database.js';

describe('ModelSchemaExtractDatabaseForGoogleSpanner', () => {
  function makeSchema(
    extensions: Record<string, unknown>,
    overrides: Partial<ObjectSchemaWithoutDatabases> = {},
  ): ObjectSchemaWithoutDatabases {
    return {
      kind: 'object',
      name: 'MyTable',
      path: '/abs/my-table.yaml',
      properties: [],
      extensions,
      ...overrides,
    };
  }

  function call(schema: ObjectSchemaWithoutDatabases) {
    const { context } = createContext({
      functions: [ModelSchemaExtractDatabaseForGoogleSpanner],
    });
    return context.call(ModelSchemaExtractDatabase, { schema });
  }

  it('should not support a schema without the googleSpannerTable extension', () => {
    expect(() => call(makeSchema({}))).toThrow(NoImplementationFoundError);
  });

  it('should not support a schema where the extension is not an object', () => {
    expect(() => call(makeSchema({ googleSpannerTable: 'nope' }))).toThrow(
      NoImplementationFoundError,
    );
  });

  it('should not support an extension whose primaryKey is not an array', () => {
    expect(() =>
      call(
        makeSchema({
          googleSpannerTable: { name: 'users', primaryKey: 'oops' },
        }),
      ),
    ).toThrow(NoImplementationFoundError);
  });

  it('should derive the table and primary keys from the extension', () => {
    const schema = makeSchema({
      googleSpannerTable: { name: 'users', primaryKey: ['id', 'tenant'] },
    });

    const actual = call(schema);

    expect(actual).toEqual({
      engine: 'google.spanner',
      table: 'users',
      primaryKeys: ['id', 'tenant'],
    });
  });

  it('should default the table to the schema name when not set on the extension', () => {
    const schema = makeSchema(
      { googleSpannerTable: { primaryKey: ['id'] } },
      { name: 'Orders' },
    );

    const actual = call(schema);

    expect(actual).toEqual({
      engine: 'google.spanner',
      table: 'Orders',
      primaryKeys: ['id'],
    });
  });

  it('should drop non-string primary key entries', () => {
    const schema = makeSchema({
      googleSpannerTable: { primaryKey: ['id', 42, { ok: true }, 'tenant'] },
    });

    const actual = call(schema);

    expect(actual.primaryKeys).toEqual(['id', 'tenant']);
  });
});

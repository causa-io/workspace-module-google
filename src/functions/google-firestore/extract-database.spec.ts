import {
  ModelSchemaExtractDatabase,
  type ObjectSchemaWithoutDatabases,
} from '@causa/workspace-core';
import { NoImplementationFoundError } from '@causa/workspace/function-registry';
import { createContext } from '@causa/workspace/testing';
import { ModelSchemaExtractDatabaseForGoogleFirestore } from './extract-database.js';

describe('ModelSchemaExtractDatabaseForGoogleFirestore', () => {
  function makeSchema(
    extensions: Record<string, unknown>,
    overrides: Partial<ObjectSchemaWithoutDatabases> = {},
  ): ObjectSchemaWithoutDatabases {
    return {
      kind: 'object',
      name: 'MyCollection',
      path: '/abs/my-collection.yaml',
      properties: [],
      additionalProperties: false,
      extensions,
      ...overrides,
    };
  }

  function call(schema: ObjectSchemaWithoutDatabases) {
    const { context } = createContext({
      functions: [ModelSchemaExtractDatabaseForGoogleFirestore],
    });
    return context.call(ModelSchemaExtractDatabase, { schema });
  }

  it('should not support a schema without the googleFirestoreCollection extension', () => {
    expect(() => call(makeSchema({}))).toThrow(NoImplementationFoundError);
  });

  it('should not support an extension that is not an object', () => {
    expect(() =>
      call(makeSchema({ googleFirestoreCollection: 'nope' })),
    ).toThrow(NoImplementationFoundError);
  });

  it('should not support an extension whose path is not an array', () => {
    expect(() =>
      call(
        makeSchema({
          googleFirestoreCollection: { name: 'users', path: 'oops' },
        }),
      ),
    ).toThrow(NoImplementationFoundError);
  });

  it('should derive the formatted path, primary keys and prefixed name', () => {
    const schema = makeSchema({
      googleFirestoreCollection: {
        name: 'tenants',
        path: [{ property: 'tenantId' }, 'orders', { property: 'orderId' }],
      },
    });

    const actual = call(schema);

    expect(actual).toEqual({
      engine: 'google.firestore',
      table: 'tenants/{tenantId}/orders/{orderId}',
      primaryKeys: ['tenantId', 'orderId'],
    });
  });

  it('should not prefix the table when the extension has no name', () => {
    const schema = makeSchema({
      googleFirestoreCollection: {
        path: ['users', { property: 'userId' }],
      },
    });

    const actual = call(schema);

    expect(actual).toEqual({
      engine: 'google.firestore',
      table: 'users/{userId}',
      primaryKeys: ['userId'],
    });
  });

  it('should mark malformed path elements with a placeholder', () => {
    const schema = makeSchema({
      googleFirestoreCollection: {
        name: 'col',
        path: [{ property: 'id' }, { notAProperty: true }, 42],
      },
    });

    const actual = call(schema);

    expect(actual).toEqual({
      engine: 'google.firestore',
      table: 'col/{id}/?/?',
      primaryKeys: ['id'],
    });
  });
});

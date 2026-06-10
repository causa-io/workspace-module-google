import type { ObjectSchema, Property } from '@causa/workspace-core';
import { ModelGenerateTypeScriptDecorators } from '@causa/workspace-typescript';
import { NoImplementationFoundError } from '@causa/workspace/function-registry';
import { createContext } from '@causa/workspace/testing';
import { join } from 'path';
import { ModelGenerateTypeScriptDecoratorsForGoogleFirestore } from './generate-typescript-decorators.js';

describe('ModelGenerateTypeScriptDecoratorsForGoogleFirestore', () => {
  const projectPath = '/abs/project';

  function makeSchema(
    extensions: Record<string, unknown>,
    overrides: Partial<ObjectSchema> = {},
  ): ObjectSchema {
    return {
      kind: 'object',
      name: 'MyClass',
      path: join(projectPath, 'src', 'schemas', 'my-class.json'),
      properties: [],
      additionalProperties: false,
      databases: [],
      extensions,
      ...overrides,
    };
  }

  function makeProperty(
    name: string,
    overrides: Partial<Property> = {},
  ): Property {
    return {
      name,
      type: { kind: 'primitive', type: 'string' },
      nullable: false,
      required: true,
      extensions: {},
      ...overrides,
    };
  }

  function setupContext(language = 'typescript') {
    return createContext({
      projectPath,
      configuration: {
        workspace: { name: 'test' },
        project: {
          name: 'my-project',
          type: 'serviceContainer',
          language,
        },
      },
      functions: [ModelGenerateTypeScriptDecoratorsForGoogleFirestore],
    });
  }

  function callForClass(
    schema: ObjectSchema,
    options: {
      configuration?: Record<string, unknown>;
      language?: string;
      generator?: string;
    } = {},
  ) {
    const { context } = setupContext(options.language);
    return context.call(ModelGenerateTypeScriptDecorators, {
      generator: options.generator ?? 'typescriptModelClass',
      configuration: options.configuration ?? {},
      schemas: { [schema.path]: schema },
      schema,
    });
  }

  it('should not support languages other than TypeScript', () => {
    const schema = makeSchema({});

    expect(() => callForClass(schema, { language: 'javascript' })).toThrow(
      NoImplementationFoundError,
    );
  });

  it('should not support a generator other than typescriptModelClass', () => {
    const schema = makeSchema({});

    expect(() => callForClass(schema, { generator: '🤖' })).toThrow(
      NoImplementationFoundError,
    );
  });

  it('should return no decorators when called for a property', async () => {
    const property = makeProperty('id');
    const schema = makeSchema(
      {
        googleFirestoreCollection: {
          name: 'my-collection',
          path: [{ property: 'id' }],
        },
      },
      { properties: [property] },
    );

    const { context } = setupContext();
    const actual = await context.call(ModelGenerateTypeScriptDecorators, {
      generator: 'typescriptModelClass',
      configuration: {},
      schemas: { [schema.path]: schema },
      schema,
      property,
    });

    expect(actual).toEqual([]);
  });

  it('should return no decorators when the schema has no collection attribute', async () => {
    const schema = makeSchema({});

    const actual = await callForClass(schema);

    expect(actual).toEqual([]);
  });

  it('should add the FirestoreCollection decorator', async () => {
    const schema = makeSchema(
      {
        googleFirestoreCollection: {
          name: 'my-collection',
          path: [{ property: 'id' }],
        },
      },
      { properties: [makeProperty('id')] },
    );

    const actual = await callForClass(schema);

    expect(actual).toEqual([
      {
        source: `@_CausaRuntimeGoogleFirestoreCollection({ name: "my-collection", path: (doc) => doc.id })`,
        imports: {
          '@causa/runtime-google': [
            'FirestoreCollection as _CausaRuntimeGoogleFirestoreCollection',
          ],
        },
      },
    ]);
  });

  it('should add the SoftDeletedFirestoreCollection decorator when hasSoftDelete is true', async () => {
    const schema = makeSchema(
      {
        googleFirestoreCollection: {
          name: 'my-collection',
          path: [{ property: 'id' }],
          hasSoftDelete: true,
        },
      },
      { properties: [makeProperty('id')] },
    );

    const actual = await callForClass(schema);

    expect(actual).toEqual([
      {
        source: `@_CausaRuntimeGoogleFirestoreCollection({ name: "my-collection", path: (doc) => doc.id })`,
        imports: {
          '@causa/runtime-google': [
            'FirestoreCollection as _CausaRuntimeGoogleFirestoreCollection',
          ],
        },
      },
      {
        source: '@_CausaRuntimeGoogleSoftDeletedFirestoreCollection()',
        imports: {
          '@causa/runtime-google': [
            'SoftDeletedFirestoreCollection as _CausaRuntimeGoogleSoftDeletedFirestoreCollection',
          ],
        },
      },
    ]);
  });

  it('should build a joined path expression for multi-element paths', async () => {
    const schema = makeSchema(
      {
        googleFirestoreCollection: {
          name: 'my-collection',
          path: [
            'users',
            { property: 'userId' },
            'documents',
            { property: 'documentId' },
          ],
        },
      },
      {
        properties: [makeProperty('userId'), makeProperty('documentId')],
      },
    );

    const actual = await callForClass(schema);

    expect(actual[0].source).toBe(
      `@_CausaRuntimeGoogleFirestoreCollection({ name: "my-collection", path: (doc) => ["users", doc.userId, "documents", doc.documentId].join("/") })`,
    );
  });

  it('should throw when the collection attribute is missing name', () => {
    const schema = makeSchema({
      googleFirestoreCollection: { path: [{ property: 'id' }] },
    });

    expect(() => callForClass(schema)).toThrow(
      `Expected an object with a 'name' string property`,
    );
  });

  it('should throw when the collection attribute is missing path', () => {
    const schema = makeSchema({
      googleFirestoreCollection: { name: 'my-collection' },
    });

    expect(() => callForClass(schema)).toThrow(
      `Expected an object with a 'path' array property`,
    );
  });

  it('should throw when path references a non-existent property', () => {
    const schema = makeSchema(
      {
        googleFirestoreCollection: {
          name: 'my-collection',
          path: [{ property: 'nonExistent' }],
        },
      },
      { properties: [makeProperty('id')] },
    );

    expect(() => callForClass(schema)).toThrow(
      `Property 'nonExistent' referenced in 'path' not found`,
    );
  });

  it('should return no decorators when the schema path does not match the configured globs', async () => {
    const schema = makeSchema(
      {
        googleFirestoreCollection: {
          name: 'my-collection',
          path: [{ property: 'id' }],
        },
      },
      {
        path: join(projectPath, 'other', 'folder', 'schema.json'),
        properties: [makeProperty('id')],
      },
    );

    const actual = await callForClass(schema, {
      configuration: {
        google: { firestore: { globs: ['src/**/*.json'] } },
      },
    });

    expect(actual).toEqual([]);
  });

  it('should generate decorators when the schema path matches the configured globs', async () => {
    const schema = makeSchema(
      {
        googleFirestoreCollection: {
          name: 'my-collection',
          path: [{ property: 'id' }],
        },
      },
      { properties: [makeProperty('id')] },
    );

    const actual = await callForClass(schema, {
      configuration: { google: { firestore: { globs: ['src/**/*.json'] } } },
    });

    expect(actual).toHaveLength(1);
    expect(actual[0].source).toContain(
      '@_CausaRuntimeGoogleFirestoreCollection',
    );
  });
});

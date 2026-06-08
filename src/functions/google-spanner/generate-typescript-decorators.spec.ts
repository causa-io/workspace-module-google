import type { ObjectSchema, Property, Schema } from '@causa/workspace-core';
import { ModelGenerateTypeScriptDecorators } from '@causa/workspace-typescript';
import { NoImplementationFoundError } from '@causa/workspace/function-registry';
import { createContext } from '@causa/workspace/testing';
import { join } from 'path';
import { ModelGenerateTypeScriptDecoratorsForGoogleSpanner } from './generate-typescript-decorators.js';

describe('ModelGenerateTypeScriptDecoratorsForGoogleSpanner', () => {
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
    type: Property['type'],
    overrides: Partial<Property> = {},
  ): Property {
    return {
      name,
      type,
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
      functions: [ModelGenerateTypeScriptDecoratorsForGoogleSpanner],
    });
  }

  function callDecorators(
    schema: ObjectSchema,
    options: {
      property?: Property;
      configuration?: Record<string, unknown>;
      schemas?: Record<string, Schema>;
      language?: string;
      generator?: string;
    } = {},
  ) {
    const { context } = setupContext(options.language);
    return context.call(ModelGenerateTypeScriptDecorators, {
      generator: options.generator ?? 'typescriptModelClass',
      configuration: options.configuration ?? {},
      schemas: options.schemas ?? { [schema.path]: schema },
      schema,
      property: options.property,
    });
  }

  it('should not support languages other than TypeScript', () => {
    const schema = makeSchema({});

    expect(() => callDecorators(schema, { language: 'javascript' })).toThrow(
      NoImplementationFoundError,
    );
  });

  it('should not support a generator other than typescriptModelClass', () => {
    const schema = makeSchema({});

    expect(() => callDecorators(schema, { generator: '🤖' })).toThrow(
      NoImplementationFoundError,
    );
  });

  it('should return no decorators when the schema has no table attribute', async () => {
    const schema = makeSchema({});

    const actual = await callDecorators(schema);

    expect(actual).toEqual([]);
  });

  it('should add the SpannerTable decorator', async () => {
    const schema = makeSchema({
      googleSpannerTable: { primaryKey: ['id'] },
    });

    const actual = await callDecorators(schema);

    expect(actual).toEqual([
      {
        source: '@SpannerTable({"primaryKey":["id"]})',
        imports: { '@causa/runtime-google': ['SpannerTable'] },
      },
    ]);
  });

  it('should include the explicit table name in the SpannerTable decorator', async () => {
    const schema = makeSchema({
      googleSpannerTable: { primaryKey: ['id'], name: 'users' },
    });

    const actual = await callDecorators(schema);

    expect(actual[0].source).toBe(
      '@SpannerTable({"primaryKey":["id"],"name":"users"})',
    );
  });

  it('should throw when the table attribute is invalid', () => {
    const schema = makeSchema({ googleSpannerTable: 'invalid' });

    expect(() => callDecorators(schema)).toThrow(
      `Invalid 'googleSpannerTable' attribute`,
    );
  });

  it('should add an empty SpannerColumn decorator for a plain string property', async () => {
    const schema = makeSchema({ googleSpannerTable: { primaryKey: ['id'] } });
    const property = makeProperty('id', { kind: 'primitive', type: 'string' });

    const actual = await callDecorators(schema, { property });

    expect(actual).toEqual([
      {
        source: '@SpannerColumn()',
        imports: { '@causa/runtime-google': ['SpannerColumn'] },
      },
    ]);
  });

  it('should infer isInt for integer properties', async () => {
    const schema = makeSchema({ googleSpannerTable: { primaryKey: ['id'] } });
    const property = makeProperty('count', {
      kind: 'primitive',
      type: 'integer',
    });

    const actual = await callDecorators(schema, { property });

    expect(actual[0].source).toBe('@SpannerColumn({"isInt":true})');
  });

  it('should infer isJson for map properties', async () => {
    const schema = makeSchema({ googleSpannerTable: { primaryKey: ['id'] } });
    const property = makeProperty('blob', {
      kind: 'map',
      items: 'any',
    });

    const actual = await callDecorators(schema, { property });

    expect(actual[0].source).toBe('@SpannerColumn({"isJson":true})');
  });

  it('should infer isJson for refs to object schemas', async () => {
    const nested: ObjectSchema = {
      kind: 'object',
      name: 'Nested',
      path: join(projectPath, 'src', 'schemas', 'nested.json'),
      properties: [],
      additionalProperties: false,
      databases: [],
      extensions: {},
    };
    const schema = makeSchema({ googleSpannerTable: { primaryKey: ['id'] } });
    const property = makeProperty('nested', { kind: 'ref', ref: nested.path });

    const actual = await callDecorators(schema, {
      property,
      schemas: { [schema.path]: schema, [nested.path]: nested },
    });

    expect(actual[0].source).toBe('@SpannerColumn({"isJson":true})');
  });

  it('should infer isJson for arrays of object refs', async () => {
    const nested: ObjectSchema = {
      kind: 'object',
      name: 'Nested',
      path: join(projectPath, 'src', 'schemas', 'nested.json'),
      properties: [],
      additionalProperties: false,
      databases: [],
      extensions: {},
    };
    const schema = makeSchema({ googleSpannerTable: { primaryKey: ['id'] } });
    const property = makeProperty('items', {
      kind: 'array',
      items: { kind: 'ref', ref: nested.path },
      itemNullable: false,
    });

    const actual = await callDecorators(schema, {
      property,
      schemas: { [schema.path]: schema, [nested.path]: nested },
    });

    expect(actual[0].source).toBe('@SpannerColumn({"isJson":true})');
  });

  it('should infer isInt for arrays of integers', async () => {
    const schema = makeSchema({ googleSpannerTable: { primaryKey: ['id'] } });
    const property = makeProperty('counts', {
      kind: 'array',
      items: { kind: 'primitive', type: 'integer' },
      itemNullable: false,
    });

    const actual = await callDecorators(schema, { property });

    expect(actual[0].source).toBe('@SpannerColumn({"isInt":true})');
  });

  it('should respect tsOptions overriding the inferred type', async () => {
    const schema = makeSchema({ googleSpannerTable: { primaryKey: ['id'] } });
    const property = makeProperty(
      'count',
      { kind: 'primitive', type: 'integer' },
      {
        extensions: { googleSpannerColumn: { tsOptions: { isBigInt: true } } },
      },
    );

    const actual = await callDecorators(schema, { property });

    expect(actual[0].source).toBe('@SpannerColumn({"isBigInt":true})');
  });

  it('should add the name option when overridden', async () => {
    const schema = makeSchema({ googleSpannerTable: { primaryKey: ['id'] } });
    const property = makeProperty(
      'renamed',
      { kind: 'primitive', type: 'string' },
      { extensions: { googleSpannerColumn: { name: 'otherName' } } },
    );

    const actual = await callDecorators(schema, { property });

    expect(actual[0].source).toBe('@SpannerColumn({"name":"otherName"})');
  });

  it('should add the softDelete option for the configured column', async () => {
    const schema = makeSchema({ googleSpannerTable: { primaryKey: ['id'] } });
    const property = makeProperty('isDeleted', {
      kind: 'primitive',
      type: 'boolean',
    });

    const actual = await callDecorators(schema, {
      property,
      configuration: {
        google: { spanner: { softDeletionColumn: 'isDeleted' } },
      },
    });

    expect(actual[0].source).toBe('@SpannerColumn({"softDelete":true})');
  });

  it('should return no decorators when the schema path does not match the configured globs', async () => {
    const schema = makeSchema(
      { googleSpannerTable: { primaryKey: ['id'] } },
      { path: join(projectPath, 'other', 'folder', 'schema.json') },
    );

    const actual = await callDecorators(schema, {
      configuration: { google: { spanner: { globs: ['src/**/*.json'] } } },
    });

    expect(actual).toEqual([]);
  });

  it('should generate decorators when the schema path matches the configured globs', async () => {
    const schema = makeSchema({ googleSpannerTable: { primaryKey: ['id'] } });

    const actual = await callDecorators(schema, {
      configuration: { google: { spanner: { globs: ['src/**/*.json'] } } },
    });

    expect(actual).toHaveLength(1);
    expect(actual[0].source).toContain('@SpannerTable');
  });
});

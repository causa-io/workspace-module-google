import type { WorkspaceContext } from '@causa/workspace';
import {
  TypeScriptModelClassTargetLanguage,
  TypeScriptWithDecoratorsTargetLanguage,
} from '@causa/workspace-typescript';
import { createContext } from '@causa/workspace/testing';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { QuickTypeError } from 'quicktype-core';
import { GoogleFirestoreRenderer } from './google-firestore-renderer.js';
import { generateFromSchema } from './utils.test.js';

describe('GoogleFirestoreRenderer', () => {
  let tmpDir: string;
  let outputFile: string;
  let language: TypeScriptWithDecoratorsTargetLanguage;
  let projectPath: string;
  let context: WorkspaceContext;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'causa-test-'));
    outputFile = join(tmpDir, 'output.ts');
    projectPath = tmpDir;
    ({ context } = createContext({ projectPath }));
    language = new TypeScriptModelClassTargetLanguage(outputFile, context, {
      decoratorRenderers: [GoogleFirestoreRenderer],
    });
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('should not decorate the class if it does not have the collection attribute', async () => {
    const schema = {
      title: 'MyClass',
      type: 'object',
      properties: { myProp: { type: 'string' } },
      required: ['myProp'],
    };

    const actualCode = await generateFromSchema(language, schema, outputFile);

    expect(actualCode).not.toMatch(/@FirestoreCollection/);
    expect(actualCode).not.toMatch(/@SoftDeletedFirestoreCollection/);
  });

  it('should decorate the class with @FirestoreCollection', async () => {
    const schema = {
      title: 'MyClass',
      type: 'object',
      causa: {
        googleFirestoreCollection: {
          name: 'my-collection',
          path: [{ property: 'id' }],
        },
      },
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
      },
    };

    const actualCode = await generateFromSchema(language, schema, outputFile);

    expect(actualCode).toMatch(/@FirestoreCollection\(/);
    expect(actualCode).toMatch(/name:\s*"my-collection"/);
    expect(actualCode).toMatch(/path:\s*\(doc\)\s*=>\s*doc\.id/);
    expect(actualCode).toMatch(/export class MyClass/);
  });

  it('should add @SoftDeletedFirestoreCollection when hasSoftDelete is true', async () => {
    const schema = {
      title: 'MyClass',
      type: 'object',
      causa: {
        googleFirestoreCollection: {
          name: 'my-collection',
          path: [{ property: 'id' }],
          hasSoftDelete: true,
        },
      },
      properties: {
        id: { type: 'string' },
        deletedAt: { type: 'string', format: 'date-time' },
      },
    };

    const actualCode = await generateFromSchema(language, schema, outputFile);

    expect(actualCode).toMatch(/@FirestoreCollection\(/);
    expect(actualCode).toMatch(/@SoftDeletedFirestoreCollection\(\)/);
    expect(actualCode).toMatch(/name:\s*"my-collection"/);
  });

  it('should throw an error if the collection attribute is missing name', async () => {
    const schema = {
      title: 'MyClass',
      type: 'object',
      causa: { googleFirestoreCollection: { path: [{ property: 'id' }] } },
      properties: { id: { type: 'string' } },
    };

    const actualPromise = generateFromSchema(language, schema, outputFile);

    await expect(actualPromise).rejects.toThrow(QuickTypeError);
    await expect(actualPromise).rejects.toHaveProperty(
      'properties.message',
      expect.stringContaining(
        `Expected an object with a 'name' string property`,
      ),
    );
  });

  it('should throw an error if the collection attribute is missing path', async () => {
    const schema = {
      title: 'MyClass',
      type: 'object',
      causa: { googleFirestoreCollection: { name: 'my-collection' } },
      properties: { id: { type: 'string' } },
    };

    const actualPromise = generateFromSchema(language, schema, outputFile);

    await expect(actualPromise).rejects.toThrow(QuickTypeError);
    await expect(actualPromise).rejects.toHaveProperty(
      'properties.message',
      expect.stringContaining(
        `Expected an object with a 'path' array property`,
      ),
    );
  });

  it('should throw an error if path references non-existent property', async () => {
    const schema = {
      title: 'MyClass',
      type: 'object',
      causa: {
        googleFirestoreCollection: {
          name: 'my-collection',
          path: [{ property: 'nonExistent' }],
        },
      },
      properties: { id: { type: 'string' } },
    };

    const actualPromise = generateFromSchema(language, schema, outputFile);

    await expect(actualPromise).rejects.toThrow(QuickTypeError);
    await expect(actualPromise).rejects.toHaveProperty(
      'properties.message',
      expect.stringContaining(
        `Property 'nonExistent' referenced in 'path' not found`,
      ),
    );
  });

  it('should not decorate when schema URI does not match any glob', async () => {
    language = new TypeScriptModelClassTargetLanguage(outputFile, context, {
      decoratorRenderers: [GoogleFirestoreRenderer],
      generatorOptions: {
        google: { firestore: { globs: ['src/**/*.json', 'models/**/*.json'] } },
      },
    });
    const schema = {
      title: 'MyClass',
      type: 'object',
      causa: {
        googleFirestoreCollection: {
          name: 'my-collection',
          path: [{ property: 'id' }],
        },
      },
      properties: { id: { type: 'string' } },
    };
    const schemaUri = join(projectPath, 'other', 'folder', 'schema.json');

    const actualCode = await generateFromSchema(
      language,
      schema,
      outputFile,
      schemaUri,
    );

    expect(actualCode).not.toInclude('@FirestoreCollection');
  });

  it('should decorate when schema URI matches a glob', async () => {
    language = new TypeScriptModelClassTargetLanguage(outputFile, context, {
      decoratorRenderers: [GoogleFirestoreRenderer],
      generatorOptions: { google: { firestore: { globs: ['**/*.json'] } } },
    });
    const schema = {
      title: 'MyClass',
      type: 'object',
      causa: {
        googleFirestoreCollection: {
          name: 'my-collection',
          path: [{ property: 'id' }],
        },
      },
      properties: { id: { type: 'string' } },
    };
    const schemaUri = join(projectPath, 'src', 'schemas', 'schema.json');

    const actualCode = await generateFromSchema(
      language,
      schema,
      outputFile,
      schemaUri,
    );

    expect(actualCode).toInclude('@FirestoreCollection');
  });

  it('should handle complex paths with strings and properties', async () => {
    const schema = {
      title: 'MyClass',
      type: 'object',
      causa: {
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
      properties: {
        userId: { type: 'string' },
        documentId: { type: 'string' },
        title: { type: 'string' },
      },
    };

    const actualCode = await generateFromSchema(language, schema, outputFile);

    expect(actualCode).toMatch(/@FirestoreCollection\(/);
    expect(actualCode).toMatch(/name:\s*"my-collection"/);
    expect(actualCode).toMatch(
      /path:\s*\(doc\)\s*=>\s*\["users",\s*doc\.userId,\s*"documents",\s*doc\.documentId\]\.join\("\/"\)/,
    );
  });
});

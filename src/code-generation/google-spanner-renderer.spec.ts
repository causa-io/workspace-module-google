import {
  TypeScriptModelClassTargetLanguage,
  TypeScriptWithDecoratorsTargetLanguage,
} from '@causa/workspace-typescript';
import { createContext } from '@causa/workspace/testing';
import { jest } from '@jest/globals';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { QuickTypeError } from 'quicktype-core';
import { GoogleSpannerRenderer } from './google-spanner-renderer.js';
import { generateFromSchema } from './utils.test.js';

describe('GoogleSpannerRenderer', () => {
  jest.setTimeout(30000);

  let tmpDir: string;
  let outputFile: string;
  let language: TypeScriptWithDecoratorsTargetLanguage;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'causa-test-'));
    outputFile = join(tmpDir, 'test-output.ts');
    language = new TypeScriptModelClassTargetLanguage(
      outputFile,
      createContext().context,
      {
        decoratorRenderers: [GoogleSpannerRenderer],
        generatorOptions: {
          google: { spanner: { softDeletionColumn: 'isDeleted' } },
        },
      },
    );
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('should not decorate the class if it does not have the table attribute', async () => {
    const schema = {
      title: 'MyClass',
      type: 'object',
      properties: { myProp: { type: 'string' } },
      required: ['myProp'],
    };

    const actualCode = await generateFromSchema(language, schema, outputFile);

    expect(actualCode).not.toMatch(/@SpannerTable/);
    expect(actualCode).not.toMatch(/@SpannerColumn/);
  });

  it('should decorate the class and the properties', async () => {
    const schema = {
      title: 'MyClass',
      type: 'object',
      causa: { tsGoogleSpannerTable: { primaryKey: ['id'] } },
      properties: {
        id: { type: 'string' },
        normalInt: { type: 'integer' },
        overriddenInt: {
          type: 'integer',
          causa: { tsGoogleSpannerColumn: { isBigInt: true } },
        },
        jsonColumn: { type: 'object' },
        overriddenJsonColumn: {
          type: 'object',
          causa: { tsGoogleSpannerColumn: { nestedType: 'ChildClass' } },
        },
        isDeleted: { type: 'boolean' },
        customType: {
          type: 'object',
          causa: { tsType: 'CustomType' },
        },
      },
    };

    const actualCode = await generateFromSchema(language, schema, outputFile);

    expect(actualCode).toMatch(
      /@SpannerTable\(\{\s*primaryKey:\s*\[["']{1}id["']{1}\]\s*\}\)\s*export class MyClass/,
    );
    expect(actualCode).toMatch(/@SpannerColumn\(\)\s*readonly id/);
    expect(actualCode).toMatch(
      /@SpannerColumn\(\{\s*isInt:\s*true\s*\}\)\s*readonly normalInt/,
    );
    expect(actualCode).toMatch(
      /@SpannerColumn\(\{\s*isBigInt:\s*true\s*\}\)\s*readonly overriddenInt/,
    );
    expect(actualCode).toMatch(
      /@SpannerColumn\(\{\s*isJson:\s*true\s*\}\)\s*readonly jsonColumn/,
    );
    expect(actualCode).toMatch(
      /@SpannerColumn\(\{\s*nestedType:\s*ChildClass\s*\}\)\s*readonly overriddenJsonColumn/,
    );
    expect(actualCode).toMatch(
      /@SpannerColumn\(\{\s*softDelete:\s*true\s*\}\)\s*readonly isDeleted/,
    );
    expect(actualCode).toMatch(/@SpannerColumn\(\)\s*readonly customType/);
  });

  it('should only decorate columns when setting tsGoogleSpannerNestedType', async () => {
    const schema = {
      title: 'MyClass',
      type: 'object',
      causa: { tsGoogleSpannerNestedType: true },
      properties: {
        normalInt: { type: 'integer' },
      },
    };

    const actualCode = await generateFromSchema(language, schema, outputFile);

    expect(actualCode).not.toMatch(/@SpannerTable/);
    expect(actualCode).toMatch(
      /@SpannerColumn\(\{\s*isInt:\s*true\s*\}\)\s*readonly normalInt/,
    );
  });

  it('should throw an error if the table attribute is invalid', async () => {
    const schema = {
      title: 'MyClass',
      type: 'object',
      causa: { tsGoogleSpannerTable: 'invalid' },
      properties: {
        normalInt: { type: 'integer' },
      },
    };

    const actualPromise = generateFromSchema(language, schema, outputFile);

    await expect(actualPromise).rejects.toThrow(QuickTypeError);
    await expect(actualPromise).rejects.toHaveProperty(
      'properties.message',
      expect.stringContaining('Invalid tsGoogleSpannerTable attribute'),
    );
  });
});

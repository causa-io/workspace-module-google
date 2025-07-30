import {
  type ClassContext,
  type ClassPropertyContext,
  type TypeScriptDecorator,
  TypeScriptWithDecoratorsRenderer,
  getSingleType,
  typeScriptSourceForObject,
} from '@causa/workspace-typescript';
import { panic } from 'quicktype-core';
import { schemaMatchesGlobPatterns } from './utils.js';

/**
 * The name of the Causa attribute that should be present for a class to be decorated with Google Spanner decorators.
 */
const GOOGLE_SPANNER_TABLE_ATTRIBUTE = 'googleSpannerTable';

/**
 * The name of the optional Causa attribute that can be present on an object property schema to specify options for the
 * `@SpannerColumn` decorator.
 */
const GOOGLE_SPANNER_COLUMN_ATTRIBUTE = 'googleSpannerColumn';

/**
 * The name of the Causa module for the TypeScript Google runtime.
 */
const CAUSA_GOOGLE_MODULE = '@causa/runtime-google';

/**
 * The list of options that can be passed to the `@SpannerColumn` decorator and that indicates that the JSONSchema
 * specifies the type of the column. In this case, the renderer should not infer any type information.
 */
const TYPE_INFO_COLUMN_ATTRIBUTE_NAMES = [
  'isBigInt',
  'isInt',
  'isPreciseDate',
  'isJson',
];

/**
 * A {@link TypeScriptDecoratorsRenderer} that adds Google Spanner decorators from the Causa Google runtime.
 *
 * If an object schema is marked with the `googleSpannerTable` attribute, the `@SpannerTable` decorator is added to the
 * class, and `@SpannerColumn` decorators are added to all its properties.
 */
export class GoogleSpannerRenderer extends TypeScriptWithDecoratorsRenderer {
  decoratorsForClass(context: ClassContext): TypeScriptDecorator[] {
    const tableAttribute =
      context.objectAttributes[GOOGLE_SPANNER_TABLE_ATTRIBUTE];
    const globs =
      this.targetLanguage.options.generatorOptions?.google?.spanner?.globs;
    if (!tableAttribute || !schemaMatchesGlobPatterns(this, context, globs)) {
      return [];
    }

    if (
      typeof tableAttribute !== 'object' ||
      !('primaryKey' in tableAttribute) ||
      !Array.isArray(tableAttribute.primaryKey) ||
      tableAttribute.primaryKey.length === 0 ||
      tableAttribute.primaryKey.some((k: any) => typeof k !== 'string')
    ) {
      panic(
        `Invalid '${GOOGLE_SPANNER_TABLE_ATTRIBUTE}' attribute on '${context.classType.getCombinedName()}'. Expected an object with a 'primaryKey' array.`,
      );
    }
    if ('name' in tableAttribute && typeof tableAttribute.name !== 'string') {
      panic(
        `Invalid 'name' in '${GOOGLE_SPANNER_TABLE_ATTRIBUTE}' attribute on '${context.classType.getCombinedName()}'. Expected a string.`,
      );
    }

    const optionsSource = typeScriptSourceForObject({
      primaryKey: tableAttribute.primaryKey,
      name: tableAttribute.name,
    });

    const decorators: TypeScriptDecorator[] = [];
    this.addDecoratorToList(
      decorators,
      context,
      'SpannerTable',
      CAUSA_GOOGLE_MODULE,
      ['@SpannerTable(', optionsSource, ')'],
    );

    return decorators;
  }

  decoratorsForProperty(context: ClassPropertyContext): TypeScriptDecorator[] {
    const globs =
      this.targetLanguage.options.generatorOptions?.google?.spanner?.globs;
    if (
      !context.objectAttributes[GOOGLE_SPANNER_TABLE_ATTRIBUTE] ||
      !schemaMatchesGlobPatterns(this, context, globs)
    ) {
      return [];
    }

    const attributes =
      context.propertyAttributes[GOOGLE_SPANNER_COLUMN_ATTRIBUTE] ?? {};
    const { generatorOptions } = this.targetLanguage.options;
    const softDeletionColumn =
      generatorOptions?.google?.spanner?.softDeletionColumn;

    const { name: overriddenName, tsOptions } = attributes;
    if (tsOptions && typeof tsOptions !== 'object') {
      panic(
        `Invalid 'tsOptions' in '${GOOGLE_SPANNER_COLUMN_ATTRIBUTE}' attribute. Expected an object.`,
      );
    }
    const columnAttributes: Record<string, any> = tsOptions ?? {};

    if (overriddenName) {
      if (typeof overriddenName !== 'string') {
        panic(
          `Invalid 'name' in '${GOOGLE_SPANNER_COLUMN_ATTRIBUTE}' attribute. Expected a string.`,
        );
      }

      columnAttributes.name = overriddenName;
    }

    const columnName = overriddenName ?? this.names.get(context.name);
    if (columnName === softDeletionColumn) {
      columnAttributes.softDelete = true;
    }

    const singleTypeInfo = getSingleType(context.property.type);
    const schemaOverridesTypeInfo = TYPE_INFO_COLUMN_ATTRIBUTE_NAMES.some(
      (name) => name in columnAttributes,
    );
    if (!schemaOverridesTypeInfo && singleTypeInfo) {
      switch (singleTypeInfo.type.kind) {
        case 'class':
        case 'object':
        case 'map':
          columnAttributes.isJson = true;
          break;
        case 'integer':
          columnAttributes.isInt = true;
          break;
      }
    }

    const optionsSource = typeScriptSourceForObject(columnAttributes);

    const decorators: TypeScriptDecorator[] = [];
    this.addDecoratorToList(
      decorators,
      context,
      'SpannerColumn',
      CAUSA_GOOGLE_MODULE,
      ['@SpannerColumn(', optionsSource, ')'],
    );

    return decorators;
  }
}

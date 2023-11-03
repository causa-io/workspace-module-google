import {
  ClassContext,
  ClassPropertyContext,
  TypeScriptDecorator,
  TypeScriptDecoratorsRenderer,
  getSingleType,
  typeScriptSourceForObject,
} from '@causa/workspace-typescript';
import { panic } from 'quicktype-core';

/**
 * The name of the Causa attribute that should be present for a class to be decorated with Google Spanner decorators.
 */
const GOOGLE_SPANNER_TABLE_ATTRIBUTE = 'tsGoogleSpannerTable';

/**
 * The name of the Causa attribute that can be present on a class to only generate `@SpannerColumn` decorators for its
 * properties, but not a `@SpannerTable` decorator for the class itself.
 */
const GOOGLE_SPANNER_NESTED_TYPE_ATTRIBUTE = 'tsGoogleSpannerNestedType';

/**
 * The name of the optional Causa attribute that can be present on an object property schema to specify options for the
 * `@SpannerColumn` decorator.
 */
const GOOGLE_SPANNER_COLUMN_ATTRIBUTE = 'tsGoogleSpannerColumn';

/**
 * The name of the `decoratorOptions` key that can be used to specify the name of the property that should be used as
 * the soft deletion column.
 */
const GOOGLE_SPANNER_SOFT_DELETION_COLUMN_OPTION =
  'googleSpannerSoftDeletionColumn';

/**
 * The name of the Causa module for the TypeScript Google runtime.
 */
const CAUSA_GOOGLE_MODULE = '@causa/runtime-google';

/**
 * The list of options that can be passed to the `@SpannerColumn` decorator and that indicates that the JSONSchema
 * specifies the type of the column. In this case, the renderer should not infer any type information.
 */
const TYPE_INFO_COLUMN_ATTRIBUTE_NAMES = [
  'nestedType',
  'nullifyNested',
  'isBigInt',
  'isInt',
  'isPreciseDate',
  'isJson',
];

/**
 * A {@link TypeScriptDecoratorsRenderer} that adds Google Spanner decorators from the Causa Google runtime.
 *
 * If an object schema is marked with the `tsGoogleSpannerTable` attribute, the `@SpannerTable` decorator is added to
 * the class, and `@SpannerColumn` decorators are added to all its properties.
 */
export class GoogleSpannerRenderer extends TypeScriptDecoratorsRenderer {
  decoratorsForClass(context: ClassContext): TypeScriptDecorator[] {
    const tableAttribute =
      context.objectAttributes[GOOGLE_SPANNER_TABLE_ATTRIBUTE];
    if (!tableAttribute) {
      return [];
    }

    if (
      typeof tableAttribute !== 'object' ||
      !('primaryKey' in tableAttribute) ||
      !Array.isArray(tableAttribute.primaryKey)
    ) {
      panic(
        `Invalid ${GOOGLE_SPANNER_TABLE_ATTRIBUTE} attribute on ${context.classType.getNames()}`,
      );
    }

    const optionsSource = typeScriptSourceForObject(tableAttribute);

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
    if (
      !context.objectAttributes[GOOGLE_SPANNER_TABLE_ATTRIBUTE] &&
      !context.objectAttributes[GOOGLE_SPANNER_NESTED_TYPE_ATTRIBUTE]
    ) {
      return [];
    }

    const rawColumnAttributes =
      context.propertyAttributes[GOOGLE_SPANNER_COLUMN_ATTRIBUTE] ?? {};
    const columnAttributes =
      typeof rawColumnAttributes === 'object' ? rawColumnAttributes : {};

    const softDeletionColumn =
      this.decoratorOptions[GOOGLE_SPANNER_SOFT_DELETION_COLUMN_OPTION];
    if (softDeletionColumn && context.jsonName === softDeletionColumn) {
      columnAttributes.softDelete = true;
    }

    if (!context.propertyAttributes.tsType) {
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
    }

    const optionsSource = typeScriptSourceForObject(columnAttributes, {
      encoder: (key, value) =>
        key === 'nestedType' ? value : JSON.stringify(value),
    });

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

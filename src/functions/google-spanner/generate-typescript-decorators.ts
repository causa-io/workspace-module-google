import { ModelGenerateTypeScriptDecorators } from '@causa/workspace-typescript';
import {
  type TypeScriptDecorator,
  addDecoratorToList,
} from '@causa/workspace-typescript/code-generation';
import micromatch from 'micromatch';
import { join } from 'path';

/**
 * The name of the Causa extension marking an object schema as a Google Spanner table.
 */
const GOOGLE_SPANNER_TABLE_EXTENSION = 'googleSpannerTable';

/**
 * The name of the optional Causa extension that can be present on an object property schema to specify options for the
 * `@SpannerColumn` decorator.
 */
const GOOGLE_SPANNER_COLUMN_EXTENSION = 'googleSpannerColumn';

/**
 * The name of the Causa module for the TypeScript Google runtime.
 */
const CAUSA_GOOGLE_MODULE = '@causa/runtime-google';

/**
 * The list of options that can be passed to the `@SpannerColumn` decorator and that indicates that the schema specifies
 * the type of the column. In this case, the renderer should not infer any type information.
 */
const TYPE_INFO_COLUMN_ATTRIBUTE_NAMES = [
  'isBigInt',
  'isInt',
  'isPreciseDate',
  'isJson',
];

/**
 * Implements {@link ModelGenerateTypeScriptDecorators} to add Google Spanner decorators from the Causa Google runtime.
 *
 * If an object schema is marked with the `googleSpannerTable` extension, the `@SpannerTable` decorator is added to the
 * class, and `@SpannerColumn` decorators are added to all its properties.
 */
export class ModelGenerateTypeScriptDecoratorsForGoogleSpanner extends ModelGenerateTypeScriptDecorators {
  _call(): TypeScriptDecorator[] {
    const tableAttribute =
      this.schema.extensions[GOOGLE_SPANNER_TABLE_EXTENSION];
    if (!tableAttribute) {
      return [];
    }

    const globs = (this.configuration as any)?.google?.spanner?.globs;
    if (Array.isArray(globs)) {
      const projectPath = this._context.getProjectPathOrThrow();
      const absoluteGlobs = globs.map((g) => join(projectPath, g));
      const schemaPath = this.schema.path.split('#')[0];
      if (!micromatch.isMatch(schemaPath, absoluteGlobs)) {
        return [];
      }
    }

    return this.property
      ? this.decoratorsForProperty()
      : this.decoratorsForClass(tableAttribute);
  }

  _supports(): boolean {
    return (
      this._context.get('project.language') === 'typescript' &&
      this.generator === 'typescriptModelClass'
    );
  }

  private decoratorsForClass(tableAttribute: unknown): TypeScriptDecorator[] {
    const debugName = this.schema.name;
    if (
      typeof tableAttribute !== 'object' ||
      tableAttribute === null ||
      !('primaryKey' in tableAttribute) ||
      !Array.isArray(tableAttribute.primaryKey) ||
      tableAttribute.primaryKey.length === 0 ||
      tableAttribute.primaryKey.some((k) => typeof k !== 'string')
    ) {
      throw new Error(
        `Invalid '${GOOGLE_SPANNER_TABLE_EXTENSION}' attribute on '${debugName}'. Expected an object with a 'primaryKey' array.`,
      );
    }
    const { primaryKey, name } = tableAttribute as {
      primaryKey: string[];
      name?: unknown;
    };
    if (name !== undefined && typeof name !== 'string') {
      throw new Error(
        `Invalid 'name' in '${GOOGLE_SPANNER_TABLE_EXTENSION}' attribute on '${debugName}'. Expected a string.`,
      );
    }

    const decorators: TypeScriptDecorator[] = [];
    addDecoratorToList(
      decorators,
      { schema: this.schema },
      'SpannerTable',
      CAUSA_GOOGLE_MODULE,
      `@SpannerTable(${JSON.stringify({ primaryKey, name })})`,
    );
    return decorators;
  }

  private decoratorsForProperty(): TypeScriptDecorator[] {
    const property = this.property!;
    const rawAttributes =
      property.extensions[GOOGLE_SPANNER_COLUMN_EXTENSION] ?? {};
    if (typeof rawAttributes !== 'object' || rawAttributes === null) {
      throw new Error(
        `Invalid '${GOOGLE_SPANNER_COLUMN_EXTENSION}' attribute on '${this.schema.name}.${property.name}'. Expected an object.`,
      );
    }

    const { name: overriddenName, tsOptions } = rawAttributes as {
      name?: unknown;
      tsOptions?: unknown;
    };
    if (
      tsOptions !== undefined &&
      (typeof tsOptions !== 'object' || tsOptions === null)
    ) {
      throw new Error(
        `Invalid 'tsOptions' in '${GOOGLE_SPANNER_COLUMN_EXTENSION}' attribute. Expected an object.`,
      );
    }
    const columnAttributes: Record<string, unknown> = {
      ...(tsOptions ?? {}),
    };

    if (overriddenName !== undefined) {
      if (typeof overriddenName !== 'string') {
        throw new Error(
          `Invalid 'name' in '${GOOGLE_SPANNER_COLUMN_EXTENSION}' attribute. Expected a string.`,
        );
      }
      columnAttributes.name = overriddenName;
    }

    const softDeletionColumn = (this.configuration as any)?.google?.spanner
      ?.softDeletionColumn;
    const columnName =
      typeof overriddenName === 'string' ? overriddenName : property.name;
    if (columnName === softDeletionColumn) {
      columnAttributes.softDelete = true;
    }

    const schemaOverridesTypeInfo = TYPE_INFO_COLUMN_ATTRIBUTE_NAMES.some(
      (n) => n in columnAttributes,
    );
    if (!schemaOverridesTypeInfo) {
      const type =
        property.type.kind === 'array' ? property.type.items : property.type;
      const resolved = type.kind === 'ref' ? this.schemas[type.ref] : undefined;
      if (type.kind === 'primitive' && type.type === 'integer') {
        columnAttributes.isInt = true;
      } else if (type.kind === 'map' || resolved?.kind === 'object') {
        columnAttributes.isJson = true;
      }
    }

    const hasOptions = Object.keys(columnAttributes).length > 0;
    const source = hasOptions
      ? `@SpannerColumn(${JSON.stringify(columnAttributes)})`
      : '@SpannerColumn()';

    const decorators: TypeScriptDecorator[] = [];
    addDecoratorToList(
      decorators,
      { schema: this.schema, property },
      'SpannerColumn',
      CAUSA_GOOGLE_MODULE,
      source,
    );
    return decorators;
  }
}

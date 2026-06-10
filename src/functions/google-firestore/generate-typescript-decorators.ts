import { ModelGenerateTypeScriptDecorators } from '@causa/workspace-typescript';
import {
  type TypeScriptDecorator,
  addDecoratorToList,
} from '@causa/workspace-typescript/code-generation';
import micromatch from 'micromatch';
import { join } from 'path';

/**
 * The name of the Causa extension marking an object schema as a Google Firestore collection.
 */
const GOOGLE_FIRESTORE_COLLECTION_EXTENSION = 'googleFirestoreCollection';

/**
 * The name of the Causa module for the TypeScript Google runtime.
 */
const CAUSA_GOOGLE_MODULE = '@causa/runtime-google';

/**
 * Implements {@link ModelGenerateTypeScriptDecorators} to add Google Firestore decorators from the Causa Google runtime.
 *
 * If an object schema is marked with the `googleFirestoreCollection` extension, the `@FirestoreCollection` decorator is
 * added to the class. If the `hasSoftDelete` property is `true`, the `@SoftDeletedFirestoreCollection` decorator is also
 * added.
 */
export class ModelGenerateTypeScriptDecoratorsForGoogleFirestore extends ModelGenerateTypeScriptDecorators {
  _call(): TypeScriptDecorator[] {
    if (this.property) {
      return [];
    }

    const attribute =
      this.schema.extensions[GOOGLE_FIRESTORE_COLLECTION_EXTENSION];
    if (!attribute) {
      return [];
    }

    const globs = (this.configuration as any)?.google?.firestore?.globs;
    if (Array.isArray(globs)) {
      const projectPath = this._context.getProjectPathOrThrow();
      const absoluteGlobs = globs.map((g) => join(projectPath, g));
      const schemaPath = this.schema.path.split('#')[0];
      if (!micromatch.isMatch(schemaPath, absoluteGlobs)) {
        return [];
      }
    }

    const debugName = this.schema.name;
    if (typeof attribute !== 'object') {
      throw new Error(
        `Invalid '${GOOGLE_FIRESTORE_COLLECTION_EXTENSION}' attribute on '${debugName}'. Expected an object.`,
      );
    }

    const { name, path, hasSoftDelete } = attribute as {
      name?: unknown;
      path?: unknown;
      hasSoftDelete?: unknown;
    };
    if (typeof name !== 'string') {
      throw new Error(
        `Invalid '${GOOGLE_FIRESTORE_COLLECTION_EXTENSION}' attribute on '${debugName}'. Expected an object with a 'name' string property.`,
      );
    }
    if (!Array.isArray(path)) {
      throw new Error(
        `Invalid '${GOOGLE_FIRESTORE_COLLECTION_EXTENSION}' attribute on '${debugName}'. Expected an object with a 'path' array property.`,
      );
    }

    const propertyNames = new Set(this.schema.properties.map((p) => p.name));
    const elements = path.map((element) => {
      if (typeof element === 'string') {
        return JSON.stringify(element);
      }

      if (
        typeof element === 'object' &&
        element !== null &&
        'property' in element &&
        typeof element.property === 'string'
      ) {
        const propertyName = element.property as string;
        if (!propertyNames.has(propertyName)) {
          throw new Error(
            `Property '${propertyName}' referenced in 'path' not found in '${debugName}'.`,
          );
        }
        return `doc.${propertyName}`;
      }

      throw new Error(
        `Invalid path element in '${GOOGLE_FIRESTORE_COLLECTION_EXTENSION}' attribute on '${debugName}'.`,
      );
    });

    const pathExpression =
      path.length === 1 ? elements[0] : `[${elements.join(', ')}].join("/")`;

    const decorators: TypeScriptDecorator[] = [];
    addDecoratorToList(
      decorators,
      { schema: this.schema },
      'FirestoreCollection',
      CAUSA_GOOGLE_MODULE,
      (alias) =>
        `@${alias}({ name: ${JSON.stringify(name)}, path: (doc) => ${pathExpression} })`,
    );

    if (hasSoftDelete === true) {
      addDecoratorToList(
        decorators,
        { schema: this.schema },
        'SoftDeletedFirestoreCollection',
        CAUSA_GOOGLE_MODULE,
        (alias) => `@${alias}()`,
      );
    }

    return decorators;
  }

  _supports(): boolean {
    return (
      this._context.get('project.language') === 'typescript' &&
      this.generator === 'typescriptModelClass'
    );
  }
}

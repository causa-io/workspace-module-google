import {
  type ClassContext,
  type TypeScriptDecorator,
  TypeScriptWithDecoratorsRenderer,
} from '@causa/workspace-typescript';
import { Name, panic } from 'quicktype-core';
import type { SourcelikeArray } from 'quicktype-core/dist/Source.js';
import { schemaMatchesGlobPatterns } from './utils.js';

/**
 * The name of the Causa attribute that should be present for a class to be decorated with Google Firestore decorators.
 */
const GOOGLE_FIRESTORE_COLLECTION_ATTRIBUTE = 'googleFirestoreCollection';

/**
 * The name of the Causa module for the TypeScript Google runtime.
 */
const CAUSA_GOOGLE_MODULE = '@causa/runtime-google';

/**
 * A {@link TypeScriptDecoratorsRenderer} that adds Google Firestore decorators from the Causa Google runtime.
 *
 * If an object schema is marked with the `googleFirestoreCollection` attribute, the `@FirestoreCollection` decorator
 * is added to the class. If the `hasSoftDelete` property is `true`, the `@SoftDeletedFirestoreCollection` decorator
 * is also added.
 */
export class GoogleFirestoreRenderer extends TypeScriptWithDecoratorsRenderer {
  decoratorsForClass(context: ClassContext): TypeScriptDecorator[] {
    const collectionAttribute =
      context.objectAttributes[GOOGLE_FIRESTORE_COLLECTION_ATTRIBUTE];
    const globs =
      this.targetLanguage.options.generatorOptions?.google?.firestore?.globs;
    if (
      !collectionAttribute ||
      !schemaMatchesGlobPatterns(this, context, globs)
    ) {
      return [];
    }

    const debugName = context.classType.getCombinedName();
    if (typeof collectionAttribute !== 'object') {
      panic(
        `Invalid '${GOOGLE_FIRESTORE_COLLECTION_ATTRIBUTE}' attribute on '${debugName}'. Expected an object.`,
      );
    }

    const { name, path, hasSoftDelete } = collectionAttribute;
    if (typeof name !== 'string') {
      panic(
        `Invalid '${GOOGLE_FIRESTORE_COLLECTION_ATTRIBUTE}' attribute on '${debugName}'. Expected an object with a 'name' string property.`,
      );
    }
    if (!Array.isArray(path)) {
      panic(
        `Invalid '${GOOGLE_FIRESTORE_COLLECTION_ATTRIBUTE}' attribute on '${debugName}'. Expected an object with a 'path' array property.`,
      );
    }

    const requiredProperties = path.flatMap((e) =>
      typeof e === 'object' &&
      e !== null &&
      'property' in e &&
      typeof e.property === 'string'
        ? [e.property]
        : [],
    );

    const propertyReferences = new Map<string, Name>();
    this.forEachClassProperty(context.classType, 'none', (name, jsonName) => {
      if (requiredProperties.includes(jsonName)) {
        propertyReferences.set(jsonName, name);
      }
    });
    for (const propertyName of requiredProperties) {
      if (!propertyReferences.has(propertyName)) {
        panic(
          `Property '${propertyName}' referenced in 'path' not found in '${debugName}'.`,
        );
      }
    }

    const elements: SourcelikeArray = path.map((element) => {
      if (typeof element === 'string') {
        return JSON.stringify(element);
      }

      if (
        typeof element === 'object' &&
        element !== null &&
        'property' in element
      ) {
        const propertyName = element.property;
        const generatedName = propertyReferences.get(propertyName);
        if (!generatedName) {
          panic(`Property '${propertyName}' not found in property references.`);
        }

        return ['doc.', generatedName];
      }

      panic(
        `Invalid path element in '${GOOGLE_FIRESTORE_COLLECTION_ATTRIBUTE}' attribute on '${debugName}'.`,
      );
    });

    const pathExpression: SourcelikeArray =
      path.length === 1
        ? elements
        : ['[', ...elements.flatMap((e) => [e, ', ']), "].join('/')"];

    const decorators: TypeScriptDecorator[] = [];

    this.addDecoratorToList(
      decorators,
      context,
      'FirestoreCollection',
      CAUSA_GOOGLE_MODULE,
      [
        '@FirestoreCollection({ name: ',
        JSON.stringify(name),
        ', path: (doc) => ',
        ...pathExpression,
        '})',
      ],
    );

    if (hasSoftDelete === true) {
      this.addDecoratorToList(
        decorators,
        context,
        'SoftDeletedFirestoreCollection',
        CAUSA_GOOGLE_MODULE,
        ['@SoftDeletedFirestoreCollection()'],
      );
    }

    return decorators;
  }

  decoratorsForProperty(): TypeScriptDecorator[] {
    return [];
  }
}

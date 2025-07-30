import {
  type ClassContext,
  type TypeScriptDecorator,
  TypeScriptWithDecoratorsRenderer,
} from '@causa/workspace-typescript';
import { Name, panic } from 'quicktype-core';
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

    const { name, pathProperty, hasSoftDelete } = collectionAttribute;
    if (typeof name !== 'string') {
      panic(
        `Invalid '${GOOGLE_FIRESTORE_COLLECTION_ATTRIBUTE}' attribute on '${debugName}'. Expected an object with a 'name' string property.`,
      );
    }
    if (typeof pathProperty !== 'string') {
      panic(
        `Invalid '${GOOGLE_FIRESTORE_COLLECTION_ATTRIBUTE}' attribute on '${debugName}'. Expected an object with a 'pathProperty' string property.`,
      );
    }

    let generatedPathPropertyName: Name | undefined;
    this.forEachClassProperty(context.classType, 'none', (name, jsonName) => {
      if (jsonName === pathProperty) {
        generatedPathPropertyName = name;
      }
    });
    if (!generatedPathPropertyName) {
      panic(
        `Property '${pathProperty}' referenced in 'pathProperty' not found in '${debugName}'.`,
      );
    }

    const decorators: TypeScriptDecorator[] = [];

    this.addDecoratorToList(
      decorators,
      context,
      'FirestoreCollection',
      CAUSA_GOOGLE_MODULE,
      [
        '@FirestoreCollection({ name: ',
        JSON.stringify(name),
        ', path: (doc) => doc.',
        generatedPathPropertyName,
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

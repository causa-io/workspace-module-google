import {
  ModelSchemaExtractDatabase,
  type SchemaDatabase,
} from '@causa/workspace-core';

/**
 * The name of the Causa extension marking an object schema as a Google Firestore collection.
 */
const GOOGLE_FIRESTORE_COLLECTION_EXTENSION = 'googleFirestoreCollection';

/**
 * Implements {@link ModelSchemaExtractDatabase} for Google Firestore.
 * The schema is selected when it carries a `googleFirestoreCollection` Causa extension with a `path` array. The table
 * label is the slash-joined formatted path (e.g. `users/{userId}/orders/{orderId}`), optionally prefixed by the
 * extension's `name`. Property references in the path become the primary keys.
 */
export class ModelSchemaExtractDatabaseForGoogleFirestore extends ModelSchemaExtractDatabase {
  _call(): SchemaDatabase {
    const extension = this.schema.extensions[
      GOOGLE_FIRESTORE_COLLECTION_EXTENSION
    ] as { name?: unknown; path: unknown[] };

    const primaryKeys: string[] = [];
    const segments = extension.path.map((element) => {
      if (typeof element === 'string') {
        return element;
      }

      if (
        typeof element === 'object' &&
        element !== null &&
        'property' in element &&
        typeof element.property === 'string'
      ) {
        primaryKeys.push(element.property);
        return `{${element.property}}`;
      }

      return '?';
    });
    if (typeof extension.name === 'string') {
      segments.unshift(extension.name);
    }

    return {
      engine: 'google.firestore',
      table: segments.join('/'),
      primaryKeys,
    };
  }

  _supports(): boolean {
    const extension =
      this.schema.extensions[GOOGLE_FIRESTORE_COLLECTION_EXTENSION];
    return (
      typeof extension === 'object' &&
      extension !== null &&
      Array.isArray((extension as { path?: unknown }).path)
    );
  }
}

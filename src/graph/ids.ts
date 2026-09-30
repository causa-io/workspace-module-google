import { databaseLocator, nodeId } from '@causa/workspace-core/graph';

/**
 * The engine of Spanner databases. It is also the key of `serviceContainer.outputs` listing the databases a project
 * owns, and the `engine` of Spanner database bindings.
 */
export const SPANNER_ENGINE = 'google.spanner';

/**
 * The engine of Firestore databases. It is also the key of `serviceContainer.outputs` listing the collections a
 * project owns, and the `engine` of Firestore database bindings.
 */
export const FIRESTORE_ENGINE = 'google.firestore';

/**
 * The engine of BigQuery datasets.
 */
export const BIGQUERY_ENGINE = 'google.bigquery';

export const spannerInstanceId = (instance: string) =>
  nodeId('google.spanner.instance', instance);

/**
 * The name of a Spanner database within its engine, `<instance>.<database>`, as `outputs['google.spanner']` lists it.
 */
export const spannerDatabaseName = (instance: string, database: string) =>
  `${instance}.${database}`;

export const spannerDatabaseLocator = (instance: string, database: string) =>
  databaseLocator(SPANNER_ENGINE, spannerDatabaseName(instance, database));

export const firestoreDatabaseLocator = (database: string) =>
  databaseLocator(FIRESTORE_ENGINE, database);

export const bigQueryDatasetLocator = (dataset: string) =>
  databaseLocator(BIGQUERY_ENGINE, dataset);

/**
 * Returns the path of the collection holding the documents of a Firestore binding, independently of the properties
 * used as document IDs: the last segment (the document) is dropped, and the other placeholders are replaced with `{}`.
 * For example, `users/{user}/bookmarkFolders/{id}` becomes `users/{}/bookmarkFolders`.
 *
 * @param bindingTable The table of the binding, i.e. the path of its documents.
 * @returns The collection path, or `undefined` if the root collection is not named by the binding.
 */
export function firestoreCollectionPath(
  bindingTable: string,
): string | undefined {
  const segments = bindingTable.split('/').slice(0, -1);
  if (segments.length === 0 || /^\{.*\}$/.test(segments[0])) {
    return undefined;
  }

  return segments
    .map((segment) => (/^\{.*\}$/.test(segment) ? '{}' : segment))
    .join('/');
}

/**
 * The locator of the BigQuery subscription archiving a topic's raw events.
 */
export const rawEventsSubscriptionLocator = (topic: string) =>
  `rawEvents/${topic}`;

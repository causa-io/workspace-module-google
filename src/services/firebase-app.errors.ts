/**
 * The base class for errors in the FirebaseApp service.
 */
export class FirebaseAppServiceError extends Error {}

/**
 * An error thrown when the Firebase admin service account cannot be found in the configured GCP project.
 */
export class FirebaseAdminServiceAccountNotFoundError extends FirebaseAppServiceError {
  constructor(readonly projectId: string) {
    super(
      `Unable to find the service account for Firebase admin from the list of accounts in project '${projectId}'.`,
    );
  }
}

/**
 * An error thrown when a Firebase API key cannot be found in the configured GCP project.
 */
export class FirebaseApiKeyNotFoundError extends FirebaseAppServiceError {
  constructor(readonly projectId: string) {
    super(
      `Unable to find a Firebase API key from the keys listed in project '${projectId}'.`,
    );
  }
}

/**
 * An error thrown when no Firebase app can be found in the given GCP project.
 */
export class NoFirebaseAppFoundError extends FirebaseAppServiceError {
  constructor(readonly projectId: string) {
    super(
      `Unable to find a single Firebase app in project '${projectId}' using the API.`,
    );
  }
}

import { callDeferred, SecretFetch, WorkspaceContext } from '@causa/workspace';

/**
 * An error thrown when the default GCP project is needed to look up a secret but it has not been defined.
 */
export class UndefinedDefaultGcpProjectError extends Error {
  constructor() {
    super(
      'The default GCP project for the Google Secret Manager could not be found in the configuration.',
    );
  }
}

/**
 * An error thrown when the value returned by the Google Secret Manager client cannot be read as a string.
 */
export class UnexpectedSecretValueError extends Error {
  constructor() {
    super(
      'The secret value from the Google Secret Manager could not be parsed.',
    );
  }
}

/**
 * Implements {@link SecretFetch} for secrets using the Google Secret Manager backend (`google.secretManager`).
 *
 * ```yaml
 * secrets:
 *   simpleSecret:
 *     id: simple-secret
 *   secretWithProject:
 *     id: projects/gcp-project/secrets/my-secret
 *   secretWithVersion:
 *     id: projects/gcp-project/secrets/my-secret/versions/12
 * ```
 *
 * If not specified, the GCP project ID will be obtained from `google.secretManager.project`, or will fallback to
 * `google.project`.
 */
export class SecretFetchForGoogleSecretManager extends SecretFetch {
  async _call(context: WorkspaceContext): Promise<string> {
    return await callDeferred(this, context, import.meta.url);
  }

  _supports(): boolean {
    return this.backend === 'google.secretManager';
  }
}

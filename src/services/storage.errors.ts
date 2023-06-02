/**
 * An error thrown when the Cloud Storage URI is invalid.
 * Cloud Storage URIs are of the form `gs://<bucket>/<path>`.
 */
export class InvalidCloudStorageUriError extends Error {
  constructor(readonly uri: string) {
    super(`Invalid Google Cloud Storage URI: '${uri}'.`);
  }
}

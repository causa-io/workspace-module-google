import { File, Storage } from '@google-cloud/storage';
import { InvalidCloudStorageUriError } from './storage.errors.js';

/**
 * A service for interacting with Google Cloud Storage.
 * It exposes a singleton instance of the Google Cloud Storage client.
 */
export class CloudStorageService {
  readonly storage: Storage;

  constructor() {
    this.storage = new Storage();
  }

  /**
   * Parses a Google Cloud Storage URI into a bucket and path.
   * Cloud Storage URIs are of the form `gs://<bucket>/<path>`.
   *
   * @param uri The Google Cloud Storage URI.
   * @returns The name of the Google Cloud Storage bucket and the path within the bucket.
   */
  parseGsUri(uri: string): {
    /**
     * The name of the Google Cloud Storage bucket.
     */
    readonly bucket: string;

    /**
     * The path within the bucket.
     */
    readonly path: string;
  } {
    const match = uri.match(/^gs:\/\/([^/]+)\/(.*)$/);
    if (!match) {
      throw new InvalidCloudStorageUriError(uri);
    }

    return { bucket: match[1], path: match[2] };
  }

  /**
   * Parses a Google Cloud Storage URI into a {@link File}.
   *
   * @param uri The Google Cloud Storage URI.
   * @returns The {@link File} at the given URI.
   */
  getFileFromGsUri(uri: string): File {
    const { bucket, path } = this.parseGsUri(uri);
    return this.storage.bucket(bucket).file(path);
  }
}

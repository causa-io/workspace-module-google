import { SecretFetch, WorkspaceContext } from '@causa/workspace';
import { callDeferred } from '../utils.js';

/**
 * An error thrown when the auth client does not return a token.
 */
export class AuthClientResponseError extends Error {
  constructor() {
    super(
      'Failed to retrieve the Google access token from the auth client response.',
    );
  }
}

/**
 * Implements {@link SecretFetch} to retrieve a Google access token.
 * This backend does not require any configuration, as it does not fetch a specific secret and can only return a single
 * value. A Google access token can be used to authenticate with other Google services. The returned token is configured
 * with the current user (or service account)'s credentials, and for the configured GCP project (if any).
 * The backend ID is `google.accessToken`.
 */
export class SecretFetchForGoogleAccessToken extends SecretFetch {
  async _call(context: WorkspaceContext): Promise<string> {
    return await callDeferred(this, context, import.meta.url);
  }

  _supports(): boolean {
    return this.backend === 'google.accessToken';
  }
}

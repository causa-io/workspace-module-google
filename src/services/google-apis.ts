import { WorkspaceContext } from '@causa/workspace';
import { Common, GoogleApis, google } from 'googleapis';
import type { GoogleConfiguration } from '../configurations/index.js';
import type { ApiClient, OptionsOfApiClient } from './google-apis.types.js';

/**
 * The type of authentication client returned by `googleapis`.
 */
type AnyAuthClient = Awaited<ReturnType<Common.GoogleAuth['getClient']>>;

/**
 * A service that exposes the lowest level of Google API clients, from `googleapis`.
 * Those might be needed in last resort, when no higher level client exists for an API.
 */
export class GoogleApisService {
  /**
   * The GCP project ID read from the {@link WorkspaceContext} configuration.
   */
  readonly projectId: string | undefined;

  constructor(context: WorkspaceContext) {
    this.projectId = context
      .asConfiguration<GoogleConfiguration>()
      .get('google.project');
  }

  /**
   * The promise returning the `JSONClient` configured with the {@link GoogleApisService.projectId}.
   */
  private authClientPromise: Promise<AnyAuthClient> | undefined;

  /**
   * Possibly initializes and returns the auth client to use with Google API clients.
   *
   * @returns The auth client.
   */
  async getAuthClient(): Promise<AnyAuthClient> {
    if (!this.authClientPromise) {
      const auth = new google.auth.GoogleAuth({
        projectId: this.projectId,
        scopes: ['https://www.googleapis.com/auth/cloud-platform'],
      });
      this.authClientPromise = auth.getClient();
    }

    return await this.authClientPromise;
  }

  /**
   * Creates a new client for one of Google's APIs.
   * Authentication is automatically configured.
   *
   * @param api The name of the Google API.
   * @param version The version of the API.
   * @param arg Options passed to the client.
   * @returns The created client.
   */
  async getClient<const T extends keyof GoogleApis, const V extends string>(
    api: T,
    version: V,
    arg: Omit<OptionsOfApiClient<T, V>, 'auth' | 'version'>,
  ): Promise<ApiClient<T, V>> {
    const auth = await this.getAuthClient();
    const clientFn = google[api] as any;
    return clientFn({ ...arg, version, auth });
  }
}

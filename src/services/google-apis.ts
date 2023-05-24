import { WorkspaceContext } from '@causa/workspace';
import { GoogleApis, google } from 'googleapis';
import { GoogleConfiguration } from '../configurations/index.js';
import { ApiClient, OptionsOfApiClient } from './google-apis.types.js';

/**
 * A service that exposes the lowest level of Google API clients, from `googleapis`.
 * Those might be needed in last resort, when no higher level client exists for an API.
 */
export class GoogleApisService {
  /**
   * The GCP project ID read from the {@link WorkspaceContext} configuration.
   */
  readonly projectId: string;

  constructor(context: WorkspaceContext) {
    const googleConf = context.asConfiguration<GoogleConfiguration>();
    this.projectId = googleConf.getOrThrow('google.project');
  }

  /**
   * The promise returning the `JSONClient` configured with the {@link GoogleApisService.projectId}.
   */
  private authClientPromise: Promise<any> | undefined;

  /**
   * Possibly initializes and returns the auth client to use with Google API clients.
   *
   * @returns The auth client.
   */
  async getAuthClient(): Promise<any> {
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

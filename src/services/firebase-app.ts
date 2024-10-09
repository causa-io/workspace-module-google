import { WorkspaceContext } from '@causa/workspace';
import { ApiKeysClient } from '@google-cloud/apikeys';
import { IAMCredentialsClient } from '@google-cloud/iam-credentials';
import {
  type Credential,
  type App as FirebaseAdminApp,
  initializeApp as initializeAdminApp,
} from 'firebase-admin/app';
import { type FirebaseApp, initializeApp } from 'firebase/app';
import { firebase_v1beta1 } from 'googleapis';
import type { Logger } from 'pino';
import * as uuid from 'uuid';
import type { GoogleConfiguration } from '../configurations/index.js';
import {
  FirebaseAdminServiceAccountNotFoundError,
  FirebaseApiKeyNotFoundError,
  NoFirebaseAppFoundError,
} from './firebase-app.errors.js';
import { GoogleApisService } from './google-apis.js';

/**
 * The types (platforms) of Firebase apps.
 * Apps are split by type and cannot be listed globally.
 */
const FIREBASE_APP_TYPES = ['androidApps', 'iosApps', 'webApps'] as const;

/**
 * The type (platform) of a Firebase app.
 */
export type FirebaseAppType = (typeof FIREBASE_APP_TYPES)[number];

/**
 * A string expected to be found in the display name of API keys automatically created by Firebase.
 */
const FIREBASE_AUTOMATIC_KEY_INFO = 'auto created by Firebase';

/**
 * A service exposing generic Firebase functionalities based on the workspace configuration.
 */
export class FirebaseAppService {
  /**
   * The GCP project ID read from the {@link WorkspaceContext} configuration.
   */
  readonly projectId: string;

  /**
   * The Firebase auth domain, read from the configuration or inferred from the GCP project ID.
   */
  readonly authDomain: string;

  /**
   * The logger to use.
   */
  private readonly logger: Logger;

  /**
   * The Firebase API key set in the configuration.
   * This could be `undefined`, in which case {@link FirebaseAppService.findApiKey} will be called.
   */
  private readonly confApiKey: string | undefined;

  /**
   * The Firebase admin service account for the GCP project, read from the configuration.
   * This could be `undefined`, in which case {@link FirebaseAppService.findAdminServiceAccount} will be called.
   */
  private readonly confAdminServiceAccount: string | undefined;

  /**
   * The Firebase app ID, read from the configuration.
   * This could be `undefined`, in which case {@link FirebaseAppService.getAnyAppId} will be called.
   */
  private readonly confAppId: string | undefined;

  /**
   * The {@link GoogleApisService} used to make calls to IAM when listing service accounts.
   */
  private readonly googleApisService: GoogleApisService;

  constructor(context: WorkspaceContext) {
    this.logger = context.logger;
    this.googleApisService = context.service(GoogleApisService);

    const googleConf = context.asConfiguration<GoogleConfiguration>();
    this.projectId = googleConf.getOrThrow('google.project');
    this.confApiKey = googleConf.get('google.firebase.apiKey');
    this.confAdminServiceAccount = googleConf.get(
      'google.firebase.adminServiceAccount',
    );
    this.confAppId = googleConf.get('google.firebase.appId');
    this.authDomain =
      googleConf.get('google.firebase.authDomain') ??
      `${this.projectId}.firebaseapp.com`;
  }

  /**
   * The promise resolving to the Firebase API key, in the case it wasn't set in the configuration.
   */
  private apiKeyPromise: Promise<string> | undefined;

  /**
   * Finds a Firebase API key for the configured GCP project by listing them using the API keys API.
   * The method used to find the correct API key is a hack, relying on the display name of the key.
   * This is why it is preferable for the API key to be set manually in the configuration.
   *
   * @returns A Firebase API key for the configured GCP project.
   */
  private async findApiKey(): Promise<string> {
    this.logger.debug(
      `🛂 'google.firebase.apiKey' is not set. Attempting to fetch the key from Google.`,
    );

    const keysClient = new ApiKeysClient();

    const parent = `projects/${this.projectId}/locations/global`;
    let name: string | undefined;
    for await (const key of keysClient.listKeysAsync({ parent })) {
      if (key.displayName?.includes(FIREBASE_AUTOMATIC_KEY_INFO) && key.name) {
        name = key.name;
        break;
      }
    }
    if (!name) {
      throw new FirebaseApiKeyNotFoundError(this.projectId);
    }

    const [{ keyString }] = await keysClient.getKeyString({ name });
    if (!keyString) {
      throw new Error(
        'Unexpected empty key string returned by the API keys API.',
      );
    }

    this.logger.debug(`🛂 Found Firebase API key '${name}': '${keyString}'.`);

    return keyString;
  }

  /**
   * Returns either the Firebase API key set in the configuration, or one found using the Google APIs.
   *
   * @returns The Firebase API key.
   */
  async getApiKey(): Promise<string> {
    if (this.confApiKey) {
      return this.confApiKey;
    }

    if (!this.apiKeyPromise) {
      this.apiKeyPromise = this.findApiKey();
    }

    return await this.apiKeyPromise;
  }

  /**
   * The singleton {@link FirebaseApp} created by {@link FirebaseAppService.getApp}.
   */
  private app: FirebaseApp | undefined;

  /**
   * Initializes and returns a {@link FirebaseApp} for the configured GCP project.
   *
   * @returns The {@link FirebaseApp}.
   */
  async getApp(): Promise<FirebaseApp> {
    if (this.app) {
      return this.app;
    }

    const apiKey = await this.getApiKey();

    // Due to the async call to get the API key, a parallel call to `getApp` could have created the app already.
    if (this.app) {
      return this.app;
    }

    const name = uuid.v4();
    this.app = initializeApp(
      { projectId: this.projectId, apiKey, authDomain: this.authDomain },
      name,
    );
    return this.app;
  }

  /**
   * The promise resolving to the email of the Firebase-owned service account, in case it wasn't set in the
   * configuration.
   */
  private adminServiceAccountPromise: Promise<string> | undefined;

  /**
   * Looks for the automatically-created Firebase admin service account by listing service accounts in the configured
   * GCP project.
   * This is a hack which uses the inferred format of the service account name used by Firebase. It is preferred to
   * manually set the `google.firebase.adminServiceAccount` configuration.
   *
   * @returns The email of the Firebase admin service account.
   */
  private async findAdminServiceAccount(): Promise<string> {
    this.logger.debug(
      `🛂 'google.firebase.adminServiceAccount' is not set. Listing service accounts in the project to find it.`,
    );

    const iamClient = await this.googleApisService.getClient('iam', 'v1', {});

    const request = {
      name: `projects/${this.projectId}`,
      pageSize: 100,
      pageToken: undefined as string | undefined,
    };

    do {
      const { data } = await iamClient.projects.serviceAccounts.list(request);
      const adminServiceAccount = data.accounts
        ?.filter((a): a is { email: string } => a.email != null)
        .find(({ email }) =>
          email.match(
            `^firebase-adminsdk-[\\w]+@${this.projectId}\\.iam\\.gserviceaccount\\.com$`,
          ),
        );
      if (adminServiceAccount) {
        this.logger.debug(
          `🛂 Found Firebase admin service account as '${adminServiceAccount.email}'.`,
        );
        return adminServiceAccount.email;
      }

      if (data.nextPageToken) {
        request.pageToken = data.nextPageToken;
      }
    } while (request.pageToken);

    throw new FirebaseAdminServiceAccountNotFoundError(this.projectId);
  }

  /**
   * Returns the email for the Firebase admin service account, either from the configuration or by listing service
   * accounts using Google APIs.
   *
   * @returns The email for the Firebase admin service account.
   */
  async getAdminServiceAccount(): Promise<string> {
    if (this.confAdminServiceAccount) {
      return this.confAdminServiceAccount;
    }

    if (!this.adminServiceAccountPromise) {
      this.adminServiceAccountPromise = this.findAdminServiceAccount();
    }

    return await this.adminServiceAccountPromise;
  }

  /**
   * The singleton {@link FirebaseAdminApp}, created by {@link FirebaseAppService.getAdminAppForAdminServiceAccount}.
   */
  private adminAppForAdminServiceAccount: FirebaseAdminApp | undefined;

  /**
   * Returns a Firebase admin app configured to authenticate as the Firebase admin service account.
   * Using a service account rather than end user credentials ensures access to all functionalities (e.g. token
   * signing), which are otherwise unavailable to end users.
   *
   * @returns The Firebase admin app.
   */
  async getAdminAppForAdminServiceAccount(): Promise<FirebaseAdminApp> {
    if (this.adminAppForAdminServiceAccount) {
      return this.adminAppForAdminServiceAccount;
    }

    const serviceAccountId = await this.getAdminServiceAccount();
    const credential = await this.makeAdminCredential(serviceAccountId);

    // Same reasoning as in `getApp()`.
    if (this.adminAppForAdminServiceAccount) {
      return this.adminAppForAdminServiceAccount;
    }

    const name = uuid.v4();
    this.adminAppForAdminServiceAccount = initializeAdminApp(
      {
        projectId: this.projectId,
        serviceAccountId,
        credential,
      },
      name,
    );
    return this.adminAppForAdminServiceAccount;
  }

  /**
   * Creates a {@link Credential} object that can be used when initializing a Firebase admin app.
   * The returned object generates access tokens for the given service account. The application default credentials (or
   * any other default authentication method) should provide authorization to sign tokens in the GCP project for this to
   * work.
   *
   * @param serviceAccountId The ID / email of the service account to impersonate.
   * @returns The {@link Credential} to use with the Firebase admin app.
   */
  private async makeAdminCredential(
    serviceAccountId: string,
  ): Promise<Credential> {
    const iamCredentialsClient = new IAMCredentialsClient();

    return {
      getAccessToken: async () => {
        const [{ accessToken, expireTime }] =
          await iamCredentialsClient.generateAccessToken({
            name: `projects/-/serviceAccounts/${serviceAccountId}`,
            scope: ['https://www.googleapis.com/auth/cloud-platform'],
          });

        const expireTimestamp =
          parseInt((expireTime?.seconds as string | undefined) ?? '0') * 1000;
        const expires_in = Math.floor((expireTimestamp - Date.now()) / 1000);

        return { access_token: accessToken ?? '', expires_in };
      },
    };
  }

  /**
   * Looks for a Firebase app ID using the API and returns the first one found.
   * This could be the ID of an Android, iOS, or web app.
   * If no app can be found, an error is returned.
   *
   * @param options Options when listing the existing apps.
   * @returns The first found Firebase app ID.
   */
  async getAnyAppId(
    options: {
      appTypes?: FirebaseAppType[];
    } = {},
  ): Promise<string> {
    const appTypes = options.appTypes ?? FIREBASE_APP_TYPES;
    const firebaseClient = await this.googleApisService.getClient(
      'firebase',
      'v1beta1',
      {},
    );

    const appIds = await Promise.all(
      appTypes.map((appType) => this.getFirstApp(firebaseClient, appType)),
    );
    const appId = appIds.find((id) => id) ?? null;
    if (!appId) {
      throw new NoFirebaseAppFoundError(this.projectId);
    }

    return appId;
  }

  /**
   * Fetches the first Firebase app of a given type and returns its ID.
   *
   * @param client The Firebase API client to use.
   * @param appType The type of Firebase app to list.
   * @returns The ID of the first app, or `null` if none could be found.
   */
  private async getFirstApp(
    client: firebase_v1beta1.Firebase,
    appType: FirebaseAppType,
  ): Promise<string | null> {
    const {
      data: { apps },
    } = await client.projects[appType].list({
      parent: `projects/${this.projectId}`,
      pageSize: 1,
    });
    return apps ? apps[0]?.appId ?? null : null;
  }

  /**
   * The promise resolving to one of the Firebase App IDs available in the GCP project.
   * Only set if {@link FirebaseAppService.confAppId} is not set.
   */
  private appIdPromise: Promise<string> | undefined;

  /**
   * Returns the Firebase App ID, either from the configuration or by listing apps using Google APIs.
   *
   * @returns The Firebase App ID.
   */
  async getAppId(): Promise<string> {
    if (this.confAppId) {
      return this.confAppId;
    }

    if (!this.appIdPromise) {
      this.appIdPromise = this.getAnyAppId();
    }

    return await this.appIdPromise;
  }
}

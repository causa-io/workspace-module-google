/**
 * The schema for Google / GCP configuration.
 */
export type GoogleConfiguration = {
  /**
   * Configuration for everything Google / GCP-related.
   */
  readonly google?: {
    /**
     * The ID of the default GCP project used when performing operations.
     */
    readonly project?: string;

    /**
     * The ID of a local GCP project (which does not exist on GCP).
     * This is for example used by emulators. It should usually start with `demo-` to be compatible with some emulators.
     */
    readonly localProject?: string;

    /**
     * The list of GCP services on which the project depends.
     * This is useful to automatically enable those services in the GCP project.
     */
    readonly services?: string[];

    /**
     * Configuration for the `gcloud` command.
     * This applies to Dockerized calls to `gcloud` using the official `gcloud` Docker image.
     */
    readonly gcloud?: {
      /**
       * The version of the `gcloud` command.
       */
      readonly version?: string;
    };

    /**
     * Configuration for the Firebase project.
     */
    readonly firebase?: {
      /**
       * An existing service account that can be used to sign Identity Platform custom token.
       * Generating custom tokens by signing them using end-user credentials does not work with Identity Platform.
       * A good choice is usually the service account automatically created by Firebase:
       * `firebase-adminsdk-<random ID>@<GCP project>.iam.gserviceaccount.com`
       * If this is not set and is needed by an operation, an attempt will be made to find this service account in the
       * current `google.project`.
       */
      readonly adminServiceAccount?: string;

      /**
       * The Firebase API key used by clients. Used to perform requests to Firebase as an end user.
       * This can be found in the GCP or Firebase Console.
       * If this is not set and is needed by an operation, an attempt will be made to find the key automatically using
       * the API.
       */
      readonly apiKey?: string;

      /**
       * The Firebase app ID used by clients.
       * This can be found in the Firebase Console. Each platform (Android, iOS, Web) has its own app ID.
       * If this is not set and is needed by an operation, an attempt will be made to find the first eligible app ID
       * using the Firebase API.
       */
      readonly appId?: string;

      /**
       * The domain name for the project.
       * If not set, this default to `<GCP project>.firebaseapp.com`.
       */
      readonly authDomain?: string;

      /**
       * Configuration for Firebase tools (the CLI).
       * This applies to Dockerized calls to the `firebase` CLI.
       */
      readonly tools?: {
        /**
         * The version of the CLI to use.
         */
        readonly version?: string;
      };
    };

    /**
     * Configuration for the Secret Manager service.
     */
    readonly secretManager?: {
      /**
       * The ID of the default GCP project referenced when fetching secrets.
       */
      readonly project?: string;
    };

    /**
     * Configuration for the Firebase Storage service.
     */
    readonly firebaseStorage?: {
      /**
       * Configuration for the emulator.
       */
      readonly emulator?: {
        /**
         * The name of the local Docker container running the emulator.
         */
        readonly containerName?: string;
      };

      /**
       * A list of glob patterns to find files in the workspace defining Firebase Storage security rules.
       */
      readonly securityRuleFiles?: string[];

      /**
       * The file path, relative to the workspace root, where the merged security rules file is written.
       */
      readonly securityRuleFile?: string;
    };

    /**
     * Configuration for the Identity Platform (formerly Firebase Auth) service.
     */
    readonly identityPlatform?: {
      /**
       * Configuration for the emulator.
       */
      readonly emulator?: {
        /**
         * The name of the local Docker container running the emulator.
         */
        readonly containerName?: string;
      };
    };

    /**
     * Configuration for the Firestore service.
     */
    readonly firestore?: {
      /**
       * Configuration for the emulator.
       */
      readonly emulator?: {
        /**
         * The name of the local Docker container running the emulator.
         */
        readonly containerName?: string;
      };

      /**
       * A list of glob patterns to find files in the workspace defining Firestore security rules.
       */
      readonly securityRuleFiles?: string[];

      /**
       * The file path, relative to the workspace root, where the merged security rules file is written.
       */
      readonly securityRuleFile?: string;
    };

    /**
     * Configuration for the Pub/Sub service.
     */
    readonly pubSub?: {
      /**
       * Configuration for the emulator.
       */
      readonly emulator?: {
        /**
         * The name of the local Docker container running the emulator.
         */
        readonly containerName?: string;
      };
    };

    /**
     * Configuration for the Spanner service.
     */
    readonly spanner?: {
      /**
       * Configuration for the emulator.
       */
      readonly emulator?: {
        /**
         * The name of the local Docker container running the emulator.
         */
        readonly containerName?: string;

        /**
         * The version of the Spanner emulator Docker image to use.
         */
        readonly version?: string;

        /**
         * The name of the Spanner instance that will automatically be created in the emulator.
         */
        readonly instanceName?: string;
      };

      /**
       * Defines how DDLs are found for the Spanner databases in the workspace.
       */
      readonly ddls?: {
        /**
         * The format string using groups from the regular expression used to make the database names.
         */
        readonly format?: string;

        /**
         * A list of glob patterns used to find SQL files containing DDL statements for the Spanner databases.
         */
        readonly globs?: string[];

        /**
         * The regular expression used to extract groups from the SQL file paths.
         */
        readonly regularExpression?: string;
      };
    };

    /**
     * Configuration for Cloud Functions.
     */
    readonly cloudFunctions?: {
      /**
       * The Cloud Storage URI where Cloud Functions archives should be uploaded.
       */
      readonly archivesStorageLocation?: string;
    };

    /**
     * Configuration for Cloud Run containers.
     */
    readonly cloudRun?: {
      /**
       * The Docker repository where Cloud Run containers should be uploaded.
       */
      readonly dockerRepository?: string;
    };
  };
};

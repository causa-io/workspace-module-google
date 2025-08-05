# `@causa/workspace-google` module

This repository contains the source code for the `@causa/workspace-google` Causa module. It provides many GCP-related utilities and implementations for `cs` commands. For more information about the Causa CLI `cs`, checkout [its repository](https://github.com/causa-io/cli).

## ➕ Requirements

The Google module requires [Docker](https://www.docker.com/) in order to run local emulators of GCP services.

Although not required, the [`gcloud`](https://cloud.google.com/sdk/gcloud) CLI might be useful, e.g. to set up credentials that will be used by the Causa Google module.

## 🎉 Installation

Add `@causa/workspace-google` to your Causa configuration in `causa.modules`.

## 🔧 Configuration

For all the Google-related configuration in your Causa files, look at [the schema for the `GoogleConfiguration`](./src/configurations/google.ts).

### Firebase

If you use Firebase functionalities and the corresponding CLI commands listed below (e.g. AppCheck, Identity Platform), you may want to set the configuration under the `google.firebase` path. This configuration is optional, but may speed up some CLI commands that would otherwise need to fetch the configuration from GCP using APIs every time they are run. Here is an example of such configuration:

```yaml
google:
  firebase:
    adminServiceAccount: firebase-adminsdk-<random ID>@<GCP project>.iam.gserviceaccount.com
    apiKey: Public API key, e.g. for iOS, Android, or Web.
    appId: Firebase App ID for iOS, Android, or Web.
```

- `adminServiceAccount` references a private service account only known to developers. While it cannot be used without the corresponding IAM credentials, you should ensure only developers with relevant access can read this configuration.
- `apiKey`: Be sure to select a public API key. For example, keys embedded in client applications are safe because they are distributed to all users anyway.
- `appId`: Firebase App IDs are also embedded in client applications. Any (public) app ID is safe to set in the configuration.

This makes the `google.firebase` configuration safe to commit in your repository. Getting access to this configuration does not grant any permission that is either public or has to be set separately in IAM.

## ✨ Supported project types and commands

### Project types

The following Causa `project.type`s are supported:

- `serviceContainer`, with `google.cloudRun` as the `serviceContainer.platform`. This will ensure the built Docker images are pushed to the repository set in `google.cloudRun.dockerRepository`.
- `serverlessFunctions`, with `google.cloudFunctions` as the `serverlessFunctions.platform`. This will push functions archives to the Cloud Storage bucket set in `google.cloudFunctions.archivesStorageLocation`.

### Emulators

The following emulators are implemented:

- `google.firebaseStorage`: The Firebase Storage emulator from the Firebase tools. It supports setting the corresponding security rules. See the `cs google firebaseStorage mergeRules` documentation for more details.
- `google.firestore`: The Firestore emulator from the `gcloud` tools. If supports setting the corresponding security rules. See the `cs google firestore mergeRules` documentation for more details.
- `google.identityPlatform`: The Identity Platform (Firebase Auth) emulator from the Firebase tools.
- `google.pubSub`: The Pub/Sub emulator from the `gcloud` tools. It automatically creates the topics for all event topics found in the Causa workspace. `events.broker` must be set to `google.pubSub` for this.
- `google.spanner`: The Spanner emulator. It automatically creates all the Spanner databases defined in the Causa workspace, and sets up their DDLs. See the `google.spanner` [configuration](./src/configurations/google.ts) for more details.

### Backfilling

Backfilling is supported when `google.pubSub` is set as the `events.broker`. Temporary triggers can be created for Cloud Run services, by referencing them using the format `[[projects/<projectId>/]locations/<location>/]services/<name>/path-to-trigger`.

When no source is specified, the default is to fetch events to backfill from the BigQuery dataset configured in `google.pubSub.bigQueryStorage`. A custom BigQuery table can also be set as source using the `bq://<projectId>.<datasetId>.<tableId>` format. It should have the `data` and `attributes` columns.

### Secrets backend

This module implements the `google.secretManager` secret backend, allowing fetching secrets from the Google Secret Manager service. Here are some example of how secrets with the `google.secretManager` backend should be defined:

```yaml
secrets:
  simpleSecret:
    id: simple-secret
  secretWithProject:
    id: projects/gcp-project/secrets/my-secret
  secretWithVersion:
    id: projects/gcp-project/secrets/my-secret/versions/12
```

When the GCP project is not specified in the secret ID, it is inferred from `google.secretManager.project`, or `google.project` (in this order). This allows defining the GCP project a single time if needed.

A second secret backend, `google.accessToken`, does not fetch secrets from a source but rather returns a GCP access token, which can be used to access Google services:

```yaml
secrets:
  gcpAccessToken:
    backend: google.accessToken
```

### Code generation

This module provides TypeScript decorator renderers for Spanner and Firestore, which can be used to add `@SpannerTable`, `@SpannerColumn`, `@FirestoreCollection`, and `@SoftDeletedFirestoreCollection` decorators to classes generated from events. Below is an example of how to enable it for a JSONSchema object:

```yaml
title: MySpannerTable
type: object
additionalProperties: false
causa:
  # This must be set for the decorators to be added to both the class and its properties.
  # The content of the object will be passed as the argument to the `@SpannerTable` decorator.
  googleSpannerTable:
    primaryKey: [id]
properties:
  id:
    type: string
    format: uuid
    # In most cases, the property-level `googleSpannerColumn` attribute does not need to be set. The decorator configuration will be automatically inferred.
    # If needed, the content of `googleSpannerColumn` will be passed as the argument to the `@SpannerColumn` decorator.
    # causa:
    #   googleSpannerColumn:
    #     isJson: false
  myProperty:
    type: string

---
title: MyFirestoreDocument
type: object
additionalProperties: false
causa:
  # This must be set for the decorators to be added to the class.
  googleFirestoreCollection:
    # Mandatory, the name of the Firestore collection.
    name: myCollection
    # Mandatory, determines how to create the path for a document.
    path: [property: id]
    # This could also contain plain strings, e.g. for `{id}/subCollection/{otherProp}`:
    # path: [property: id, subCollection, property: otherProp]
    # Optional, adds the `@SoftDeletedFirestoreCollection` decorator.
    hasSoftDelete: true
properties:
  id:
    type: string
  otherProp:
    type: string
```

To restrict the decorator to some schema files, you can configure the parent `typescriptModelClass` generator:

```yaml
model:
  codeGenerators:
    - generator: typescriptModelClass

      # ...Rest of the configuration...

      google:
        spanner:
          # Decorators will only be added to the schemas in those files, relative to the project directory.
          globs:
            - ../entities/*.yaml
          # The name of the property / column to which the `softDelete` option should be added.
          softDeletionColumn: deletedAt

        firestore:
          # Same as Spanner globs.
          globs:
            - ../firestore/*.yaml
```

## 🔨 Custom `google` commands

This modules adds a new command to the CLI: `cs google`. Here is the list of subcommands that are exposed.

### App Check

The `cs google appCheck genToken` command generates an App Check token, which can be used to authenticate calls to APIs that are protected by Firebase App Check.

A token is generated for a specific Firebase application. This can be set using the `-a, --app <app>` argument. If it is not set, any Firebase application will be selected automatically using the Firebase API.

An App Check token must be signed using an admin service account in the same project as the app. Firebase automatically creates such an account when it is initialized from a GCP project. This command can take care of automatically finding this account. However, if you want to save on API calls, the email for any service account with Firebase admin permissions can be set in `google.firebase.adminServiceAccount`.

### Enable services

The `cs google enableServices` command will enable all the GCP services defined in `google.services`. This command is also exposed as an infrastructure processors, under the name `GoogleServicesEnable`.

### Firebase Storage

The `cs google firebaseStorage mergeRules` command merges several Firebase security rules files together into a single file that can be used as configuration for both the Firebase Storage emulator, and the Firebase Storage production service.

Input files are found using the glob patterns defined in `google.firebaseStorage.securityRuleFiles`. Input files should not include the header, i.e. they should defined what is **inside**:

```
rules_version = '2';

service firebase.storage {
  match /b/{bucket}/o {
    // Only include what is inside those brackets.
  }
}
```

The output Firebase security rules file can be set in `google.firebaseStorage.securityRuleFile`.

### Firestore

The `cs google firestore mergeRules` command merges several Firebase security rules files together into a single file that can be used as configuration for both the Firestore emulator, and the Firestore production service.

This command is extremely similar to `cs google firebaseStorage mergeRules`. Input files are defined in `google.firestore.securityRuleFiles`, and the output file is defined in `google.firestore.securityRuleFile`.

### Identity Platform

The `cs google identityPlatform genToken` command generates an Identity Platform (formerly Firebase Auth) ID token, which can be used to authenticate calls to API protected by Identity Platform.

This command is similar to `cs google appCheck genToken` in that it requires a service account with Firebase admin permissions to sign the token. See the corresponding command for more information.

## 🧱 Infrastructure processors

The Google module provides several infrastructure processors, which can be used to set up the Causa workspace before running infrastructure-related operations.

### `GoogleFirebaseStorageMergeRules`

[GoogleFirebaseStorageMergeRules](./src/functions/google-firebase-storage-merge-rules.ts) is the same underlying function as the `cs google firebaseStorage mergeRules` command. It allows preparing the Firebase Storage security rules before possibly deploying them along with the infrastructure. See the corresponding command for more details.

### `GoogleFirestoreMergeRules`

[GoogleFirestoreMergeRules](./src/functions/google-firestore-merge-rules.ts) is the same underlying function as the `cs google firestore mergeRules` command. It allows preparing the Firestore security rules before possibly deploying them along with the infrastructure. See the corresponding command for more details.

### `GoogleServicesEnable`

[GoogleServicesEnable](./src/functions/google-services-enable.ts) is the same underlying function as the `cs google enableServices` command. It enables GCP services before preparing or deploying the infrastructure.

Although infrastructure as code tools usually expose this feature as well (e.g. the [`google_project_service`](https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/google_project_service) Terraform resource), it might be more convenient to enable all the required services before running those tools. It avoids having to define dependencies between the services and all the actual resources being deployed.

### `GoogleSpannerWriteDatabases`

[GoogleSpannerWriteDatabases](./src/functions/google-spanner-write-databases.ts) writes a configuration file for each Spanner database, such that it can be picked up by the Causa Spanner Terraform module. This allows automatic setup of Spanner databases and their DDLs.

### `GooglePubSubWriteTopics`

[GooglePubSubWriteTopics](./src/functions/google-pubsub-write-topics.ts) writes a configuration file for each event topic, such that it can be picked up by the Causa Pub/Sub Terraform module. This allows automatic setup of Pub/Sub topics, and optionally of the corresponding BigQuery tables.

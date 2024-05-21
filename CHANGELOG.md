# 🔖 Changelog

## Unreleased

## v0.8.0 (2024-05-21)

Breaking change:

- Drop support for Node.js 16.

Chore:

- Upgrade dependencies.

## v0.7.2 (2024-02-26)

Fixes:

- Log emitted Spanner database errors as warnings. These errors can occur when setting up the Spanner emulator and can safely be ignored.

## v0.7.1 (2024-02-22)

Fixes:

- Set `@google-cloud/spanner` and `google-gax` versions to avoid dependency issues.

## v0.7.0 (2023-11-03)

Features:

- Implement the `google.spanner` TypeScript decorator renderer. This allows decorating generated TypeScript classes with `@SpannerTable` and `@SpannerColumn` decorators.

## v0.6.0 (2023-09-29)

Breaking changes:

- Make `GoogleApisService.projectId` possibly undefined (instead of throwing when it is not set in the configuration).

Features:

- Implement the `google.accessToken` secret backend, which returns an access token for the current GCP user or service account.

Fixes:

- Ensure the Spanner client is closed.

## v0.5.0 (2023-08-05)

Features:

- Define the `google.region` and `bigQueryStorage.location` configuration fields.
- Implement the `CloudRunService`, `IamService`, `PubSubService`, and `ResourceManagerService`.
- Implement the `EventTopicBrokerCreateTrigger`, `EventTopicBrokerDeleteTriggerResource`, `EventTopicBrokerDeleteTriggerResource`, `EventTopicBrokerDeleteTriggerResource`, `EventTopicBrokerPublishEvents`, `EventTopicBrokerDeleteTopic`, `EventTopicBrokerCreateTopic`, and `EventTopicBrokerGetTopicId` functions for the GCP stack (specifically, Cloud Run and Pub/Sub).
- Implement the `PubSubBackfillEventPublisher`.
- Implement the `CloudRunPubSubTriggerService`.
- Implement the `BigQueryService` and `BigQueryEventsSource`.
- Support BigQuery as the default event source for backfilling.

## v0.4.0 (2023-07-28)

Features:

- Define Cloud Run-related configuration used by the [`causa-io/service-container-cloud-run/google`](https://github.com/causa-io/terraform-google-service-container-cloud-run) Terraform module.
- Implement the `GoogleSpannerWriteDatabases` function and infrastructure processor.
- Implement the `GooglePubSubWriteTopics` function and infrastructure processor.

## v0.3.1 (2023-06-09)

Fixes:

- Define missing Cloud Functions and Cloud Run configurations.

## v0.3.0 (2023-06-02)

Features:

- Implement `ProjectGetArtefactDestination` and `ProjectPushArtefact` for Cloud Functions projects.

## v0.2.0 (2023-05-25)

Features:

- Implement the `ProjectGetArtefactDestination` function for `serviceContainer` projects backed by the `google.cloudRun` `serviceContainer.platform`.
- Implement the `GoogleSpannerListDatabases` function.
- Implement the `GcloudEmulatorService`.
- Implement `EmulatorStart` and `EmulatorStop` for the Pub/Sub emulator.
- Implement `EmulatorStart` and `EmulatorStop` for the Firestore emulator.
- Implement the `FirebaseEmulatorService`.
- Implement `EmulatorStart` and `EmulatorStop` for the Firebase Storage emulator.
- Implement `EmulatorStart` and `EmulatorStop` for the Identity Platform emulator.
- Implement `EmulatorStart` and `EmulatorStop` for the Spanner emulator.
- Implement the `GoogleApisService`.
- Implement the `FirebaseAppService`.
- Implement the `GoogleAppCheckGenerateToken` function and CLI command.
- Implement the `GoogleIdentityPlatformGenerateToken` function and CLI command.

## v0.1.1 (2023-05-19)

Fixes:

- Make `GoogleFirestoreMergeRules` and `GoogleFirebaseStorageMergeRules` accept the infrastructure processor `tearDown` argument.

## v0.1.0 (2023-05-19)

Features:

- Implement the `GoogleSecretManagerService`.
- Implement the `SecretFetchForGoogleSecretManager` function.
- Implement the `GoogleServicesEnable` processor function and CLI command.
- Implement the `GoogleFirestoreMergeRules` processor function and CLI command.
- Implement the `GoogleFirebaseStorageMergeRules` processor function and CLI command.

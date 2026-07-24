# 🔖 Changelog

## Unreleased

Features:

- Populate the `id` of `QueriedEvent`s returned by `EventTopicQueryEventsForBigQuery` with the Pub/Sub `message_id` column read from the BigQuery raw events table.
- Populate the `id` of `QueriedLogEntry`s returned by `ServiceContainerQueryLogsForCloudRun` with the Cloud Logging entry `insertId`.

## v1.2.0 (2026-06-11)

Features:

- Implement `ModelGenerateTypeScriptTriggerDecorators` for the Google platform. When generating NestJS event controllers, each trigger-handling method receives a `@UseEventHandler` decorator with the handler ID matching the trigger type: `PUBSUB_EVENT_HANDLER_ID` for `event` / `google.pubSub`, `CLOUD_TASKS_EVENT_HANDLER_ID` for `task` / `google.tasks`, `CLOUD_SCHEDULER_EVENT_HANDLER_ID` for `cron` / `google.scheduler`, and `CLOUDEVENTS_EVENT_HANDLER_ID` for `google.eventarc`.

## v1.1.0 (2026-06-10)

Features:

- Make the `name` property of the `googleFirestoreCollection` schema extension optional. When it is not set, the `name` option is omitted from the generated `@FirestoreCollection` decorator.
- Add the `google.firestore.pathAsArray` code generator configuration. When `true`, the generated `@FirestoreCollection` `path` function returns the path segments as an array instead of a slash-joined string.

## v1.0.1 (2026-06-10)

Fixes:

- Generate aliased imports for the Google Spanner and Firestore decorators (`@SpannerTable`, `@SpannerColumn`, `@FirestoreCollection`, `@SoftDeletedFirestoreCollection`), preventing the external decorator imports from clashing with generated type names.

## v1.0.0 (2026-06-09)

This release includes all the changes from the `v0.18.0-beta.*` version.

## v0.18.0-beta.4 (2026-06-08)

Features:

- Add the `google.pubSub.backfillPublishOptions` configuration to override the Pub/Sub publish options used when backfilling events.
- Add the `google.cloudRun.eventBackfillServiceCloneConfig` configuration. When set, project-scoped backfill triggers deploy a temporary internal-ingress copy of the Cloud Run service (one per trigger) instead of sending events to the live service, isolating the backfill load and scaling from production. The `minInstanceCount`, `maxInstanceCount`, and `requestConcurrency` properties override the scaling of the copy, which is deleted during backfill cleanup.

## v0.18.0-beta.3 (2026-05-27)

Features:

- Implement `EventTopicBrokerWaitForProcessing` for Pub/Sub, polling Cloud Monitoring metrics until all temporary subscriptions of the targeted backfill are drained.
- Add the `google.firestore.emulator.port`, `google.pubSub.emulator.port`, `google.firebaseStorage.emulator.port`, `google.identityPlatform.emulator.port`, `google.spanner.emulator.grpcPort`, and `google.spanner.emulator.httpPort` configurations to override the host ports bound by the emulators, enabling several workspaces to run their emulators in parallel on the same machine.

## v0.18.0-beta.2 (2026-05-22)

Breaking changes:

- Rewrite the `TypeScriptGetDecoratorRendererForGoogleFirestore` and `TypeScriptGetDecoratorRendererForGoogleSpanner` workspace functions (and the underlying `GoogleFirestoreRenderer` / `GoogleSpannerRenderer` classes) as `ModelGenerateTypeScriptDecoratorsForGoogleFirestore` and `ModelGenerateTypeScriptDecoratorsForGoogleSpanner`, following the `@causa/workspace-typescript` breaking change that replaces `TypeScriptGetDecoratorRenderer` with the schema-based `ModelGenerateTypeScriptDecorators` function.

## v0.18.0-beta.1 (2026-05-19)

Features:

- Implement `ModelSchemaExtractDatabase` for the `google.spanner` and `google.firestore` engines, deriving database bindings from the `googleSpannerTable` and `googleFirestoreCollection` Causa extensions.

Chore:

- Adapt to `@causa/workspace`'s removal of the `context` argument from `_call` and `_supports`. The context is now read from `this._context` in all function implementations and deferred calls.
- Adapt to `@causa/workspace-core`'s removal of `BackfillEvent.key`. The Pub/Sub publisher no longer forwards an ordering key.
- Replace `js-yaml` with `yaml` in the schema transformation script.

## v0.17.0 (2026-05-04)

Features:

- Implement `DatabaseQueryRecords` for the `google.spanner` and `google.firestore` engines.
- Implement `ServiceContainerQueryLogs` for the `google.cloudRun` platform by querying Cloud Logging.
- Implement `EventTopicQueryEvents` for Pub/Sub topics whose events are stored in BigQuery.

## v0.16.0 (2026-04-21)

Breaking changes:

- Align with `@causa/workspace-core`'s async-iterable backfilling contract. Drop the `BigQueryEventsSource` and `PubSubBackfillEventPublisher` classes (and the `./backfilling` subpath), replaced by the `EventTopicCreateBackfillSourceForBigQuery` workspace function and inlined Pub/Sub publishing in `EventTopicBrokerPublishEventsForGoogle`.
- Support the new project-scoped trigger format in `EventTopicBrokerCreateTriggerForCloudRun`, on top of the existing URI string.

Features:

- Add the `google.cloudRun.eventBackfillServiceName` configuration, overriding the Cloud Run service targeted by project-scoped backfill triggers.

## v0.15.0 (2026-04-13)

Breaking changes:

- Remove support for Node.js 20.

Fixes:

- Define `vpcAccessConnectorEgressSettings` enum values as upper snake case.

## v0.14.1 (2026-03-16)

Chore:

- Upgrade dependencies.

## v0.14.0 (2026-02-11)

Features:

- Refine configuration schemas with known `events.broker`, `serviceContainer.platform`, `serverlessFunctions.platform`, `infrastructure.processors`, and `secrets` backend values.

## v0.13.0 (2026-02-11)

Same as release candidates.

## v0.13.0-rc.2 (2026-02-10)

Fixes:

- Redefine base service container trigger properties to ensure proper schema matching.

## v0.13.0-rc.1 (2026-02-10)

Breaking changes:

- Move services as a separate export.

Features:

- Define JSONSchemas for configurations and provide them with `CausaListConfigurationSchemas`.

Chores:

- Defer loading of heavy dependencies (Google-related) during function registration.

## v0.12.2 (2026-02-06)

Chore:

- Upgrade dependencies.

## v0.12.1 (2026-02-04)

Chores:

- Upgrade dependencies.

## v0.12.0 (2026-01-14)

Features:

- Add an option to `GoogleIdentityPlatformGenerateToken` to return the refresh token instead of the ID token. This is also available in the CLI command via the `--refresh-token` flag.

## v0.11.0 (2025-10-20)

Breaking changes:

- Change Cloud Functions artefact storage configuration to `google.cloudFunctions.artefactStorage`.

Chores:

- Set `autoPaginate` to false to silence `ApiKeysClient` warning.

## v0.10.1 (2025-08-27)

Chores:

- Upgrade dependencies to fix Spanner client error message.

## v0.10.0 (2025-08-05)

Breaking changes:

- Upgrade the minimum Node.js version to `20`.
- Update the decorator renderer for Google Spanner, remove no longer existing features in the runtime, and rename schema attributes to non-TS-specific names.

Features:

- Only generate the Spanner decorators if the schema URI matches the configured globs.
- Implement the decorator renderer for Firestore.

## v0.9.4 (2025-06-18)

Fixes:

- Handle errors due to eventual consistency of service account creation, when creating a Cloud Run Pub/Sub trigger.
- Fix gRPC warning about auto pagination when retrieving the GCP project number.

Chores:

- Update default Pub/Sub publisher configuration to avoid likely timeout errors.

## v0.9.3 (2025-05-12)

Fixes:

- Set the project ID when initializing the Pub/Sub client.

Chores:

- Adapt to `quicktype` breaking changes.

## v0.9.2 (2025-03-17)

Chores:

- Upgrade dependencies.

## v0.9.1 (2024-10-09)

Chores:

- Upgrade dependencies.

## v0.9.0 (2024-05-27)

Breaking changes:

- Ignore symbolic links when listing Firebase security rules files.

## v0.8.1 (2024-05-22)

Chore:

- Upgrade dependencies, including `@google-cloud/secret-manager` above its buggy releases.

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

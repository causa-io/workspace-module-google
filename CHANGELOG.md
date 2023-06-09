# 🔖 Changelog

## Unreleased

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

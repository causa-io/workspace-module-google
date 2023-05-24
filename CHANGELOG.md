# 🔖 Changelog

## Unreleased

Features:

- Implement the `ProjectGetArtefactDestination` function for `serviceContainer` projects backed by the `google.cloudRun` `serviceContainer.platform`.
- Implement the `GoogleSpannerListDatabases` function.
- Implement the `GcloudEmulatorService`.
- Implement `EmulatorStart` and `EmulatorStop` for the Pub/Sub emulator.
- Implement `EmulatorStart` and `EmulatorStop` for the Firestore emulator.
- Implement the `FirebaseEmulatorService`.
- Implement `EmulatorStart` and `EmulatorStop` for the Firebase Storage emulator.

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

import { ModuleRegistrationContext } from '@causa/workspace';
import { EmulatorStartForFirebaseStorage } from './emulator-start-firebase-storage.js';
import { EmulatorStartForFirestore } from './emulator-start-firestore.js';
import { EmulatorStartForIdentityPlatform } from './emulator-start-identity-platform.js';
import { EmulatorStartForPubSub } from './emulator-start-pubsub.js';
import { EmulatorStopForFirebaseStorage } from './emulator-stop-firebase-storage.js';
import { EmulatorStopForFirestore } from './emulator-stop-firestore.js';
import { EmulatorStopForIdentityPlatform } from './emulator-stop-identity-platform.js';
import { EmulatorStopForPubSub } from './emulator-stop-pubsub.js';
import { EmulatorStopForSpanner } from './emulator-stop-spanner.js';
import { GoogleFirebaseStorageMergeRules } from './google-firebase-storage-merge-rules.js';
import { GoogleFirestoreMergeRules } from './google-firestore-merge-rules.js';
import { GoogleServicesEnable } from './google-services-enable.js';
import { GoogleSpannerListDatabases } from './google-spanner-list-databases.js';
import { ProjectGetArtefactDestinationForServiceContainer } from './project-get-artefact-destination-service-container.js';
import { SecretFetchForGoogleSecretManager } from './secret-fetch-secret-manager.js';

export function registerFunctions(context: ModuleRegistrationContext) {
  context.registerFunctionImplementations(
    EmulatorStartForFirebaseStorage,
    EmulatorStartForFirestore,
    EmulatorStartForIdentityPlatform,
    EmulatorStartForPubSub,
    EmulatorStopForFirebaseStorage,
    EmulatorStopForFirestore,
    EmulatorStopForIdentityPlatform,
    EmulatorStopForPubSub,
    EmulatorStopForSpanner,
    GoogleFirebaseStorageMergeRules,
    GoogleFirestoreMergeRules,
    GoogleServicesEnable,
    GoogleSpannerListDatabases,
    ProjectGetArtefactDestinationForServiceContainer,
    SecretFetchForGoogleSecretManager,
  );
}

import { ModuleRegistrationContext } from '@causa/workspace';
import { EmulatorStartForFirestore } from './emulator-start-firestore.js';
import { EmulatorStartForPubSub } from './emulator-start-pubsub.js';
import { EmulatorStopForFirebaseStorage } from './emulator-stop-firebase-storage.js';
import { EmulatorStopForFirestore } from './emulator-stop-firestore.js';
import { EmulatorStopForPubSub } from './emulator-stop-pubsub.js';
import { GoogleFirebaseStorageMergeRules } from './google-firebase-storage-merge-rules.js';
import { GoogleFirestoreMergeRules } from './google-firestore-merge-rules.js';
import { GoogleServicesEnable } from './google-services-enable.js';
import { GoogleSpannerListDatabases } from './google-spanner-list-databases.js';
import { ProjectGetArtefactDestinationForServiceContainer } from './project-get-artefact-destination-service-container.js';
import { SecretFetchForGoogleSecretManager } from './secret-fetch-secret-manager.js';

export function registerFunctions(context: ModuleRegistrationContext) {
  context.registerFunctionImplementations(
    EmulatorStartForFirestore,
    EmulatorStartForPubSub,
    EmulatorStopForFirebaseStorage,
    EmulatorStopForFirestore,
    EmulatorStopForPubSub,
    GoogleFirebaseStorageMergeRules,
    GoogleFirestoreMergeRules,
    GoogleServicesEnable,
    GoogleSpannerListDatabases,
    ProjectGetArtefactDestinationForServiceContainer,
    SecretFetchForGoogleSecretManager,
  );
}

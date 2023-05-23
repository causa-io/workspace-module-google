import { ModuleRegistrationContext } from '@causa/workspace';
import { GoogleFirebaseStorageMergeRules } from './google-firebase-storage-merge-rules.js';
import { GoogleFirestoreMergeRules } from './google-firestore-merge-rules.js';
import { GoogleServicesEnable } from './google-services-enable.js';
import { ProjectGetArtefactDestinationForServiceContainer } from './project-get-artefact-destination-service-container.js';
import { SecretFetchForGoogleSecretManager } from './secret-fetch-secret-manager.js';

export function registerFunctions(context: ModuleRegistrationContext) {
  context.registerFunctionImplementations(
    GoogleFirebaseStorageMergeRules,
    GoogleFirestoreMergeRules,
    GoogleServicesEnable,
    ProjectGetArtefactDestinationForServiceContainer,
    SecretFetchForGoogleSecretManager,
  );
}

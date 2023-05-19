import { ModuleRegistrationContext } from '@causa/workspace';
import { GoogleFirestoreMergeRules } from './google-firestore-merge-rules.js';
import { GoogleServicesEnable } from './google-services-enable.js';
import { SecretFetchForGoogleSecretManager } from './secret-fetch-secret-manager.js';

export function registerFunctions(context: ModuleRegistrationContext) {
  context.registerFunctionImplementations(
    GoogleFirestoreMergeRules,
    GoogleServicesEnable,
    SecretFetchForGoogleSecretManager,
  );
}

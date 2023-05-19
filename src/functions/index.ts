import { ModuleRegistrationContext } from '@causa/workspace';
import { GoogleServicesEnable } from './google-services-enable.js';
import { SecretFetchForGoogleSecretManager } from './secret-fetch-secret-manager.js';

export function registerFunctions(context: ModuleRegistrationContext) {
  context.registerFunctionImplementations(
    GoogleServicesEnable,
    SecretFetchForGoogleSecretManager,
  );
}

import { ModuleRegistrationContext } from '@causa/workspace';
import { SecretFetchForGoogleSecretManager } from './secret-fetch-secret-manager.js';

export function registerFunctions(context: ModuleRegistrationContext) {
  context.registerFunctionImplementations(SecretFetchForGoogleSecretManager);
}

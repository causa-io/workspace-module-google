import { WorkspaceContext } from '@causa/workspace';
import { GoogleConfiguration } from '../configurations/index.js';

/**
 * The name of the Firebase Storage emulator.
 */
export const FIREBASE_STORAGE_EMULATOR_NAME = 'google.firebaseStorage';

/**
 * Gets the name of the Firebase Storage emulator Docker container from the configuration.
 *
 * @param context The {@link WorkspaceContext}.
 * @returns The name of the Firebase Storage emulator Docker container.
 */
export function getFirebaseStorageContainerName(
  context: WorkspaceContext,
): string {
  const googleConf = context.asConfiguration<GoogleConfiguration>();

  const containerName = googleConf.get(
    'google.firebaseStorage.emulator.containerName',
  );
  if (containerName) {
    return containerName;
  }

  const workspaceName = googleConf.getOrThrow('workspace.name');
  return `${workspaceName}-firebase-storage`;
}

/**
 * The exposed port for Firebase Storage.
 */
export const FIREBASE_STORAGE_PORT = 9199;

/**
 * The location of the Firebase Storage security rules file within the container.
 */
export const FIREBASE_CONTAINER_STORAGE_RULES_FILE = '/home/node/storage.rules';

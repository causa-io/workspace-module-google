import { WorkspaceContext } from '@causa/workspace';
import { GoogleConfiguration } from '../configurations/index.js';

/**
 * The name of the Firestore emulator.
 */
export const FIRESTORE_EMULATOR_NAME = 'google.firestore';

/**
 * Gets the name of the Firestore emulator Docker container from the configuration.
 *
 * @param context The {@link WorkspaceContext}.
 * @returns The name of the Firestore emulator Docker container.
 */
export function getFirestoreContainerName(context: WorkspaceContext): string {
  const googleConf = context.asConfiguration<GoogleConfiguration>();

  const containerName = googleConf.get(
    'google.firestore.emulator.containerName',
  );
  if (containerName) {
    return containerName;
  }

  const workspaceName = googleConf.getOrThrow('workspace.name');
  return `${workspaceName}-firestore`;
}

/**
 * The path to the Firestore security rules file within the container.
 */
export const FIRESTORE_CONTAINER_RULES_FILE = '/firestore.rules';

/**
 * The port on which the Firestore emulator listens.
 */
export const FIRESTORE_PORT = 8080;

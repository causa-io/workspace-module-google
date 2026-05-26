import { WorkspaceContext } from '@causa/workspace';
import type { GoogleConfiguration } from '../configurations/index.js';

/**
 * The name of the Identity Platform emulator.
 */
export const IDENTITY_PLATFORM_EMULATOR_NAME = 'google.identityPlatform';

/**
 * Gets the name of the Identity Platform emulator Docker container from the configuration.
 *
 * @param context The {@link WorkspaceContext}.
 * @returns The name of the Identity Platform emulator Docker container.
 */
export function getIdentityPlatformContainerName(
  context: WorkspaceContext,
): string {
  const googleConf = context.asConfiguration<GoogleConfiguration>();

  const containerName = googleConf.get(
    'google.identityPlatform.emulator.containerName',
  );
  if (containerName) {
    return containerName;
  }

  const workspaceName = googleConf.getOrThrow('workspace.name');
  return `${workspaceName}-identity-platform`;
}

/**
 * The default host port on which the Firebase Auth emulator is listening.
 */
export const FIREBASE_AUTH_PORT = 9099;

/**
 * Returns the host port to which the Identity Platform (Firebase Auth) emulator should be bound.
 * Reads `google.identityPlatform.emulator.port`, falling back to {@link FIREBASE_AUTH_PORT}.
 *
 * @param context The {@link WorkspaceContext}.
 * @returns The host port for the Identity Platform emulator.
 */
export function getIdentityPlatformEmulatorPort(
  context: WorkspaceContext,
): number {
  return (
    context
      .asConfiguration<GoogleConfiguration>()
      .get('google.identityPlatform.emulator.port') ?? FIREBASE_AUTH_PORT
  );
}

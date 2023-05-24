import { WorkspaceContext } from '@causa/workspace';
import { EmulatorStart, EmulatorStartResult } from '@causa/workspace-core';
import { fileURLToPath } from 'url';
import {
  FIREBASE_AUTH_PORT,
  IDENTITY_PLATFORM_EMULATOR_NAME,
  getIdentityPlatformContainerName,
} from '../emulators/index.js';
import { FirebaseEmulatorService } from '../services/index.js';

/**
 * The Firebase configuration file enabling only the Auth emulator.
 */
const FIREBASE_CONF_FILE = fileURLToPath(
  new URL('../assets/firebase-auth.json', import.meta.url),
);

/**
 * Implements {@link EmulatorStart} for the Identity Platform emulator.
 * This actually runs the "legacy" Firebase Auth emulator, which is the same service before it was re-branded.
 */
export class EmulatorStartForIdentityPlatform extends EmulatorStart {
  async _call(context: WorkspaceContext): Promise<EmulatorStartResult> {
    const configuration = await this.startIdentityPlatform(context);

    return { name: IDENTITY_PLATFORM_EMULATOR_NAME, configuration };
  }

  _supports(): boolean {
    return (
      this.name === undefined || this.name === IDENTITY_PLATFORM_EMULATOR_NAME
    );
  }

  /**
   * Starts the Identity Platform (Firebase Auth) emulator.
   *
   * @param context The {@link WorkspaceContext}.
   */
  private async startIdentityPlatform(
    context: WorkspaceContext,
  ): Promise<Record<string, string>> {
    if (this.dryRun) {
      return {};
    }

    context.logger.info('🛂 Starting the Identity Platform emulator.');

    const containerName = getIdentityPlatformContainerName(context);

    const firebaseEmulatorService = context.service(FirebaseEmulatorService);
    await firebaseEmulatorService.start(containerName, FIREBASE_CONF_FILE, [
      {
        host: '127.0.0.1',
        local: FIREBASE_AUTH_PORT,
        container: FIREBASE_AUTH_PORT,
      },
    ]);

    context.logger.info(
      '🛂 Successfully initialized the Identity Platform emulator.',
    );

    return {
      FIREBASE_AUTH_EMULATOR_HOST: `127.0.0.1:${FIREBASE_AUTH_PORT}`,
      GOOGLE_CLOUD_PROJECT: firebaseEmulatorService.localGcpProject,
      GCP_PROJECT: firebaseEmulatorService.localGcpProject,
      GCLOUD_PROJECT: firebaseEmulatorService.localGcpProject,
      FIREBASE_CONFIG: '{}',
    };
  }
}

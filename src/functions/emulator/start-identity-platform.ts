import { EmulatorStart, type EmulatorStartResult } from '@causa/workspace-core';
import { fileURLToPath } from 'url';
import {
  FIREBASE_AUTH_PORT,
  IDENTITY_PLATFORM_EMULATOR_NAME,
  getIdentityPlatformContainerName,
  getIdentityPlatformEmulatorPort,
} from '../../emulators/index.js';
import { FirebaseEmulatorService } from '../../services/firebase-emulator.js';

/**
 * The Firebase configuration file enabling only the Auth emulator.
 */
const FIREBASE_CONF_FILE = fileURLToPath(
  new URL('../../assets/firebase-auth.json', import.meta.url),
);

/**
 * Implements {@link EmulatorStart} for the Identity Platform emulator.
 * This actually runs the "legacy" Firebase Auth emulator, which is the same service before it was re-branded.
 */
export class EmulatorStartForIdentityPlatform extends EmulatorStart {
  async _call(): Promise<EmulatorStartResult> {
    const configuration = await this.startIdentityPlatform();

    return { name: IDENTITY_PLATFORM_EMULATOR_NAME, configuration };
  }

  _supports(): boolean {
    return (
      this.name === undefined || this.name === IDENTITY_PLATFORM_EMULATOR_NAME
    );
  }

  /**
   * Starts the Identity Platform (Firebase Auth) emulator.
   */
  private async startIdentityPlatform(): Promise<Record<string, string>> {
    if (this.dryRun) {
      return {};
    }

    this._context.logger.info('🛂 Starting the Identity Platform emulator.');

    const containerName = getIdentityPlatformContainerName(this._context);
    const hostPort = getIdentityPlatformEmulatorPort(this._context);

    const firebaseEmulatorService = this._context.service(
      FirebaseEmulatorService,
    );
    await firebaseEmulatorService.start(containerName, FIREBASE_CONF_FILE, [
      { host: '127.0.0.1', local: hostPort, container: FIREBASE_AUTH_PORT },
    ]);

    this._context.logger.info(
      '🛂 Successfully initialized the Identity Platform emulator.',
    );

    return {
      FIREBASE_AUTH_EMULATOR_HOST: `127.0.0.1:${hostPort}`,
      GOOGLE_CLOUD_PROJECT: firebaseEmulatorService.localGcpProject,
      GCP_PROJECT: firebaseEmulatorService.localGcpProject,
      GCLOUD_PROJECT: firebaseEmulatorService.localGcpProject,
      FIREBASE_CONFIG: '{}',
    };
  }
}

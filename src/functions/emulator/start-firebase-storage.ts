import { EmulatorStart, type EmulatorStartResult } from '@causa/workspace-core';
import { fileURLToPath } from 'url';
import {
  FIREBASE_CONTAINER_STORAGE_RULES_FILE,
  FIREBASE_STORAGE_EMULATOR_NAME,
  FIREBASE_STORAGE_PORT,
  getFirebaseStorageContainerName,
} from '../../emulators/index.js';
import { FirebaseEmulatorService } from '../../services/firebase-emulator.js';
import { GoogleFirebaseStorageMergeRules } from '../google-firebase-storage/index.js';

/**
 * The Firebase configuration file enabling only the Storage emulator.
 */
const FIREBASE_CONF_FILE = fileURLToPath(
  new URL('../../assets/firebase-storage.json', import.meta.url),
);

/**
 * Implements {@link EmulatorStart} for the Firebase Storage container.
 * This first merges the Firebase Storage security rules into a single file, and uses this file to configure the
 * emulator.
 */
export class EmulatorStartForFirebaseStorage extends EmulatorStart {
  async _call(): Promise<EmulatorStartResult> {
    const configuration = await this.startFirebaseStorage();

    return { name: FIREBASE_STORAGE_EMULATOR_NAME, configuration };
  }

  _supports(): boolean {
    return (
      this.name === undefined || this.name === FIREBASE_STORAGE_EMULATOR_NAME
    );
  }

  /**
   * Merges the Firebase Storage security rules into a single file, and starts the Firebase Storage emulator using them.
   */
  private async startFirebaseStorage(): Promise<Record<string, string>> {
    if (this.dryRun) {
      return {};
    }

    const { securityRuleFile } = await this._context.call(
      GoogleFirebaseStorageMergeRules,
      {},
    );

    this._context.logger.info('️🍱 Starting Firebase Storage emulator.');

    const containerName = getFirebaseStorageContainerName(this._context);

    const firebaseEmulatorService = this._context.service(
      FirebaseEmulatorService,
    );
    await firebaseEmulatorService.start(
      containerName,
      FIREBASE_CONF_FILE,
      [
        {
          host: '127.0.0.1',
          container: FIREBASE_STORAGE_PORT,
          local: FIREBASE_STORAGE_PORT,
        },
      ],
      {
        mounts: [
          {
            type: 'bind',
            source: securityRuleFile ?? '',
            destination: FIREBASE_CONTAINER_STORAGE_RULES_FILE,
            readonly: true,
          },
        ],
        // The Firebase Storage emulator returns "not implemented" when a request to the root is made.
        expectedStatus: 501,
      },
    );

    this._context.logger.info(
      '️🍱 Successfully initialized Firebase Storage emulator.',
    );

    return {
      FIREBASE_STORAGE_EMULATOR_HOST: `127.0.0.1:${FIREBASE_STORAGE_PORT}`,
      GOOGLE_CLOUD_PROJECT: firebaseEmulatorService.localGcpProject,
      GCP_PROJECT: firebaseEmulatorService.localGcpProject,
      GCLOUD_PROJECT: firebaseEmulatorService.localGcpProject,
      FIREBASE_STORAGE_BUCKET_NAME: `${firebaseEmulatorService.localGcpProject}.appspot.com`,
      FIREBASE_CONFIG: '{}',
    };
  }
}

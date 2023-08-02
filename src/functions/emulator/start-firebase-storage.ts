import { WorkspaceContext } from '@causa/workspace';
import { EmulatorStart, EmulatorStartResult } from '@causa/workspace-core';
import { fileURLToPath } from 'url';
import {
  FIREBASE_CONTAINER_STORAGE_RULES_FILE,
  FIREBASE_STORAGE_EMULATOR_NAME,
  FIREBASE_STORAGE_PORT,
  getFirebaseStorageContainerName,
} from '../../emulators/index.js';
import { FirebaseEmulatorService } from '../../services/index.js';
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
  async _call(context: WorkspaceContext): Promise<EmulatorStartResult> {
    const configuration = await this.startFirebaseStorage(context);

    return { name: FIREBASE_STORAGE_EMULATOR_NAME, configuration };
  }

  _supports(): boolean {
    return (
      this.name === undefined || this.name === FIREBASE_STORAGE_EMULATOR_NAME
    );
  }

  /**
   * Merges the Firebase Storage security rules into a single file, and starts the Firebase Storage emulator using them.
   *
   * @param context The {@link WorkspaceContext}.
   */
  private async startFirebaseStorage(
    context: WorkspaceContext,
  ): Promise<Record<string, string>> {
    if (this.dryRun) {
      return {};
    }

    const { securityRuleFile } = await context.call(
      GoogleFirebaseStorageMergeRules,
      {},
    );

    context.logger.info('️🍱 Starting Firebase Storage emulator.');

    const containerName = getFirebaseStorageContainerName(context);

    const firebaseEmulatorService = context.service(FirebaseEmulatorService);
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

    context.logger.info(
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

import { EmulatorStart, type EmulatorStartResult } from '@causa/workspace-core';
import {
  FIRESTORE_CONTAINER_RULES_FILE,
  FIRESTORE_EMULATOR_NAME,
  FIRESTORE_PORT,
  getFirestoreContainerName,
  getFirestoreEmulatorPort,
} from '../../emulators/index.js';
import { GcloudEmulatorService } from '../../services/gcloud-emulator.js';
import { GoogleFirestoreMergeRules } from '../google-firestore/index.js';

/**
 * Implements {@link EmulatorStart} for the Firestore emulator.
 * This first merges the Firestore security rules into a single file, and uses this file to configure the emulator.
 */
export class EmulatorStartForFirestore extends EmulatorStart {
  async _call(): Promise<EmulatorStartResult> {
    const configuration = await this.startFirestore();

    return { name: FIRESTORE_EMULATOR_NAME, configuration };
  }

  _supports(): boolean {
    return this.name === undefined || this.name === FIRESTORE_EMULATOR_NAME;
  }

  /**
   * Merges the Firestore security rules into a single file, and starts the Firestore emulator using them.
   *
   * @returns The configuration for the Firestore emulator.
   */
  private async startFirestore(): Promise<Record<string, string>> {
    if (this.dryRun) {
      return {};
    }

    const { securityRuleFile } = await this._context.call(
      GoogleFirestoreMergeRules,
      {},
    );

    this._context.logger.info('🗃️ Starting Firestore emulator.');

    const containerName = getFirestoreContainerName(this._context);
    const hostPort = getFirestoreEmulatorPort(this._context);

    const gcloudEmulatorService = this._context.service(GcloudEmulatorService);
    await gcloudEmulatorService.start(
      'firestore',
      containerName,
      [{ host: '127.0.0.1', local: hostPort, container: FIRESTORE_PORT }],
      {
        mounts: [
          {
            type: 'bind',
            source: securityRuleFile ?? '',
            destination: FIRESTORE_CONTAINER_RULES_FILE,
            readonly: true,
          },
        ],
        additionalArguments: ['--rules', FIRESTORE_CONTAINER_RULES_FILE],
        availabilityEndpoint: `http://127.0.0.1:${hostPort}/`,
      },
    );

    this._context.logger.info(
      '🗃️ Successfully initialized Firestore emulator.',
    );

    return {
      FIRESTORE_EMULATOR_HOST: `127.0.0.1:${hostPort}`,
      GOOGLE_CLOUD_PROJECT: gcloudEmulatorService.localGcpProject,
      GCP_PROJECT: gcloudEmulatorService.localGcpProject,
      GCLOUD_PROJECT: gcloudEmulatorService.localGcpProject,
      FIREBASE_CONFIG: '{}',
    };
  }
}

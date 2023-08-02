import { WorkspaceContext } from '@causa/workspace';
import { EmulatorStart, EmulatorStartResult } from '@causa/workspace-core';
import {
  FIRESTORE_CONTAINER_RULES_FILE,
  FIRESTORE_EMULATOR_NAME,
  FIRESTORE_PORT,
  getFirestoreContainerName,
} from '../../emulators/index.js';
import { GcloudEmulatorService } from '../../services/index.js';
import { GoogleFirestoreMergeRules } from '../google-firestore-merge-rules.js';

/**
 * Implements {@link EmulatorStart} for the Firestore emulator.
 * This first merges the Firestore security rules into a single file, and uses this file to configure the emulator.
 */
export class EmulatorStartForFirestore extends EmulatorStart {
  async _call(context: WorkspaceContext): Promise<EmulatorStartResult> {
    const configuration = await this.startFirestore(context);

    return { name: FIRESTORE_EMULATOR_NAME, configuration };
  }

  _supports(): boolean {
    return this.name === undefined || this.name === FIRESTORE_EMULATOR_NAME;
  }

  /**
   * Merges the Firestore security rules into a single file, and starts the Firestore emulator using them.
   *
   * @param context The {@link WorkspaceContext}.
   * @returns The configuration for the Firestore emulator.
   */
  private async startFirestore(
    context: WorkspaceContext,
  ): Promise<Record<string, string>> {
    if (this.dryRun) {
      return {};
    }

    const { securityRuleFile } = await context.call(
      GoogleFirestoreMergeRules,
      {},
    );

    context.logger.info('🗃️ Starting Firestore emulator.');

    const containerName = getFirestoreContainerName(context);

    const gcloudEmulatorService = context.service(GcloudEmulatorService);
    await gcloudEmulatorService.start(
      'firestore',
      containerName,
      [
        {
          host: '127.0.0.1',
          local: FIRESTORE_PORT,
          container: FIRESTORE_PORT,
        },
      ],
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
        availabilityEndpoint: `http://127.0.0.1:${FIRESTORE_PORT}/`,
      },
    );

    context.logger.info('🗃️ Successfully initialized Firestore emulator.');

    return {
      FIRESTORE_EMULATOR_HOST: `127.0.0.1:${FIRESTORE_PORT}`,
      GOOGLE_CLOUD_PROJECT: gcloudEmulatorService.localGcpProject,
      GCP_PROJECT: gcloudEmulatorService.localGcpProject,
      GCLOUD_PROJECT: gcloudEmulatorService.localGcpProject,
      FIREBASE_CONFIG: '{}',
    };
  }
}

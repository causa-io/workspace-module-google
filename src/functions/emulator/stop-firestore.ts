import { WorkspaceContext } from '@causa/workspace';
import { EmulatorStop } from '@causa/workspace-core';
import { DockerEmulatorService } from '@causa/workspace-core/services';
import {
  FIRESTORE_EMULATOR_NAME,
  getFirestoreContainerName,
} from '../../emulators/index.js';

/**
 * Implements {@link EmulatorStop} for the Firestore emulator.
 */
export class EmulatorStopForFirestore extends EmulatorStop {
  async _call(context: WorkspaceContext): Promise<string> {
    const containerName = getFirestoreContainerName(context);

    context.logger.info('️🗃️ Stopping Firestore emulator.');

    await context.service(DockerEmulatorService).stop(containerName);

    context.logger.info('️🗃️ Successfully stopped Firestore emulator.');

    return FIRESTORE_EMULATOR_NAME;
  }

  _supports(): boolean {
    return this.name === undefined || this.name === FIRESTORE_EMULATOR_NAME;
  }
}

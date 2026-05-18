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
  async _call(): Promise<string> {
    const containerName = getFirestoreContainerName(this._context);

    this._context.logger.info('️🗃️ Stopping Firestore emulator.');

    await this._context.service(DockerEmulatorService).stop(containerName);

    this._context.logger.info('️🗃️ Successfully stopped Firestore emulator.');

    return FIRESTORE_EMULATOR_NAME;
  }

  _supports(): boolean {
    return this.name === undefined || this.name === FIRESTORE_EMULATOR_NAME;
  }
}

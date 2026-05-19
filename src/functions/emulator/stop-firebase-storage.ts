import { EmulatorStop } from '@causa/workspace-core';
import { DockerEmulatorService } from '@causa/workspace-core/services';
import {
  FIREBASE_STORAGE_EMULATOR_NAME,
  getFirebaseStorageContainerName,
} from '../../emulators/index.js';

/**
 * Implements {@link EmulatorStop} for the Firebase Storage emulator.
 */
export class EmulatorStopForFirebaseStorage extends EmulatorStop {
  async _call(): Promise<string> {
    const containerName = getFirebaseStorageContainerName(this._context);

    this._context.logger.info('️🍱 Stopping Firebase Storage emulator.');

    await this._context.service(DockerEmulatorService).stop(containerName);

    this._context.logger.info(
      '️🍱 Successfully stopped Firebase Storage emulator.',
    );

    return FIREBASE_STORAGE_EMULATOR_NAME;
  }

  _supports(): boolean {
    return (
      this.name === undefined || this.name === FIREBASE_STORAGE_EMULATOR_NAME
    );
  }
}

import { WorkspaceContext } from '@causa/workspace';
import { DockerEmulatorService, EmulatorStop } from '@causa/workspace-core';
import {
  FIREBASE_STORAGE_EMULATOR_NAME,
  getFirebaseStorageContainerName,
} from '../../emulators/index.js';

/**
 * Implements {@link EmulatorStop} for the Firebase Storage emulator.
 */
export class EmulatorStopForFirebaseStorage extends EmulatorStop {
  async _call(context: WorkspaceContext): Promise<string> {
    const containerName = getFirebaseStorageContainerName(context);

    context.logger.info('️🍱 Stopping Firebase Storage emulator.');

    await context.service(DockerEmulatorService).stop(containerName);

    context.logger.info('️🍱 Successfully stopped Firebase Storage emulator.');

    return FIREBASE_STORAGE_EMULATOR_NAME;
  }

  _supports(): boolean {
    return (
      this.name === undefined || this.name === FIREBASE_STORAGE_EMULATOR_NAME
    );
  }
}

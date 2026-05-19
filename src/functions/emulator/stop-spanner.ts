import { EmulatorStop } from '@causa/workspace-core';
import { DockerEmulatorService } from '@causa/workspace-core/services';
import {
  SPANNER_EMULATOR_NAME,
  getSpannerContainerName,
} from '../../emulators/index.js';

/**
 * Implements {@link EmulatorStop} for the Spanner emulator.
 */
export class EmulatorStopForSpanner extends EmulatorStop {
  async _call(): Promise<string> {
    const containerName = getSpannerContainerName(this._context);

    this._context.logger.info('️️🗃️ Stopping Spanner emulator.');

    await this._context.service(DockerEmulatorService).stop(containerName);

    this._context.logger.info('️🗃️ Successfully stopped Spanner emulator.');

    return SPANNER_EMULATOR_NAME;
  }

  _supports(): boolean {
    return this.name === undefined || this.name === SPANNER_EMULATOR_NAME;
  }
}

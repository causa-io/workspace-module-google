import { WorkspaceContext } from '@causa/workspace';
import { DockerEmulatorService, EmulatorStop } from '@causa/workspace-core';
import {
  SPANNER_EMULATOR_NAME,
  getSpannerContainerName,
} from '../emulators/index.js';

/**
 * Implements {@link EmulatorStop} for the Spanner emulator.
 */
export class EmulatorStopForSpanner extends EmulatorStop {
  async _call(context: WorkspaceContext): Promise<string> {
    const containerName = getSpannerContainerName(context);

    context.logger.info('️️🗃️ Stopping Spanner emulator.');

    await context.service(DockerEmulatorService).stop(containerName);

    context.logger.info('️🗃️ Successfully stopped Spanner emulator.');

    return SPANNER_EMULATOR_NAME;
  }

  _supports(): boolean {
    return this.name === undefined || this.name === SPANNER_EMULATOR_NAME;
  }
}

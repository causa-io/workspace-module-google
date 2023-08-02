import { WorkspaceContext } from '@causa/workspace';
import { DockerEmulatorService, EmulatorStop } from '@causa/workspace-core';
import {
  IDENTITY_PLATFORM_EMULATOR_NAME,
  getIdentityPlatformContainerName,
} from '../../emulators/index.js';

/**
 * Implements {@link EmulatorStop} for the Identity Platform emulator.
 */
export class EmulatorStopForIdentityPlatform extends EmulatorStop {
  async _call(context: WorkspaceContext): Promise<string> {
    const containerName = getIdentityPlatformContainerName(context);

    context.logger.info('️🛂 Stopping Identity Platform emulator.');

    await context.service(DockerEmulatorService).stop(containerName);

    context.logger.info('🛂 Successfully stopped Identity Platform emulator.');

    return IDENTITY_PLATFORM_EMULATOR_NAME;
  }

  _supports(): boolean {
    return (
      this.name === undefined || this.name === IDENTITY_PLATFORM_EMULATOR_NAME
    );
  }
}

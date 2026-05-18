import { EmulatorStop } from '@causa/workspace-core';
import { DockerEmulatorService } from '@causa/workspace-core/services';
import {
  IDENTITY_PLATFORM_EMULATOR_NAME,
  getIdentityPlatformContainerName,
} from '../../emulators/index.js';

/**
 * Implements {@link EmulatorStop} for the Identity Platform emulator.
 */
export class EmulatorStopForIdentityPlatform extends EmulatorStop {
  async _call(): Promise<string> {
    const containerName = getIdentityPlatformContainerName(this._context);

    this._context.logger.info('️🛂 Stopping Identity Platform emulator.');

    await this._context.service(DockerEmulatorService).stop(containerName);

    this._context.logger.info(
      '🛂 Successfully stopped Identity Platform emulator.',
    );

    return IDENTITY_PLATFORM_EMULATOR_NAME;
  }

  _supports(): boolean {
    return (
      this.name === undefined || this.name === IDENTITY_PLATFORM_EMULATOR_NAME
    );
  }
}

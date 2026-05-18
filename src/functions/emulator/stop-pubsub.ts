import { EmulatorStop } from '@causa/workspace-core';
import { DockerEmulatorService } from '@causa/workspace-core/services';
import {
  PUBSUB_EMULATOR_NAME,
  getPubSubContainerName,
} from '../../emulators/index.js';

/**
 * Implements {@link EmulatorStop} for the Pub/Sub emulator.
 */
export class EmulatorStopForPubSub extends EmulatorStop {
  async _call(): Promise<string> {
    const containerName = getPubSubContainerName(this._context);

    this._context.logger.info('️📫 Stopping Pub/Sub emulator.');

    await this._context.service(DockerEmulatorService).stop(containerName);

    this._context.logger.info('📫 Successfully stopped Pub/Sub emulator.');

    return PUBSUB_EMULATOR_NAME;
  }

  _supports(): boolean {
    return this.name === undefined || this.name === PUBSUB_EMULATOR_NAME;
  }
}

import { WorkspaceContext } from '@causa/workspace';
import { DockerEmulatorService, EmulatorStop } from '@causa/workspace-core';
import {
  PUBSUB_EMULATOR_NAME,
  getPubSubContainerName,
} from '../emulators/index.js';

/**
 * Implements {@link EmulatorStop} for the Pub/Sub emulator.
 */
export class EmulatorStopForPubSub extends EmulatorStop {
  async _call(context: WorkspaceContext): Promise<string> {
    const containerName = getPubSubContainerName(context);

    context.logger.info('️📫 Stopping Pub/Sub emulator.');

    await context.service(DockerEmulatorService).stop(containerName);

    context.logger.info('📫 Successfully stopped Pub/Sub emulator.');

    return PUBSUB_EMULATOR_NAME;
  }

  _supports(): boolean {
    return this.name === undefined || this.name === PUBSUB_EMULATOR_NAME;
  }
}

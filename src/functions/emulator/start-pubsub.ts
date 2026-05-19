import { callDeferred } from '@causa/workspace';
import { EmulatorStart, type EmulatorStartResult } from '@causa/workspace-core';
import { PUBSUB_EMULATOR_NAME } from '../../emulators/index.js';

/**
 * Implements {@link EmulatorStart} for the Pub/Sub emulator.
 * This first starts the Pub/Sub emulator, and then creates the topics defined in the workspace (if the workspace is
 * configured with Pub/Sub as its event broker).
 */
export class EmulatorStartForPubSub extends EmulatorStart {
  async _call(): Promise<EmulatorStartResult> {
    return await callDeferred(this, import.meta.url);
  }

  _supports(): boolean {
    return this.name === undefined || this.name === PUBSUB_EMULATOR_NAME;
  }
}

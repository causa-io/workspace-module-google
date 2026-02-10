import { callDeferred, WorkspaceContext } from '@causa/workspace';
import { EmulatorStart, type EmulatorStartResult } from '@causa/workspace-core';
import { SPANNER_EMULATOR_NAME } from '../../emulators/index.js';

/**
 * Implements {@link EmulatorStart} for the Spanner emulator.
 * This starts the emulator, creates a local instance, and creates the databases using the DDLs found in the workspace.
 */
export class EmulatorStartForSpanner extends EmulatorStart {
  async _call(context: WorkspaceContext): Promise<EmulatorStartResult> {
    return await callDeferred(this, context, import.meta.url);
  }

  _supports(): boolean {
    return this.name === undefined || this.name === SPANNER_EMULATOR_NAME;
  }
}

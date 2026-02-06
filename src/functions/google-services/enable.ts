import { CliCommand } from '@causa/cli';
import {
  callDeferred,
  WorkspaceContext,
  WorkspaceFunction,
} from '@causa/workspace';
import type { InfrastructureProcessor } from '@causa/workspace-core';
import { AllowMissing } from '@causa/workspace/validation';
import { IsBoolean } from 'class-validator';
import { googleCommandDefinition } from '../../cli/index.js';
import type { GoogleConfiguration } from '../../configurations/index.js';

/**
 * The return value of {@link GoogleServicesEnable}.
 */
type GoogleServicesEnableResult = {
  /**
   * The configuration that should be merged into the workspace configuration.
   * In case `google.services` was already set, this will be an empty object to avoid duplicates due to the merging
   * strategy.
   */
  configuration: GoogleConfiguration;

  /**
   * The list of services that were enabled.
   * This is empty during teardown.
   */
  services: string[];
};

/**
 * Enables GCP services defined in `google.services` for the GCP project defined in `google.project`.
 */
@CliCommand({
  parent: googleCommandDefinition,
  name: 'enableServices',
  description: `Enables the GCP services used by the current project.
Required GCP services should be defined in the 'google.services' configuration.
They will be enabled in the 'google.project' GCP project.`,
  summary: 'Enables the GCP services used by the current project.',
  outputFn: ({ services }) => console.log(services.join('\n')),
})
export class GoogleServicesEnable
  extends WorkspaceFunction<Promise<GoogleServicesEnableResult>>
  implements InfrastructureProcessor
{
  @IsBoolean()
  @AllowMissing()
  readonly tearDown?: boolean;

  async _call(context: WorkspaceContext): Promise<GoogleServicesEnableResult> {
    return await callDeferred(this, context, import.meta.url);
  }

  _supports(): boolean {
    return true;
  }
}

import { CliCommand } from '@causa/cli';
import { WorkspaceContext, WorkspaceFunction } from '@causa/workspace';
import { InfrastructureProcessor } from '@causa/workspace-core';
import { AllowMissing } from '@causa/workspace/validation';
import { ServiceUsageClient } from '@google-cloud/service-usage';
import { IsBoolean } from 'class-validator';
import { googleCommandDefinition } from '../../cli/index.js';
import { GoogleConfiguration } from '../../configurations/index.js';

/**
 * The maximum number of GCP services that can be enabled at the same time.
 */
const MAX_SERVICE_BATCH = 20;

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
    if (this.tearDown) {
      return { configuration: {}, services: [] };
    }

    const googleConf = context.asConfiguration<GoogleConfiguration>();
    const gcpProject = googleConf.getOrThrow('google.project');
    const services = googleConf.get('google.services');
    if (!services) {
      // Although not very useful, this ensures the services configuration is set after the processor has run.
      return { configuration: { google: { services: [] } }, services: [] };
    }

    // There is little chance the client would be reused, so it is not cached or exposed as a service.
    const serviceUsageClient = new ServiceUsageClient();
    const servicesToEnable = [...services];
    const parent = `projects/${gcpProject}`;
    while (servicesToEnable.length > 0) {
      const serviceIds = servicesToEnable.splice(0, MAX_SERVICE_BATCH);
      context.logger.info(
        `➕ Enabling GCP service(s) ${serviceIds
          .map((s) => `'${s}'`)
          .join(', ')} in project '${gcpProject}'.`,
      );

      const [operation] = await serviceUsageClient.batchEnableServices({
        parent,
        serviceIds,
      });
      await operation.promise();
    }

    // If `google.services` was already set, returning it would duplicate the list due to the configuration merging
    // strategy (concatenating arrays).
    return { configuration: {}, services };
  }

  _supports(): boolean {
    return true;
  }
}

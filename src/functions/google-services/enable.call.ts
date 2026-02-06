import type { WorkspaceContext } from '@causa/workspace';
import { ServiceUsageClient } from '@google-cloud/service-usage';
import type { GoogleConfiguration } from '../../configurations/index.js';
import type { GoogleServicesEnable } from './enable.js';

/**
 * The maximum number of GCP services that can be enabled at the same time.
 */
const MAX_SERVICE_BATCH = 20;

export default async function call(
  this: GoogleServicesEnable,
  context: WorkspaceContext,
): Promise<{
  configuration: GoogleConfiguration;
  services: string[];
}> {
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

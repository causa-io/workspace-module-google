import type {
  GraphEnvironmentFetcher,
  GraphEnvironmentNodeOutput,
  GraphWarning,
} from '@causa/workspace-core';
import {
  ServiceDeploymentStatus,
  type ServiceDeployment,
} from '@causa/workspace-core';
import type { protos } from '@google-cloud/run';
import { googleResources } from '../resources.js';

type Service = protos.google.cloud.run.v2.IService;

/**
 * The deployment status for each state of the `Ready` terminal condition of a Cloud Run service.
 * States are listed both by name and by number, as clients may return either.
 */
const DEPLOYMENT_STATUSES: Record<string, ServiceDeploymentStatus> = {
  CONDITION_PENDING: ServiceDeploymentStatus.Deploying,
  1: ServiceDeploymentStatus.Deploying,
  CONDITION_RECONCILING: ServiceDeploymentStatus.Deploying,
  2: ServiceDeploymentStatus.Deploying,
  CONDITION_FAILED: ServiceDeploymentStatus.Failed,
  3: ServiceDeploymentStatus.Failed,
  CONDITION_SUCCEEDED: ServiceDeploymentStatus.Deployed,
  4: ServiceDeploymentStatus.Deployed,
};

/**
 * Returns what is deployed for a Cloud Run service.
 *
 * @param service The Cloud Run service.
 * @returns The deployment.
 */
function toDeployment(service: Service): ServiceDeployment {
  const image = service.template?.containers?.[0]?.image ?? undefined;
  const updateSeconds = service.updateTime?.seconds;
  const updatedAt = updateSeconds
    ? new Date(Number(updateSeconds.toString()) * 1000)
    : undefined;
  const { state, message } = service.terminalCondition ?? {};
  const status = state ? DEPLOYMENT_STATUSES[state] : undefined;
  return {
    ...(image ? { image } : {}),
    ...(updatedAt ? { updatedAt } : {}),
    ...(status ? { status } : {}),
    ...(status && message ? { message } : {}),
  };
}

/**
 * Reads the deployments of Cloud Run services.
 */
export const googleCloudRun: GraphEnvironmentFetcher = {
  name: 'googleCloudRun',
  description:
    'The `deployment` of services deployed on Cloud Run: the container image, the last update time, and the status of the latest deployment from the `Ready` condition. The deployment is the current one, with a warning when the service was updated after the end of the evaluation window.',
  fetch: async (environment) => {
    const services = googleResources(
      environment,
      'run.googleapis.com/Service',
      'service',
    );
    if (services.length === 0) {
      return {};
    }

    const { CloudRunService } = await import('../../../services/cloud-run.js');
    const { servicesClient } = environment.context.service(CloudRunService);
    // Calls on a gax client crash the process when credentials cannot be loaded, while `initialize` rejects.
    await servicesClient.initialize();
    const byLocation = Map.groupBy(
      services,
      ({ segments }) =>
        `projects/${segments.projects}/locations/${segments.locations}`,
    );

    const nodes: Record<string, GraphEnvironmentNodeOutput> = {};
    const warnings: GraphWarning[] = [];
    await Promise.all(
      [...byLocation].map(async ([parent, serviceNodes]) => {
        let deployed: Service[];
        try {
          [deployed] = await servicesClient.listServices({ parent });
        } catch (error: any) {
          warnings.push({
            message: `Failed to list the Cloud Run services in '${parent}': ${error.message ?? error}`,
          });
          return;
        }

        const byName = new Map(deployed.map((s) => [s.name, s]));
        for (const { node, name } of serviceNodes) {
          const service = byName.get(name);
          if (!service) {
            warnings.push({
              message: `The Cloud Run service '${name}' of '${node.id}' does not exist.`,
            });
            continue;
          }

          const deployment = toDeployment(service);
          const { updatedAt } = deployment;
          if (updatedAt && updatedAt > environment.at) {
            warnings.push({
              message: `The Cloud Run service '${name}' of '${node.id}' was updated at ${updatedAt.toISOString()}, after the end of the evaluation window. Its deployment is the current one.`,
            });
          }

          nodes[node.id] = { data: { deployment } };
        }
      }),
    );

    return { nodes, warnings };
  },
};

import type { WorkspaceContext } from '@causa/workspace';
import type {
  EventTopicBrokerTrigger,
  ServiceContainerConfiguration,
} from '@causa/workspace-core';
import type { GoogleConfiguration } from '../../configurations/index.js';
import { CloudRunPubSubTriggerService } from '../../services/cloud-run-pubsub-trigger.js';
import {
  CLOUD_RUN_TRIGGER_ID_REGEX,
  type EventTopicBrokerCreateTriggerForCloudRun,
} from './broker-create-trigger-cloud-run.js';

/**
 * A trigger resolved as a Cloud Run service ID and path to call.
 */
type ResolvedTrigger = {
  /**
   * The Cloud Run service ID, in the format `projects/<projectId>/locations/<location>/services/<serviceName>`.
   */
  serviceId: string;

  /**
   * The HTTP path to call on the Cloud Run service, including any query parameters.
   */
  path: string;
};

/**
 * Resolves the Cloud Run service ID and HTTP path for a raw URI trigger string.
 */
function resolveFromString(
  context: WorkspaceContext,
  trigger: string,
): ResolvedTrigger {
  const match = trigger.match(CLOUD_RUN_TRIGGER_ID_REGEX);
  if (!match?.groups) {
    throw new Error(`Invalid Cloud Run trigger '${trigger}'.`);
  }

  const googleConf = context.asConfiguration<GoogleConfiguration>();
  const projectId =
    match.groups.projectId ?? googleConf.getOrThrow('google.project');
  const location =
    match.groups.location ?? googleConf.getOrThrow('google.cloudRun.location');

  return {
    serviceId: `projects/${projectId}/locations/${location}/services/${match.groups.name}`,
    path: match.groups.path,
  };
}

/**
 * Resolves the Cloud Run service ID and HTTP path for a project-scoped trigger object.
 * The project is expected to be a `serviceContainer` deployed on Cloud Run. The service name defaults to the project's
 * name, and is overridden by `google.cloudRun.eventBackfillServiceName` when set. The trigger path is read from
 * `serviceContainer.triggers[name].endpoint`, which must be of type `http`. Options are serialized as a URL query
 * string.
 *
 * @param context The {@link WorkspaceContext}.
 * @param trigger The trigger object.
 * @returns The resolved service ID and path.
 */
function resolveFromObject(
  context: WorkspaceContext,
  trigger: EventTopicBrokerTrigger,
): ResolvedTrigger {
  const conf = context.asConfiguration<
    GoogleConfiguration & ServiceContainerConfiguration
  >();
  const projectId = conf.getOrThrow('google.project');
  const location = conf.getOrThrow('google.cloudRun.location');
  const serviceName =
    conf.get('google.cloudRun.eventBackfillServiceName') ??
    conf.getOrThrow('project.name');

  const endpoint = conf.get(
    `serviceContainer.triggers.${trigger.name}.endpoint`,
  );
  if (!endpoint || endpoint.type !== 'http' || !endpoint.path) {
    throw new Error(
      `Trigger '${trigger.name}' does not exist or does not define an HTTP endpoint.`,
    );
  }

  const query = new URLSearchParams(trigger.options).toString();
  const path = query ? `${endpoint.path}?${query}` : endpoint.path;

  return {
    serviceId: `projects/${projectId}/locations/${location}/services/${serviceName}`,
    path,
  };
}

export default async function call(
  this: EventTopicBrokerCreateTriggerForCloudRun,
  context: WorkspaceContext,
): Promise<string[]> {
  const { serviceId, path } =
    typeof this.trigger === 'string'
      ? resolveFromString(context, this.trigger)
      : resolveFromObject(context, this.trigger);

  return await context
    .service(CloudRunPubSubTriggerService)
    .create(this.backfillId, this.topicId, serviceId, path);
}

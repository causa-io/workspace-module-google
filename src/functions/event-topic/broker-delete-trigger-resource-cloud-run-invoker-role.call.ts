import type { WorkspaceContext } from '@causa/workspace';
import { CloudRunService } from '../../services/cloud-run.js';
import type { EventTopicBrokerDeleteTriggerResourceForCloudRunInvokerRole } from './broker-delete-trigger-resource-cloud-run-invoker-role.js';

/**
 * The regular expression that matches a resource ID representing a Cloud Run invoker role for a given service account.
 */
const CLOUD_RUN_INVOKER_ID_REGEX =
  /^(?<serviceId>projects\/[\w-]+\/locations\/[\w-]+\/services\/[\w-]+)\/invokerBindings\/(?<pubSubServiceAccount>.+)$/;

export default async function call(
  this: EventTopicBrokerDeleteTriggerResourceForCloudRunInvokerRole,
  context: WorkspaceContext,
): Promise<void> {
  const match = this.id.match(CLOUD_RUN_INVOKER_ID_REGEX);
  if (!match?.groups) {
    throw new Error('Invalid Cloud Run invoker binding resource ID.');
  }

  const { serviceId, pubSubServiceAccount } = match.groups;
  context.logger.info(
    `🛂 Removing invoker role on Cloud Run service '${serviceId}' for Pub/Sub service account '${pubSubServiceAccount}'.`,
  );

  await context
    .service(CloudRunService)
    .removeInvokerBinding(serviceId, pubSubServiceAccount);
}

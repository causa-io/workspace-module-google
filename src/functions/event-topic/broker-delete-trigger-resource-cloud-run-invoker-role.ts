import { WorkspaceContext } from '@causa/workspace';
import {
  EventTopicBrokerDeleteTriggerResource,
  EventsConfiguration,
} from '@causa/workspace-core';
import { CloudRunService } from '../../services/index.js';

/**
 * The regular expression that matches a resource ID representing a Cloud Run invoker role for a given service account.
 */
const CLOUD_RUN_INVOKER_ID_REGEX =
  /^(?<serviceId>projects\/[\w-]+\/locations\/[\w-]+\/services\/[\w-]+)\/invokerBindings\/(?<pubSubServiceAccount>.+)$/;

/**
 * Implements {@link EventTopicBrokerDeleteTriggerResource} for Cloud Run invoker roles.
 * When setting up a Pub/Sub trigger for a Cloud Run service, a new binding is added to the Cloud Run service, allowing
 * a dedicated service account to invoke the service. This function removes that binding.
 */
export class EventTopicBrokerDeleteTriggerResourceForCloudRunInvokerRole extends EventTopicBrokerDeleteTriggerResource {
  async _call(context: WorkspaceContext): Promise<void> {
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

  _supports(context: WorkspaceContext): boolean {
    return (
      this.id.match(CLOUD_RUN_INVOKER_ID_REGEX) != null &&
      context.asConfiguration<EventsConfiguration>().get('events.broker') ===
        'google.pubSub'
    );
  }
}

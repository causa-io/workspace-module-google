import { callDeferred } from '@causa/workspace';
import {
  EventTopicBrokerDeleteTriggerResource,
  type EventsConfiguration,
} from '@causa/workspace-core';

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
  async _call(): Promise<void> {
    return await callDeferred(this, import.meta.url);
  }

  _supports(): boolean {
    return (
      this.id.match(CLOUD_RUN_INVOKER_ID_REGEX) != null &&
      this._context
        .asConfiguration<EventsConfiguration>()
        .get('events.broker') === 'google.pubSub'
    );
  }
}

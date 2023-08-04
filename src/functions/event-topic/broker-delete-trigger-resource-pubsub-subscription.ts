import { WorkspaceContext } from '@causa/workspace';
import {
  EventTopicBrokerDeleteTriggerResource,
  EventsConfiguration,
} from '@causa/workspace-core';
import { status } from '@grpc/grpc-js';
import { PubSubService } from '../../services/index.js';

/**
 * Implements {@link EventTopicBrokerDeleteTriggerResource} for Pub/Sub subscriptions.
 * Pub/Sub subscriptions are for example used when creating Cloud Run triggers.
 */
export class EventTopicBrokerDeleteTriggerResourceForPubSubSubscription extends EventTopicBrokerDeleteTriggerResource {
  async _call(context: WorkspaceContext): Promise<void> {
    context.logger.info(`📫 Deleting Pub/Sub subscription '${this.id}'.`);

    try {
      await context
        .service(PubSubService)
        .pubSub.subscription(this.id)
        .delete();
    } catch (error: any) {
      if (error.code === status.NOT_FOUND) {
        context.logger.warn(
          `⚠️ Pub/Sub subscription '${this.id}' does not exist. It might have already been deleted.`,
        );
      } else {
        throw error;
      }
    }
  }

  _supports(context: WorkspaceContext): boolean {
    return (
      this.id.match(/^projects\/[\w-]+\/subscriptions\/[\w-]+$/) != null &&
      context.asConfiguration<EventsConfiguration>().get('events.broker') ===
        'google.pubSub'
    );
  }
}

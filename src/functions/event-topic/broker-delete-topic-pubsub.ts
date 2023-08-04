import { WorkspaceContext } from '@causa/workspace';
import {
  EventTopicBrokerDeleteTopic,
  EventsConfiguration,
} from '@causa/workspace-core';
import { status } from '@grpc/grpc-js';
import { PubSubService } from '../../services/index.js';

/**
 * Implements {@link EventTopicBrokerDeleteTopic} for Pub/Sub.
 * The `id` argument should be a full Pub/Sub topic ID, e.g. `projects/<projectId>/topics/<topicId>`.
 */
export class EventTopicBrokerDeleteTopicForPubSub extends EventTopicBrokerDeleteTopic {
  async _call(context: WorkspaceContext): Promise<void> {
    context.logger.info(`📫 Deleting Pub/Sub topic '${this.id}'.`);

    try {
      await context.service(PubSubService).pubSub.topic(this.id).delete();
    } catch (error: any) {
      if (error.code === status.NOT_FOUND) {
        context.logger.warn(
          `⚠️ Pub/Sub topic to delete '${this.id}' does not exist. It might have already been deleted.`,
        );
        return;
      }

      throw error;
    }
  }

  _supports(context: WorkspaceContext): boolean {
    return (
      context.asConfiguration<EventsConfiguration>().get('events.broker') ===
      'google.pubSub'
    );
  }
}

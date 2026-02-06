import type { WorkspaceContext } from '@causa/workspace';
import { grpc } from 'google-gax';
import { PubSubService } from '../../services/pubsub.js';
import type { EventTopicBrokerDeleteTriggerResourceForPubSubSubscription } from './broker-delete-trigger-resource-pubsub-subscription.js';

export default async function call(
  this: EventTopicBrokerDeleteTriggerResourceForPubSubSubscription,
  context: WorkspaceContext,
): Promise<void> {
  context.logger.info(`📫 Deleting Pub/Sub subscription '${this.id}'.`);

  try {
    await context
      .service(PubSubService)
      .pubSub.subscription(this.id)
      .delete();
  } catch (error: any) {
    if (error.code === grpc.status.NOT_FOUND) {
      context.logger.warn(
        `⚠️ Pub/Sub subscription '${this.id}' does not exist. It might have already been deleted.`,
      );
    } else {
      throw error;
    }
  }
}

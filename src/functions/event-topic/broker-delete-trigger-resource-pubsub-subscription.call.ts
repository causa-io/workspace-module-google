import { grpc } from 'google-gax';
import { PubSubService } from '../../services/pubsub.js';
import type { EventTopicBrokerDeleteTriggerResourceForPubSubSubscription } from './broker-delete-trigger-resource-pubsub-subscription.js';

export default async function call(
  this: EventTopicBrokerDeleteTriggerResourceForPubSubSubscription,
): Promise<void> {
  this._context.logger.info(`📫 Deleting Pub/Sub subscription '${this.id}'.`);

  try {
    await this._context
      .service(PubSubService)
      .pubSub.subscription(this.id)
      .delete();
  } catch (error: any) {
    if (error.code === grpc.status.NOT_FOUND) {
      this._context.logger.warn(
        `⚠️ Pub/Sub subscription '${this.id}' does not exist. It might have already been deleted.`,
      );
    } else {
      throw error;
    }
  }
}

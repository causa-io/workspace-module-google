import { grpc } from 'google-gax';
import { PubSubService } from '../../services/pubsub.js';
import type { EventTopicBrokerDeleteTopicForPubSub } from './broker-delete-topic-pubsub.js';

export default async function call(
  this: EventTopicBrokerDeleteTopicForPubSub,
): Promise<void> {
  this._context.logger.info(`📫 Deleting Pub/Sub topic '${this.id}'.`);

  try {
    await this._context.service(PubSubService).pubSub.topic(this.id).delete();
  } catch (error: any) {
    if (error.code === grpc.status.NOT_FOUND) {
      this._context.logger.warn(
        `⚠️ Pub/Sub topic to delete '${this.id}' does not exist. It might have already been deleted.`,
      );
      return;
    }

    throw error;
  }
}

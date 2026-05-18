import { IamService } from '../../services/iam.js';
import type { EventTopicBrokerDeleteTriggerResourceForServiceAccount } from './broker-delete-trigger-resource-service-account.js';

export default async function call(
  this: EventTopicBrokerDeleteTriggerResourceForServiceAccount,
): Promise<void> {
  this._context.logger.info(
    `🛂 Deleting Pub/Sub backfilling service account '${this.id}'.`,
  );

  try {
    await this._context.service(IamService).deleteServiceAccount(this.id);
  } catch (error: any) {
    if (error.code === 404) {
      this._context.logger.warn(
        `⚠️ Pub/Sub backfilling service account '${this.id}' does not exist. It might have already been deleted.`,
      );
    } else {
      throw error;
    }
  }
}

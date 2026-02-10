import type { WorkspaceContext } from '@causa/workspace';
import { IamService } from '../../services/iam.js';
import type { EventTopicBrokerDeleteTriggerResourceForServiceAccount } from './broker-delete-trigger-resource-service-account.js';

export default async function call(
  this: EventTopicBrokerDeleteTriggerResourceForServiceAccount,
  context: WorkspaceContext,
): Promise<void> {
  context.logger.info(
    `🛂 Deleting Pub/Sub backfilling service account '${this.id}'.`,
  );

  try {
    await context.service(IamService).deleteServiceAccount(this.id);
  } catch (error: any) {
    if (error.code === 404) {
      context.logger.warn(
        `⚠️ Pub/Sub backfilling service account '${this.id}' does not exist. It might have already been deleted.`,
      );
    } else {
      throw error;
    }
  }
}

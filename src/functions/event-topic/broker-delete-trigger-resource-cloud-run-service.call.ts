import { CloudRunService } from '../../services/cloud-run.js';
import type { EventTopicBrokerDeleteTriggerResourceForCloudRunService } from './broker-delete-trigger-resource-cloud-run-service.js';

export default async function call(
  this: EventTopicBrokerDeleteTriggerResourceForCloudRunService,
): Promise<void> {
  this._context.logger.info(
    `🚀 Deleting temporary Cloud Run service '${this.id}'.`,
  );

  await this._context.service(CloudRunService).delete(this.id);
}

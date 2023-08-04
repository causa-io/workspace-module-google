import { WorkspaceContext } from '@causa/workspace';
import {
  EventTopicBrokerDeleteTriggerResource,
  EventsConfiguration,
} from '@causa/workspace-core';
import { IamService } from '../../services/index.js';

/**
 * Implements {@link EventTopicBrokerDeleteTriggerResource} for GCP service accounts.
 * Service accounts are used by Pub/Sub push subscriptions to authenticate requests when pushing messages (e.g. to Cloud
 * Run services).
 */
export class EventTopicBrokerDeleteTriggerResourceForServiceAccount extends EventTopicBrokerDeleteTriggerResource {
  async _call(context: WorkspaceContext): Promise<void> {
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

  _supports(context: WorkspaceContext): boolean {
    return (
      this.id.match(/^projects\/[\w-]+\/serviceAccounts\/[^/]+$/) != null &&
      context.asConfiguration<EventsConfiguration>().get('events.broker') ===
        'google.pubSub'
    );
  }
}

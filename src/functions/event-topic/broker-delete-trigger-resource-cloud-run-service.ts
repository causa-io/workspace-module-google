import { callDeferred } from '@causa/workspace';
import {
  EventTopicBrokerDeleteTriggerResource,
  type EventsConfiguration,
} from '@causa/workspace-core';
import { CLOUD_RUN_SERVICE_ID_REGEX } from '../../services/cloud-run.utils.js';

/**
 * Implements {@link EventTopicBrokerDeleteTriggerResource} for Cloud Run services.
 * When `google.cloudRun.eventBackfillServiceCloneConfig` is set, a temporary copy of the Cloud Run service is created
 * for each project-scoped trigger, isolating the backfill load from production. This function deletes that copy.
 */
export class EventTopicBrokerDeleteTriggerResourceForCloudRunService extends EventTopicBrokerDeleteTriggerResource {
  async _call(): Promise<void> {
    return await callDeferred(this, import.meta.url);
  }

  _supports(): boolean {
    return (
      CLOUD_RUN_SERVICE_ID_REGEX.test(this.id) &&
      this._context
        .asConfiguration<EventsConfiguration>()
        .get('events.broker') === 'google.pubSub'
    );
  }
}

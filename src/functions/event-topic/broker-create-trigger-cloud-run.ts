import { WorkspaceContext } from '@causa/workspace';
import {
  EventTopicBrokerCreateTrigger,
  type EventsConfiguration,
} from '@causa/workspace-core';
import type { GoogleConfiguration } from '../../configurations/index.js';
import { CloudRunPubSubTriggerService } from '../../services/index.js';

/**
 * The regular expression used to match Cloud Run trigger IDs, consisting of the service ID and the path to the trigger.
 * [[projects/<projectId>/]locations/<location>/]services/<name>/path-to-trigger
 */
const CLOUD_RUN_TRIGGER_ID_REGEX =
  /^(?:(?:projects\/(?<projectId>[\w-]+)\/)?locations\/(?<location>[\w-]+)\/)?services\/(?<name>[\w-]+)(?<path>\/.*)$/;

/**
 * Implements {@link EventTopicBrokerCreateTrigger} for Cloud Run endpoints being triggered by Pub/Sub messages.
 * The `id` argument should be a Cloud Run service ID, followed by the path to the trigger, e.g.
 * `[[projects/<projectId>/]locations/<location>/]services/<name>/path-to-trigger`.
 */
export class EventTopicBrokerCreateTriggerForCloudRun extends EventTopicBrokerCreateTrigger {
  async _call(context: WorkspaceContext): Promise<string[]> {
    const match = this.trigger.match(CLOUD_RUN_TRIGGER_ID_REGEX);
    if (!match?.groups) {
      throw new Error('Oops.');
    }

    const googleConf = context.asConfiguration<GoogleConfiguration>();
    const projectId =
      match.groups.projectId ?? googleConf.getOrThrow('google.project');
    const location =
      match.groups.location ??
      googleConf.getOrThrow('google.cloudRun.location');
    const name = match.groups.name;
    const path = match.groups.path;
    if (!name || !path) {
      throw new Error('Oops.');
    }

    const serviceId = `projects/${projectId}/locations/${location}/services/${name}`;

    return await context
      .service(CloudRunPubSubTriggerService)
      .create(this.backfillId, this.topicId, serviceId, path);
  }

  _supports(context: WorkspaceContext): boolean {
    return (
      this.trigger.match(CLOUD_RUN_TRIGGER_ID_REGEX) != null &&
      context.asConfiguration<EventsConfiguration>().get('events.broker') ===
        'google.pubSub'
    );
  }
}

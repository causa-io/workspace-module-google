import { callDeferred, WorkspaceContext } from '@causa/workspace';
import {
  EventTopicBrokerCreateTrigger,
  type EventsConfiguration,
} from '@causa/workspace-core';

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
    return await callDeferred(this, context, import.meta.url);
  }

  _supports(context: WorkspaceContext): boolean {
    return (
      this.trigger.match(CLOUD_RUN_TRIGGER_ID_REGEX) != null &&
      context.asConfiguration<EventsConfiguration>().get('events.broker') ===
        'google.pubSub'
    );
  }
}

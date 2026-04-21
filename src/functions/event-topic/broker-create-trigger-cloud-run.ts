import { callDeferred, WorkspaceContext } from '@causa/workspace';
import {
  EventTopicBrokerCreateTrigger,
  type EventsConfiguration,
  type ServiceContainerConfiguration,
} from '@causa/workspace-core';

/**
 * The regular expression used to match Cloud Run trigger IDs, consisting of the service ID and the path to the trigger.
 * [[projects/<projectId>/]locations/<location>/]services/<name>/path-to-trigger
 */
export const CLOUD_RUN_TRIGGER_ID_REGEX =
  /^(?:(?:projects\/(?<projectId>[\w-]+)\/)?locations\/(?<location>[\w-]+)\/)?services\/(?<name>[\w-]+)(?<path>\/.*)$/;

/**
 * Implements {@link EventTopicBrokerCreateTrigger} for Cloud Run endpoints being triggered by Pub/Sub messages.
 *
 * Two forms of trigger are supported:
 * - A string in the format `[[projects/<projectId>/]locations/<location>/]services/<name>/path-to-trigger`.
 * - An object `{ name, options }` passed when the function is called on a project-scoped context. In that case the
 *   project must be a `serviceContainer` deployed on Cloud Run. The trigger's `name` must match an entry in
 *   `serviceContainer.triggers` whose endpoint is of type `http`. Options are forwarded as URL query parameters.
 */
export class EventTopicBrokerCreateTriggerForCloudRun extends EventTopicBrokerCreateTrigger {
  async _call(context: WorkspaceContext): Promise<string[]> {
    return await callDeferred(this, context, import.meta.url);
  }

  _supports(context: WorkspaceContext): boolean {
    const isPubSub =
      context.asConfiguration<EventsConfiguration>().get('events.broker') ===
      'google.pubSub';
    if (!isPubSub) {
      return false;
    }

    if (typeof this.trigger === 'string') {
      return CLOUD_RUN_TRIGGER_ID_REGEX.test(this.trigger);
    }

    const conf = context.asConfiguration<ServiceContainerConfiguration>();
    return (
      conf.get('project.type') === 'serviceContainer' &&
      conf.get('serviceContainer.platform') === 'google.cloudRun'
    );
  }
}

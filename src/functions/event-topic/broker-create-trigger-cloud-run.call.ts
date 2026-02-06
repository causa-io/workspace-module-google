import type { WorkspaceContext } from '@causa/workspace';
import type { GoogleConfiguration } from '../../configurations/index.js';
import { CloudRunPubSubTriggerService } from '../../services/index.js';
import type { EventTopicBrokerCreateTriggerForCloudRun } from './broker-create-trigger-cloud-run.js';

/**
 * The regular expression used to match Cloud Run trigger IDs, consisting of the service ID and the path to the trigger.
 * [[projects/<projectId>/]locations/<location>/]services/<name>/path-to-trigger
 */
const CLOUD_RUN_TRIGGER_ID_REGEX =
  /^(?:(?:projects\/(?<projectId>[\w-]+)\/)?locations\/(?<location>[\w-]+)\/)?services\/(?<name>[\w-]+)(?<path>\/.*)$/;

export default async function call(
  this: EventTopicBrokerCreateTriggerForCloudRun,
  context: WorkspaceContext,
): Promise<string[]> {
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

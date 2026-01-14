import {
  type ProcessorResult,
  WorkspaceContext,
  WorkspaceFunction,
} from '@causa/workspace';
import {
  type EventTopicDefinition,
  EventTopicList,
  type InfrastructureProcessor,
} from '@causa/workspace-core';
import { CAUSA_FOLDER } from '@causa/workspace/initialization';
import { AllowMissing } from '@causa/workspace/validation';
import { IsBoolean } from 'class-validator';
import { mkdir, rm, writeFile } from 'fs/promises';
import { join } from 'path';
import type { GoogleConfiguration } from '../../configurations/index.js';

/**
 * The default directory where Pub/Sub topic configurations are written, relative to the workspace root.
 */
const DEFAULT_TOPIC_CONFIGURATIONS_DIRECTORY = join(
  CAUSA_FOLDER,
  'pubsub-topics',
);

/**
 * A single Pub/Sub topic configuration, to be written to a JSON file.
 */
type TopicConfiguration = EventTopicDefinition & {
  /**
   * The name of the BigQuery table where events for this topic are stored.
   */
  readonly bigQueryTableName: string;
};

/**
 * A function that uses {@link EventTopicList} to find all the topics in the workspace, and writes their configurations
 * to a directory.
 * The `google.pubSub.topicConfigurationsDirectory` configuration can be used to specify the output location of the
 * topic configurations.
 * This function returns a partial configuration, such that it can be used as a processor.
 */
export class GooglePubSubWriteTopics
  extends WorkspaceFunction<Promise<ProcessorResult>>
  implements InfrastructureProcessor
{
  @IsBoolean()
  @AllowMissing()
  readonly tearDown?: boolean;

  /**
   * Returns the path to the directory where Pub/Sub topic configurations should be written.
   * It is either fetched from the workspace configuration, or the default value is used.
   *
   * @param context The {@link WorkspaceContext}.
   * @returns The path to the directory where topic configurations should be written.
   */
  private getConfigurationsDirectory(context: WorkspaceContext): string {
    return (
      context
        .asConfiguration<GoogleConfiguration>()
        .get('google.pubSub.topicConfigurationsDirectory') ??
      DEFAULT_TOPIC_CONFIGURATIONS_DIRECTORY
    );
  }

  async _call(context: WorkspaceContext): Promise<ProcessorResult> {
    const topicConfigurationsDirectory =
      this.getConfigurationsDirectory(context);
    const absoluteDir = join(context.rootPath, topicConfigurationsDirectory);

    await rm(absoluteDir, { recursive: true, force: true });

    if (this.tearDown) {
      context.logger.debug(
        `📫 Tore down Pub/Sub topic configurations directory '${absoluteDir}'.`,
      );
      return { configuration: {} };
    }

    context.logger.info('️📫 Listing and writing Pub/Sub topic configurations.');

    const topics = await context.call(EventTopicList, {});

    context.logger.debug(
      `📫 Writing configurations for Pub/Sub topics: ${topics
        .map((d) => `'${d.id}'`)
        .join(', ')}.`,
    );
    await mkdir(absoluteDir, { recursive: true });
    await Promise.all(
      topics.map(async (topic) => {
        const topicConfiguration: TopicConfiguration = {
          ...topic,
          bigQueryTableName: topic.id.replace(/[-\.]/g, '_'),
        };
        const topicFile = join(absoluteDir, `${topic.id}.json`);
        await writeFile(topicFile, JSON.stringify(topicConfiguration));
      }),
    );

    context.logger.debug(
      `️📫 Wrote Pub/Sub topic configurations in '${absoluteDir}'.`,
    );

    return {
      configuration: {
        google: { pubSub: { topicConfigurationsDirectory } },
      },
    };
  }

  _supports(): boolean {
    return true;
  }
}

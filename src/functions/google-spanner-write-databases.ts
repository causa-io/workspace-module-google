import {
  ProcessorResult,
  WorkspaceContext,
  WorkspaceFunction,
} from '@causa/workspace';
import { InfrastructureProcessor } from '@causa/workspace-core';
import { CAUSA_FOLDER } from '@causa/workspace/initialization';
import { AllowMissing } from '@causa/workspace/validation';
import { IsBoolean } from 'class-validator';
import { mkdir, rm, writeFile } from 'fs/promises';
import { join } from 'path';
import { GoogleConfiguration } from '../configurations/index.js';
import { GoogleSpannerListDatabases } from './google-spanner-list-databases.js';

/**
 * The default directory where Spanner database configurations are written, relative to the workspace root.
 */
const DEFAULT_DATABASE_CONFIGURATIONS_DIRECTORY = join(
  CAUSA_FOLDER,
  'spanner-databases',
);

/**
 * A function that uses {@link GoogleSpannerListDatabases} to find all the Spanner databases in the workspace, and
 * writes their configurations to a directory.
 * The `google.spanner.databaseConfigurationsDirectory` configuration can be used to specify the output location of the
 * database configurations.
 * This function returns a partial configuration, such that it can be used as a processor.
 */
export class GoogleSpannerWriteDatabases
  extends WorkspaceFunction<Promise<ProcessorResult>>
  implements InfrastructureProcessor
{
  @IsBoolean()
  @AllowMissing()
  readonly tearDown?: boolean;

  /**
   * Returns the path to the directory where Spanner databases configurations should be written.
   * It is either fetched from the workspace configuration, or the default value is used.
   *
   * @param context The {@link WorkspaceContext}.
   * @returns The path to the directory where database configurations should be written.
   */
  private getConfigurationsDirectory(context: WorkspaceContext): string {
    return (
      context
        .asConfiguration<GoogleConfiguration>()
        .get('google.spanner.databaseConfigurationsDirectory') ??
      DEFAULT_DATABASE_CONFIGURATIONS_DIRECTORY
    );
  }

  async _call(context: WorkspaceContext): Promise<ProcessorResult> {
    const databaseConfigurationsDirectory =
      this.getConfigurationsDirectory(context);
    const absoluteDir = join(context.rootPath, databaseConfigurationsDirectory);

    await rm(absoluteDir, { recursive: true, force: true });

    if (this.tearDown) {
      context.logger.debug(
        `️🗃️ Tore down Spanner database configurations directory '${absoluteDir}'.`,
      );
      return { configuration: {} };
    }

    context.logger.info(
      '🗃️ Listing and writing Spanner database configurations.',
    );

    const databases = await context.call(GoogleSpannerListDatabases, {});

    await mkdir(absoluteDir, { recursive: true });

    context.logger.debug(
      `🗃️ Writing configurations for Spanner databases: ${databases
        .map((d) => `'${d.id}'`)
        .join(', ')}.`,
    );
    await Promise.all(
      databases.map((database) =>
        writeFile(
          join(absoluteDir, `${database.id}.json`),
          JSON.stringify(database),
        ),
      ),
    );

    context.logger.debug(
      `🗃️ Wrote Spanner database configurations in '${absoluteDir}'.`,
    );

    return {
      configuration: {
        google: { spanner: { databaseConfigurationsDirectory } },
      },
    };
  }

  _supports(): boolean {
    return true;
  }
}

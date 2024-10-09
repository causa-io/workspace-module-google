import { WorkspaceContext } from '@causa/workspace';
import {
  ArtefactAlreadyExistsError,
  ProjectPushArtefact,
  type ServerlessFunctionsConfiguration,
} from '@causa/workspace-core';
import { rm } from 'fs/promises';
import { CloudStorageService } from '../../services/index.js';

/**
 * Implements the {@link ProjectPushArtefact} function for Cloud Functions projects.
 * This copies the local archive of the Cloud Functions project to the Google Cloud Storage URI set in
 * {@link ProjectPushArtefact.destination}.
 */
export class ProjectPushArtefactForCloudFunctions extends ProjectPushArtefact {
  async _call(context: WorkspaceContext): Promise<string> {
    context.logger.info(`🚚 Pushing Cloud Functions archive to Cloud Storage.`);

    const storageService = context.service(CloudStorageService);

    const destination = storageService.getFileFromGsUri(this.destination);

    if (!this.overwrite) {
      const [exists] = await destination.exists();
      if (exists) {
        throw new ArtefactAlreadyExistsError(this.destination);
      }
    }

    await destination.bucket.upload(this.artefact, { destination });

    context.logger.info(
      `🚚 Successfully pushed archive to '${this.destination}'.`,
    );

    context.logger.debug(`🔥 Removing local artefact '${this.artefact}'.`);
    await rm(this.artefact);

    return this.destination;
  }

  _supports(context: WorkspaceContext): boolean {
    const conf = context.asConfiguration<ServerlessFunctionsConfiguration>();
    return (
      conf.get('project.type') === 'serverlessFunctions' &&
      conf.get('serverlessFunctions.platform') === 'google.cloudFunctions'
    );
  }
}

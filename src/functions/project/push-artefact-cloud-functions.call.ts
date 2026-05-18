import { ArtefactAlreadyExistsError } from '@causa/workspace-core';
import { rm } from 'fs/promises';
import { CloudStorageService } from '../../services/storage.js';
import type { ProjectPushArtefactForCloudFunctions } from './push-artefact-cloud-functions.js';

export default async function call(
  this: ProjectPushArtefactForCloudFunctions,
): Promise<string> {
  this._context.logger.info(
    `🚚 Pushing Cloud Functions archive to Cloud Storage.`,
  );

  const storageService = this._context.service(CloudStorageService);

  const destination = storageService.getFileFromGsUri(this.destination);

  if (!this.overwrite) {
    const [exists] = await destination.exists();
    if (exists) {
      throw new ArtefactAlreadyExistsError(this.destination);
    }
  }

  await destination.bucket.upload(this.artefact, { destination });

  this._context.logger.info(
    `🚚 Successfully pushed archive to '${this.destination}'.`,
  );

  this._context.logger.debug(`🔥 Removing local artefact '${this.artefact}'.`);
  await rm(this.artefact);

  return this.destination;
}

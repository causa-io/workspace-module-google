import {
  ProjectGetArtefactDestination,
  type ServerlessFunctionsConfiguration,
} from '@causa/workspace-core';
import type { GoogleConfiguration } from '../../configurations/index.js';

/**
 * Implements the {@link ProjectGetArtefactDestination} function for Cloud Functions projects.
 * Cloud Functions archives are stored in a Google Cloud Storage bucket, the destination of which must be
 * defined in the `google.cloudFunctions.artefactStorage` configuration.
 */
export class ProjectGetArtefactDestinationForCloudFunctions extends ProjectGetArtefactDestination {
  async _call(): Promise<string> {
    const projectName = this._context.getOrThrow('project.name');
    const googleConf = this._context.asConfiguration<GoogleConfiguration>();
    let bucketAndPrefix = googleConf.getOrThrow(
      'google.cloudFunctions.artefactStorage.bucket',
    );

    const archivesStoragePrefix = googleConf.get(
      'google.cloudFunctions.artefactStorage.prefix',
    );
    if (archivesStoragePrefix) {
      bucketAndPrefix += `/${archivesStoragePrefix}`;
    }

    return `gs://${bucketAndPrefix}/${projectName}/${this.tag}.zip`;
  }

  _supports(): boolean {
    const conf =
      this._context.asConfiguration<ServerlessFunctionsConfiguration>();
    return (
      conf.get('project.type') === 'serverlessFunctions' &&
      conf.get('serverlessFunctions.platform') === 'google.cloudFunctions'
    );
  }
}

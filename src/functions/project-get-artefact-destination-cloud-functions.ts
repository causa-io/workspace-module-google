import { WorkspaceContext } from '@causa/workspace';
import {
  ProjectGetArtefactDestination,
  ServerlessFunctionsConfiguration,
} from '@causa/workspace-core';

/**
 * Implements the {@link ProjectGetArtefactDestination} function for Cloud Functions projects.
 * Cloud Functions archives are stored in a Google Cloud Storage bucket, the destination of which must be
 * defined in the `google.cloudFunctions.archivesStorageLocation` configuration.
 */
export class ProjectGetArtefactDestinationForCloudFunctions extends ProjectGetArtefactDestination {
  async _call(context: WorkspaceContext): Promise<string> {
    const projectName = context.getOrThrow('project.name');
    const archivesStorageLocation = context.getOrThrow(
      'google.cloudFunctions.archivesStorageLocation',
    );

    return `${archivesStorageLocation}/${projectName}/${this.tag}.zip`;
  }

  _supports(context: WorkspaceContext): boolean {
    const conf = context.asConfiguration<ServerlessFunctionsConfiguration>();
    return (
      conf.get('project.type') === 'serverlessFunctions' &&
      conf.get('serverlessFunctions.platform') === 'google.cloudFunctions'
    );
  }
}

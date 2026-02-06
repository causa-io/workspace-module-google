import { callDeferred, WorkspaceContext } from '@causa/workspace';
import {
  ProjectPushArtefact,
  type ServerlessFunctionsConfiguration,
} from '@causa/workspace-core';

/**
 * Implements the {@link ProjectPushArtefact} function for Cloud Functions projects.
 * This copies the local archive of the Cloud Functions project to the Google Cloud Storage URI set in
 * {@link ProjectPushArtefact.destination}.
 */
export class ProjectPushArtefactForCloudFunctions extends ProjectPushArtefact {
  async _call(context: WorkspaceContext): Promise<string> {
    return await callDeferred(this, context, import.meta.url);
  }

  _supports(context: WorkspaceContext): boolean {
    const conf = context.asConfiguration<ServerlessFunctionsConfiguration>();
    return (
      conf.get('project.type') === 'serverlessFunctions' &&
      conf.get('serverlessFunctions.platform') === 'google.cloudFunctions'
    );
  }
}

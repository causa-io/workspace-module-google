import { WorkspaceContext } from '@causa/workspace';
import {
  ProjectGetArtefactDestination,
  type ServiceContainerConfiguration,
} from '@causa/workspace-core';
import type { GoogleConfiguration } from '../../configurations/index.js';

/**
 * Implements the {@link ProjectGetArtefactDestination} function for Cloud Run services.
 * The destination Docker repository is expected to be defined in `google.cloudRun.dockerRepository`.
 */
export class ProjectGetArtefactDestinationForCloudRun extends ProjectGetArtefactDestination {
  async _call(context: WorkspaceContext): Promise<string> {
    const projectName = context.getOrThrow('project.name');
    const dockerRepository = context
      .asConfiguration<GoogleConfiguration>()
      .getOrThrow('google.cloudRun.dockerRepository');

    return `${dockerRepository}/${projectName}:${this.tag}`;
  }

  _supports(context: WorkspaceContext): boolean {
    const conf = context.asConfiguration<ServiceContainerConfiguration>();
    return (
      conf.get('project.type') === 'serviceContainer' &&
      conf.get('serviceContainer.platform') === 'google.cloudRun'
    );
  }
}

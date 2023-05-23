import { WorkspaceContext } from '@causa/workspace';
import { GoogleConfiguration } from './google.js';

/**
 * Gets or formats the ID of the local GCP project.
 * For some emulators to work correctly, the ID must start with `demo-`.
 * By default, the name of the workspace is appended to this.
 *
 * @param context The {@link WorkspaceContext}.
 * @returns The ID of the local GCP project that should be used with emulators.
 */
export function getLocalGcpProject(context: WorkspaceContext): string {
  const googleConf = context.asConfiguration<GoogleConfiguration>();

  const localProject = googleConf.get('google.localProject');
  if (localProject) {
    return localProject;
  }

  const workspaceName = googleConf.getOrThrow('workspace.name');
  return `demo-${workspaceName}`;
}

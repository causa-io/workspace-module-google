import { WorkspaceContext } from '@causa/workspace';
import { GoogleConfiguration } from '../configurations/index.js';

/**
 * The name of the Spanner emulator.
 */
export const SPANNER_EMULATOR_NAME = 'google.spanner';

/**
 * Gets the name of the Spanner emulator Docker container from the configuration.
 *
 * @param context The {@link WorkspaceContext}.
 * @returns The name of the Spanner emulator Docker container.
 */
export function getSpannerContainerName(context: WorkspaceContext): string {
  const googleConf = context.asConfiguration<GoogleConfiguration>();

  const containerName = googleConf.get('google.spanner.emulator.containerName');
  if (containerName) {
    return containerName;
  }

  const workspaceName = googleConf.getOrThrow('workspace.name');
  return `${workspaceName}-spanner`;
}

/**
 * The Docker image containing the emulator.
 */
export const SPANNER_IMAGE = `gcr.io/cloud-spanner-emulator/emulator`;

/**
 * The port on which the Spanner emulator exposes its gRPC API.
 */
export const SPANNER_GRPC_PORT = 9010;

/**
 * The port on which the Spanner emulator exposes its HTTP API.
 */
export const SPANNER_HTTP_PORT = 9020;

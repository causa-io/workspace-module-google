import { WorkspaceContext } from '@causa/workspace';
import type { GoogleConfiguration } from '../configurations/index.js';

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
 * The default host port on which the Spanner emulator exposes its gRPC API.
 */
export const SPANNER_GRPC_PORT = 9010;

/**
 * The default host port on which the Spanner emulator exposes its HTTP API.
 */
export const SPANNER_HTTP_PORT = 9020;

/**
 * Returns the host port to which the Spanner emulator gRPC API should be bound.
 * Reads `google.spanner.emulator.grpcPort`, falling back to {@link SPANNER_GRPC_PORT}.
 *
 * @param context The {@link WorkspaceContext}.
 * @returns The host gRPC port for the Spanner emulator.
 */
export function getSpannerEmulatorGrpcPort(context: WorkspaceContext): number {
  return (
    context
      .asConfiguration<GoogleConfiguration>()
      .get('google.spanner.emulator.grpcPort') ?? SPANNER_GRPC_PORT
  );
}

/**
 * Returns the host port to which the Spanner emulator HTTP API should be bound.
 * Reads `google.spanner.emulator.httpPort`, falling back to {@link SPANNER_HTTP_PORT}.
 *
 * @param context The {@link WorkspaceContext}.
 * @returns The host HTTP port for the Spanner emulator.
 */
export function getSpannerEmulatorHttpPort(context: WorkspaceContext): number {
  return (
    context
      .asConfiguration<GoogleConfiguration>()
      .get('google.spanner.emulator.httpPort') ?? SPANNER_HTTP_PORT
  );
}

import { WorkspaceContext } from '@causa/workspace';
import {
  DockerContainerMount,
  DockerContainerPublish,
  DockerEmulatorService,
} from '@causa/workspace-core';
import {
  GoogleConfiguration,
  getLocalGcpProject,
} from '../configurations/index.js';

/**
 * The URI for the Dockerized `gcloud` command, provided by Google.
 */
const GCLOUD_DOCKER_IMAGE = `gcr.io/google.com/cloudsdktool/google-cloud-cli`;

/**
 * Options when specifying an availability endpoint when starting an emulator.
 */
type AvailabilityEndpointOptions = {
  /**
   * The endpoint that should be queried to determine when the emulator is available.
   */
  endpoint: string;
} & NonNullable<Parameters<DockerEmulatorService['waitForAvailability']>[2]>;

/**
 * A service providing a way to start emulators exposed by the `gcloud` CLI.
 */
export class GcloudEmulatorService {
  /**
   * The underlying {@link DockerEmulatorService} used to start the emulator.
   */
  private readonly dockerEmulatorService: DockerEmulatorService;

  /**
   * The local ("demo") GCP project used by the emulator.
   */
  readonly localGcpProject: string;

  /**
   * The version of the `gcloud` CLI (and Docker image) to use.
   */
  readonly gcloudVersion: string;

  constructor(context: WorkspaceContext) {
    this.dockerEmulatorService = context.service(DockerEmulatorService);
    this.localGcpProject = getLocalGcpProject(context);
    this.gcloudVersion =
      context
        .asConfiguration<GoogleConfiguration>()
        .get('google.gcloud.version') ?? 'latest';
  }

  /**
   * Starts an emulator using the Dockerized `gcloud` CLI.
   * The version of the `gcloud` Docker image can be specified using the `google.gcloud.version` configuration.
   *
   * @param emulatorName The name of the emulator, as exposed by the `gcloud` CLI.
   * @param containerName The name of the Docker container to (re)create.
   * @param publish A list of at least one port to expose from the container.
   * @param options Additional options.
   */
  async start(
    emulatorName: string,
    containerName: string,
    publish: [DockerContainerPublish, ...DockerContainerPublish[]],
    options: {
      /**
       * A list of Docker volumes to mount.
       */
      mounts?: DockerContainerMount[];

      /**
       * Arguments that should be added at the end of the `gcloud` command running the emulator.
       */
      additionalArguments?: string[];

      /**
       * The endpoint that should be queried and for which a 200 response should be received.
       * If specified, the function will only resolve when the emulator has successfully started.
       * If not specified, the emulator might still be initializing or might have failed when the function resolves.
       */
      availabilityEndpoint?: string | AvailabilityEndpointOptions;
    } = {},
  ): Promise<void> {
    // The `emulators` tag does not have a `latest` version. It is simply `emulators`, which is the default here.
    const imageVersion = [this.gcloudVersion, 'emulators']
      .filter((s) => s !== 'latest')
      .join('-');
    const dockerImage = `${GCLOUD_DOCKER_IMAGE}:${imageVersion}`;

    await this.dockerEmulatorService.start(
      dockerImage,
      containerName,
      publish,
      {
        commandAndArgs: [
          'gcloud',
          'beta',
          'emulators',
          emulatorName,
          'start',
          `--host-port=0.0.0.0:${publish[0].container}`,
          `--project=${this.localGcpProject}`,
          ...(options.additionalArguments ?? []),
        ],
        mounts: options.mounts,
      },
    );

    if (options.availabilityEndpoint) {
      const { endpoint, ...waitOptions } =
        typeof options.availabilityEndpoint === 'string'
          ? { endpoint: options.availabilityEndpoint }
          : options.availabilityEndpoint;
      await this.dockerEmulatorService.waitForAvailability(
        containerName,
        endpoint,
        waitOptions,
      );
    }
  }
}

import { WorkspaceContext } from '@causa/workspace';
import {
  type DockerContainerPublish,
  DockerEmulatorService,
} from '@causa/workspace-core';
import {
  type GoogleConfiguration,
  getLocalGcpProject,
} from '../configurations/index.js';

/**
 * The Docker image providing the `firebase` CLI.
 */
const FIREBASE_TOOLS_IMAGE = 'andreysenov/firebase-tools';

/**
 * The location of the Firebase configuration file within the container.
 */
const FIREBASE_CONTAINER_CONF_FILE = '/home/node/firebase.json';

/**
 * Options when starting a Firebase emulator.
 */
type FirebaseEmulatorStartOptions = Omit<
  NonNullable<Parameters<DockerEmulatorService['start']>[3]>,
  'commandAndArgs'
> &
  NonNullable<Parameters<DockerEmulatorService['waitForAvailability']>[2]>;

/**
 * A service providing a way to start emulators exposed by the `firebase` CLI.
 */
export class FirebaseEmulatorService {
  /**
   * The underlying {@link DockerEmulatorService} used to start the emulator.
   */
  private readonly dockerEmulatorService: DockerEmulatorService;

  /**
   * The local ("demo") GCP project used by the emulator.
   */
  readonly localGcpProject: string;

  /**
   * The version of the Firebase tools to use.
   */
  readonly firebaseToolsVersion: string;

  constructor(context: WorkspaceContext) {
    this.dockerEmulatorService = context.service(DockerEmulatorService);
    this.localGcpProject = getLocalGcpProject(context);
    this.firebaseToolsVersion =
      context
        .asConfiguration<GoogleConfiguration>()
        .get('google.firebase.tools.version') ?? 'latest';
  }

  /**
   * Starts a Docker container running an emulator using the `firebase` CLI, and waits for it to be available.
   * The version of the Firebase CLI can be specified using the `google.firebaseTools.version` configuration.
   *
   * @param containerName The name of the container to create.
   * @param firebaseConfFile The path to a local file containing the Firebase configuration.
   * @param publish A list of at least one port to expose from the container.
   * @param options Options when starting the Docker container and waiting for it to be available.
   */
  async start(
    containerName: string,
    firebaseConfFile: string,
    publish: [DockerContainerPublish, ...DockerContainerPublish[]],
    options: FirebaseEmulatorStartOptions = {},
  ): Promise<void> {
    await this.dockerEmulatorService.start(
      `${FIREBASE_TOOLS_IMAGE}:${this.firebaseToolsVersion}-node-22-slim`,
      containerName,
      publish,
      {
        ...options,
        mounts: [
          ...(options.mounts ?? []),
          {
            type: 'bind',
            source: firebaseConfFile,
            destination: FIREBASE_CONTAINER_CONF_FILE,
            readonly: true,
          },
        ],
        commandAndArgs: [
          'firebase',
          'emulators:start',
          '-P',
          this.localGcpProject,
        ],
      },
    );

    await this.dockerEmulatorService.waitForAvailability(
      containerName,
      `http://127.0.0.1:${publish[0].local}/`,
      options,
    );
  }
}

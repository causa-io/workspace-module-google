import { ProjectsClient } from '@google-cloud/resource-manager';

/**
 * A service for interacting with the GCP Resource Manager API, handling organizations, folders, and projects.
 */
export class ResourceManagerService {
  /**
   * The client used to manage GCP projects.
   */
  readonly projectsClient: ProjectsClient;

  constructor() {
    this.projectsClient = new ProjectsClient();
  }

  /**
   * Retrieves the project number for a given GCP project ID.
   *
   * @param projectId The ID of the GCP project.
   * @returns The number of the GCP project.
   */
  async getProjectNumber(projectId: string): Promise<string> {
    const [projects] = await this.projectsClient.searchProjects(
      { query: `projectId:${projectId}`, pageSize: 1 },
      { autoPaginate: false },
    );

    if (projects.length < 1) {
      throw new Error(`Could not find GCP project '${projectId}'.`);
    }
    const [project] = projects;

    const projectNumber = project.name?.split('/').at(1);
    if (!projectNumber) {
      throw new Error(
        `Failed to parse invalid project name '${project.name}'.`,
      );
    }

    return projectNumber;
  }
}

import { WorkspaceContext } from '@causa/workspace';
import { PubSub } from '@google-cloud/pubsub';
import { iam_v1 } from 'googleapis';
import type { GoogleConfiguration } from '../configurations/index.js';
import { ResourceManagerService } from './resource-manager.js';

/**
 * A service for managing Pub/Sub resources
 */
export class PubSubService {
  /**
   * The Pub/Sub client.
   */
  readonly pubSub: PubSub;

  /**
   * The resource manager service used to get the project number.
   */
  private readonly resourceManagerService: ResourceManagerService;

  /**
   * The ID of the GCP project in which to create Pub/Sub resources.
   */
  readonly projectId: string;

  constructor(context: WorkspaceContext) {
    this.pubSub = new PubSub();
    this.resourceManagerService = context.service(ResourceManagerService);
    this.projectId = context
      .asConfiguration<GoogleConfiguration>()
      .getOrThrow('google.project');
  }

  /**
   * The cached promise that resolves to the GCP service account used by Pub/Sub.
   */
  private gcpServiceAccountPromise: Promise<string> | undefined;

  /**
   * Constructs the email of the GCP-owned service account used by Pub/Sub.
   * This can be used to grant roles to the service account, e.g. for push subscriptions.
   *
   * @returns The email of the GCP service account used by Pub/Sub.
   */
  async getGcpServiceAccount(): Promise<string> {
    if (!this.gcpServiceAccountPromise) {
      this.gcpServiceAccountPromise = (async () => {
        const projectNumber =
          await this.resourceManagerService.getProjectNumber(this.projectId);
        return `service-${projectNumber}@gcp-sa-pubsub.iam.gserviceaccount.com`;
      })();
    }

    return await this.gcpServiceAccountPromise;
  }

  /**
   * Constructs the IAM policy bindings that should be added to a service account meant to be used by push
   * subscriptions.
   * Those bindings allow the GCP-owned Pub/Sub service account to authenticate as the service account when pushing
   * messages.
   *
   * @returns The bindings.
   */
  async getPushServiceAccountBindings(): Promise<iam_v1.Schema$Binding[]> {
    const pubSubGcpServiceAccount = await this.getGcpServiceAccount();

    return [
      {
        role: 'roles/iam.serviceAccountTokenCreator',
        members: [`serviceAccount:${pubSubGcpServiceAccount}`],
      },
    ];
  }
}

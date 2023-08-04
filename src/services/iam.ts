import { WorkspaceContext } from '@causa/workspace';
import { iam_v1 } from 'googleapis';
import { GoogleApisService } from './google-apis.js';

/**
 * A service for interacting with the IAM API.
 */
export class IamService {
  /**
   * The underlying {@link GoogleApisService} used to get the IAM client.
   */
  private readonly googleApisService: GoogleApisService;

  /**
   * A promise that resolves to the singleton IAM client.
   */
  private iam: Promise<iam_v1.Iam> | undefined;

  constructor(context: WorkspaceContext) {
    this.googleApisService = context.service(GoogleApisService);
  }

  /**
   * Gets or creates the singleton IAM client.
   *
   * @returns The singleton IAM client.
   */
  private async getIam(): Promise<iam_v1.Iam> {
    if (!this.iam) {
      this.iam = this.googleApisService.getClient('iam', 'v1', {});
    }

    return await this.iam;
  }

  /**
   * Creates a service account, optionally setting the IAM policy bindings for it.
   *
   * @param projectId The ID of the project in which to create the service account.
   * @param accountId The ID of the service account to create.
   * @param options Additional options when creating the account.
   * @returns The created service account.
   */
  async createServiceAccount(
    projectId: string,
    accountId: string,
    options: {
      /**
       * The IAM policy bindings to set for the service account after its creation.
       */
      bindings?: iam_v1.Schema$Binding[];
    } = {},
  ): Promise<iam_v1.Schema$ServiceAccount> {
    const iam = await this.getIam();

    const { data: serviceAccount } = await iam.projects.serviceAccounts.create({
      name: `projects/${projectId}`,
      requestBody: { accountId },
    });

    if (options.bindings) {
      const resource = serviceAccount.name ?? '';

      const { data: policy } = await iam.projects.serviceAccounts.getIamPolicy({
        resource,
      });

      policy.bindings = [...(policy.bindings ?? []), ...options.bindings];

      await iam.projects.serviceAccounts.setIamPolicy({
        resource,
        requestBody: { policy },
      });
    }

    return serviceAccount;
  }

  /**
   * Deletes a service account.
   *
   * @param name The full resource name of the service account to delete, in the format
   *   `projects/<projectId>/serviceAccounts/<accountId>`.
   */
  async deleteServiceAccount(name: string): Promise<void> {
    const iam = await this.getIam();
    await iam.projects.serviceAccounts.delete({ name });
  }
}

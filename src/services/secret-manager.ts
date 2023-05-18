import { WorkspaceContext } from '@causa/workspace';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

/**
 * A service exposing a client to the Google Secret Manager.
 */
export class GoogleSecretManagerService {
  /**
   * The default project to use when fetching secrets.
   * Can be `undefined`, in which case the project should be set in the secret itself.
   */
  readonly defaultProject: string | undefined;

  /**
   * The client to the Google Secret Manager.
   */
  readonly client: SecretManagerServiceClient;

  constructor(context: WorkspaceContext) {
    this.defaultProject =
      context.get('google.secretManager.project') ??
      context.get('google.project');
    this.client = new SecretManagerServiceClient();
  }
}

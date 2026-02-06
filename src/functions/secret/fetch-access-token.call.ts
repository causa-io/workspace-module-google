import type { WorkspaceContext } from '@causa/workspace';
import { GoogleApisService } from '../../services/google-apis.js';
import {
  AuthClientResponseError,
  type SecretFetchForGoogleAccessToken,
} from './fetch-access-token.js';

export default async function call(
  this: SecretFetchForGoogleAccessToken,
  context: WorkspaceContext,
): Promise<string> {
  const authClient = await context.service(GoogleApisService).getAuthClient();
  const { token } = await authClient.getAccessToken();

  if (!token) {
    throw new AuthClientResponseError();
  }

  return token;
}

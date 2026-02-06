import type { WorkspaceContext } from '@causa/workspace';
import { getAuth, signInWithCustomToken } from 'firebase/auth';
import { FirebaseAppService } from '../../services/firebase-app.js';
import { GoogleIdentityPlatformGenerateCustomToken } from './generate-custom-token.js';
import type { GoogleIdentityPlatformGenerateToken } from './generate-token.js';

export default async function call(
  this: GoogleIdentityPlatformGenerateToken,
  context: WorkspaceContext,
): Promise<string> {
  context.logger.info(`🛂 Signing in user '${this.user}' with a custom token.`);
  const customToken = await context.call(
    GoogleIdentityPlatformGenerateCustomToken,
    { user: this.user, claims: this.claims },
  );

  const app = await context.service(FirebaseAppService).getApp();
  const auth = getAuth(app);
  const credentials = await signInWithCustomToken(auth, customToken);

  return this.refreshToken
    ? credentials.user.refreshToken
    : await credentials.user.getIdToken();
}

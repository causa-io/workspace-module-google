import { getAppCheck } from 'firebase-admin/app-check';
import { FirebaseAppService } from '../../services/firebase-app.js';
import type { GoogleAppCheckGenerateToken } from './generate-token.js';

/**
 * The time to live of generated tokens, in seconds.
 */
const TOKEN_TTL = 3600;

export default async function call(
  this: GoogleAppCheckGenerateToken,
): Promise<string> {
  const firebaseAppService = this._context.service(FirebaseAppService);
  const app = await firebaseAppService.getAdminAppForAdminServiceAccount();
  const appId = this.app ?? (await firebaseAppService.getAppId());

  this._context.logger.info(
    `🛂 Generating AppCheck token for Firebase application '${appId}'.`,
  );

  const appCheck = getAppCheck(app);

  const { token } = await appCheck.createToken(appId, {
    ttlMillis: TOKEN_TTL * 1000,
  });

  return token;
}

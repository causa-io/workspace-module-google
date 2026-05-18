import { getAuth } from 'firebase-admin/auth';
import { FirebaseAppService } from '../../services/firebase-app.js';
import type { GoogleIdentityPlatformGenerateCustomToken } from './generate-custom-token.js';

export default async function call(
  this: GoogleIdentityPlatformGenerateCustomToken,
): Promise<string> {
  const adminApp = await this._context
    .service(FirebaseAppService)
    .getAdminAppForAdminServiceAccount();

  return await getAuth(adminApp).createCustomToken(this.user, this.claims);
}

import { WorkspaceContext, WorkspaceFunction } from '@causa/workspace';
import { AllowMissing } from '@causa/workspace/validation';
import { IsObject, IsString } from 'class-validator';
import { getAuth } from 'firebase-admin/auth';
import { FirebaseAppService } from '../../services/index.js';

/**
 * Generates a custom token that can be used to sign in to Identity Platform as a given user.
 * Optionally, custom claims can be set in the token.
 * They will be included in the ID token returned by Identity Platform when signing in.
 * If `google.firebase.adminServiceAccount` is set, the service account will be used to sign the token. Otherwise, an
 * attempt will be made to find a valid service account in the `google.project`.
 */
export class GoogleIdentityPlatformGenerateCustomToken extends WorkspaceFunction<
  Promise<string>
> {
  /**
   * The ID of the user for which the custom token should be generated.
   */
  @IsString()
  readonly user!: string;

  /**
   * A dictionary of custom claims to add to the token.
   */
  @IsObject()
  @AllowMissing()
  readonly claims?: Record<string, any>;

  async _call(context: WorkspaceContext): Promise<string> {
    const adminApp = await context
      .service(FirebaseAppService)
      .getAdminAppForAdminServiceAccount();

    return await getAuth(adminApp).createCustomToken(this.user, this.claims);
  }

  _supports(): boolean {
    return true;
  }
}

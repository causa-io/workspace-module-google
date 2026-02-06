import { CliArgument, CliCommand, CliOption } from '@causa/cli';
import { WorkspaceContext, WorkspaceFunction } from '@causa/workspace';
import { AllowMissing } from '@causa/workspace/validation';
import { Transform } from 'class-transformer';
import { IsBoolean, IsObject, IsString } from 'class-validator';
import { identityPlatformCommandDefinition } from '../../cli/index.js';
import { callDeferred } from '../utils.js';

/**
 * Generates an ID token for an Identity Platform end user.
 * For this function to succeed, the `google.project` should be set, which usually means setting the environment in the
 * context. Also `google.firebase` children can be used to configure (and speed up) how tokens are generated.
 */
@CliCommand({
  parent: identityPlatformCommandDefinition,
  name: 'genToken',
  description: `Generates an ID token that can be used to access Firebase services as an end user.
Optional custom claims can be included in the signed token.`,
  summary:
    'Generates an ID token that can be used to access Firebase services as a client.',
  outputFn: (token) => console.log(token),
})
export class GoogleIdentityPlatformGenerateToken extends WorkspaceFunction<
  Promise<string>
> {
  /**
   * The ID of the user for which the token will be generated.
   */
  @CliArgument({
    name: '<user>',
    position: 0,
    description: 'The ID of the user for which the token will be generated.',
  })
  @IsString()
  readonly user!: string;

  /**
   * A dictionary of custom claims that will be added to the generated JWT.
   */
  @CliOption({
    flags: '-c, --claims <claims>',
    description:
      'A JSON string containing custom claims that will be added to the token.',
  })
  @IsObject()
  @AllowMissing()
  @Transform(({ value }) =>
    typeof value === 'string' ? JSON.parse(value) : value,
  )
  readonly claims?: Record<string, any>;

  /**
   * Whether to return the refresh token instead of the ID token.
   */
  @CliOption({
    flags: '-r, --refresh-token',
    description: 'Return the refresh token instead of the ID token.',
  })
  @IsBoolean()
  @AllowMissing()
  readonly refreshToken?: boolean;

  async _call(context: WorkspaceContext): Promise<string> {
    return await callDeferred(this, context, import.meta.url);
  }

  _supports(): boolean {
    return true;
  }
}

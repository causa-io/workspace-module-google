import { CliCommand, CliOption } from '@causa/cli';
import { WorkspaceContext, WorkspaceFunction } from '@causa/workspace';
import { AllowMissing } from '@causa/workspace/validation';
import { IsString } from 'class-validator';
import { fileURLToPath } from 'url';
import { appCheckCommandDefinition } from '../../cli/index.js';

/**
 * Generates a new AppCheck token.
 */
@CliCommand({
  parent: appCheckCommandDefinition,
  name: 'genToken',
  description: `Generates an AppCheck token.
This token can be used to mock a call from a verified device.
If the Firebase app ID is not specified, it will:
- Be fetched from the 'google.firebase.appId' configuration.
- If not present in the configuration, will be automatically looked up from the API.`,
  summary: 'Generates an AppCheck token.',
  outputFn: (token) => console.log(token),
})
export class GoogleAppCheckGenerateToken extends WorkspaceFunction<
  Promise<string>
> {
  /**
   * The ID of the Firebase app for which the token will be generated.
   * If `undefined`, a Firebase app ID will be found in the configuration or using the API.
   */
  @CliOption({
    flags: '-a, --app <app>',
    description:
      'The ID of the Firebase app for which the token will be generated.',
  })
  @IsString()
  @AllowMissing()
  readonly app?: string;

  protected async _callImported<T = any>(
    context: WorkspaceContext,
    options: {
      file?: string;
      args?: any[];
    } = {},
  ): Promise<T> {
    const file =
      options.file ??
      fileURLToPath(import.meta.url.replace(/(\.[jt]s)$/, '.call$1'));
    const args = options.args ?? [context, this];

    const importedModule = await import(file);
    return importedModule.default(...args);
  }

  async _call(context: WorkspaceContext): Promise<string> {
    return await this._callImported(context);
  }

  _supports(): boolean {
    return true;
  }
}

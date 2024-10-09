import { CliCommand } from '@causa/cli';
import { WorkspaceContext, WorkspaceFunction } from '@causa/workspace';
import type { InfrastructureProcessor } from '@causa/workspace-core';
import { AllowMissing } from '@causa/workspace/validation';
import { IsBoolean } from 'class-validator';
import { firebaseStorageCommandDefinition } from '../../cli/index.js';
import type { GoogleConfiguration } from '../../configurations/index.js';
import { mergeFirebaseRulesFiles } from '../../firebase/index.js';

/**
 * The default location where the security rules file for Firebase Storage will be written.
 */
const DEFAULT_FIREBASE_STORAGE_SECURITY_RULE_FILE = 'storage.rules';

/**
 * The return value of {@link GoogleFirebaseStorageMergeRules}.
 */
type GoogleFirebaseStorageMergeRulesResult = {
  /**
   * A configuration with `google.firebaseStorage.securityRuleFile` set to the path to the merged rules file.
   */
  configuration: GoogleConfiguration;

  /**
   * The path to the merged rules file.
   * This is `null` during teardown.
   */
  securityRuleFile: string | null;
};

/**
 * A function that merges all the Firebase Storage security rules found in the workspace into a single file, which can
 * be used for the emulator and as the configuration of the Firebase Storage service.
 * The `google.firebaseStorage.securityRuleFiles` configuration can be used to pass a list of glob patterns to find
 * security rule files in the workspace.
 * The `google.firebaseStorage.securityRuleFile` configuration can be used to specify the output location of the merged
 * rules file.
 * Returns a configuration with `google.firebaseStorage.securityRuleFile` set, such that the function can be used as a
 * processor.
 */
@CliCommand({
  parent: firebaseStorageCommandDefinition,
  name: 'mergeRules',
  description: `Merge Firebase Storage security rules into a single file.
Input files are looked for in the workspace using the globs defined in google.firebaseStorage.securityRulesFiles.`,
  summary: 'Merge Firebase Storage security rules into a single file.',
  outputFn: ({ securityRuleFile }) => console.log(securityRuleFile),
})
export class GoogleFirebaseStorageMergeRules
  extends WorkspaceFunction<Promise<GoogleFirebaseStorageMergeRulesResult>>
  implements InfrastructureProcessor
{
  @IsBoolean()
  @AllowMissing()
  readonly tearDown?: boolean;

  async _call(
    context: WorkspaceContext,
  ): Promise<GoogleFirebaseStorageMergeRulesResult> {
    if (this.tearDown) {
      return { configuration: {}, securityRuleFile: null };
    }

    const googleConf = context.asConfiguration<GoogleConfiguration>();
    let securityRuleFile =
      googleConf.get('google.firebaseStorage.securityRuleFile') ??
      DEFAULT_FIREBASE_STORAGE_SECURITY_RULE_FILE;
    const globs =
      googleConf.get('google.firebaseStorage.securityRuleFiles') ?? [];

    securityRuleFile = await mergeFirebaseRulesFiles(
      'Firebase Storage',
      globs,
      (rules) =>
        `rules_version = '2';

service firebase.storage {
  match /b/{bucket}/o {
${rules}
  }
}
`,
      securityRuleFile,
      context,
    );

    return {
      configuration: { google: { firebaseStorage: { securityRuleFile } } },
      securityRuleFile,
    };
  }

  _supports(): boolean {
    return true;
  }
}

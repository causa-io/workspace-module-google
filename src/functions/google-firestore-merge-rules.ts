import { CliCommand } from '@causa/cli';
import { WorkspaceContext, WorkspaceFunction } from '@causa/workspace';
import { InfrastructureProcessor } from '@causa/workspace-core';
import { firestoreCommandDefinition } from '../cli/index.js';
import { GoogleConfiguration } from '../configurations/index.js';
import { mergeFirebaseRulesFiles } from '../firebase/index.js';

/**
 * The default location where the security rules file for Firestore will be written.
 */
const DEFAULT_FIRESTORE_SECURITY_RULE_FILE = 'firestore.rules';

/**
 * The return value of {@link GoogleFirestoreMergeRules}.
 */
type GoogleFirestoreMergeRulesResult = {
  /**
   * A configuration with `google.firestore.securityRuleFile` set to the path to the merged rules file.
   */
  configuration: GoogleConfiguration;

  /**
   * The path to the merged rules file.
   */
  securityRuleFile: string;
};

/**
 * A function that merges all the Firestore security rules found in the workspace into a single file, which can be used
 * for the emulator and as the configuration of the Firestore service.
 * The `google.firestore.securityRuleFiles` configuration can be used to pass a list of glob patterns to find security
 * rule files in the workspace.
 * The `google.firestore.securityRuleFile` configuration can be used to specify the output location of the merged rules
 * file.
 * Returns a configuration with `google.firestore.securityRuleFile` set, such that the function can be used as a
 * processor.
 */
@CliCommand({
  parent: firestoreCommandDefinition,
  name: 'mergeRules',
  description: `Merge Firestore security rules into a single file.
Input files are looked for in the workspace using the globs defined in google.firestore.securityRulesFiles.`,
  summary: 'Merge Firestore security rules into a single file.',
  outputFn: ({ securityRuleFile }) => console.log(securityRuleFile),
})
export class GoogleFirestoreMergeRules
  extends WorkspaceFunction<Promise<GoogleFirestoreMergeRulesResult>>
  implements InfrastructureProcessor
{
  async _call(
    context: WorkspaceContext,
  ): Promise<GoogleFirestoreMergeRulesResult> {
    const googleConf = context.asConfiguration<GoogleConfiguration>();
    let securityRuleFile =
      googleConf.get('google.firestore.securityRuleFile') ??
      DEFAULT_FIRESTORE_SECURITY_RULE_FILE;
    const globs = googleConf.get('google.firestore.securityRuleFiles') ?? [];

    securityRuleFile = await mergeFirebaseRulesFiles(
      'Firestore',
      globs,
      (rules) =>
        `rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
${rules}
  }
}
`,
      securityRuleFile,
      context,
    );

    return {
      configuration: { google: { firestore: { securityRuleFile } } },
      securityRuleFile,
    };
  }

  _supports(): boolean {
    return true;
  }
}

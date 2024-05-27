import { WorkspaceContext } from '@causa/workspace';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { globby } from 'globby';
import { dirname, join } from 'path';

/**
 * The indent for Firebase security rules once merged in the global file.
 */
const DOCUMENTS_RULES_INDENT = '    ';

/**
 * Merges the given input Firebase security rules files into a single rules definition.
 *
 * @param rootPath The absolute path from which `ruleFiles` should be resolved.
 * @param rulesFiles The list of (relative) file paths to the rules.
 * @param template The template function producing the final rules file.
 * @returns The merged rules.
 */
async function mergeRules(
  rootPath: string,
  rulesFiles: string[],
  template: (rules: string) => string,
): Promise<string> {
  const rules = await Promise.all(
    rulesFiles.map(async (filePath) => {
      const path = join(rootPath, filePath);
      const content = await readFile(path);
      const rules = content
        .toString()
        .replaceAll('\n', `\n${DOCUMENTS_RULES_INDENT}`);
      return `${DOCUMENTS_RULES_INDENT}// ${filePath}\n${DOCUMENTS_RULES_INDENT}${rules}`;
    }),
  );

  const mergedDocumentsRules = rules
    .join('\n')
    .replaceAll(/\s+\n/g, '\n\n')
    .trimEnd();

  return template(mergedDocumentsRules);
}

/**
 * Merges all the Firebase security rules files in the repository into a single file.
 *
 * @param displayableType The type for Firebase security rules, which can be displayed in log messages.
 * @param globs The list of patterns used to find rule files from the root of the workspace.
 * @param template The template that takes the merged rules and wraps them to produce the final rules definition.
 * @param rulesFilePath The destination path where the rules will be written, relative to the workspace root.
 * @param context The {@link WorkspaceContext} to use.
 */
export async function mergeFirebaseRulesFiles(
  displayableType: string,
  globs: string[],
  template: (rules: string) => string,
  rulesFilePath: string,
  context: WorkspaceContext,
): Promise<string> {
  context.logger.info(`🛂 Looking for ${displayableType} rules files.`);

  const rootPath = context.rootPath;
  rulesFilePath = join(rootPath, rulesFilePath);

  const files = await globby(globs, {
    cwd: rootPath,
    gitignore: true,
    followSymbolicLinks: false,
  });
  files.sort();

  context.logger.debug(
    `🛂 Found the following rules files: ${files
      .map((f) => `'${f}'`)
      .join(', ')}.`,
  );

  context.logger.info(
    `🛂 Merging ${files.length} ${displayableType} rules files.`,
  );
  const mergedRules = await mergeRules(rootPath, files, template);

  context.logger.debug(
    `🛂 Writing merged ${displayableType} rules to '${rulesFilePath}'.`,
  );
  await mkdir(dirname(rulesFilePath), { recursive: true });
  await writeFile(rulesFilePath, mergedRules);

  return rulesFilePath;
}

import type { ClassContext } from '@causa/workspace-typescript';
import { TypeScriptWithDecoratorsRenderer } from '@causa/workspace-typescript';
import micromatch from 'micromatch';
import { join } from 'path';

/**
 * Checks whether the schema matches the glob patterns specified in the renderer's options.
 * If this returns `false`, the decorators should not be generated for the schema.
 *
 * @param renderer The renderer instance.
 * @param context The {@link ClassContext} of the schema to check.
 * @param globs The glob patterns to match against, or undefined/null if not configured.
 * @returns `true` if the decorators should be generated for the schema.
 */
export function schemaMatchesGlobPatterns(
  renderer: TypeScriptWithDecoratorsRenderer,
  context: ClassContext,
  globs: unknown,
): boolean {
  const { uri } = context;

  if (!uri || !globs || !Array.isArray(globs)) {
    return true;
  }

  const projectPath =
    renderer.targetLanguage.workspaceContext.getProjectPathOrThrow();
  const absoluteGlobs = globs.map((g) => join(projectPath, g));

  return micromatch.isMatch(uri, absoluteGlobs);
}

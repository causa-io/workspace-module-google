import { WorkspaceContext } from '@causa/workspace';
import { TypeScriptGetDecoratorRenderer } from '@causa/workspace-typescript';
import type { TypeScriptWithDecoratorsRenderer } from '@causa/workspace-typescript/code-generation';
import { GoogleSpannerRenderer } from '../../code-generation/index.js';

/**
 * Implements {@link TypeScriptGetDecoratorRenderer} for the {@link GoogleSpannerRenderer}.
 */
export class TypeScriptGetDecoratorRendererForGoogleSpanner extends TypeScriptGetDecoratorRenderer {
  _call(): new (...args: any[]) => TypeScriptWithDecoratorsRenderer {
    return GoogleSpannerRenderer;
  }

  _supports(context: WorkspaceContext): boolean {
    return (
      context.get('project.language') === 'typescript' &&
      this.generator === 'typescriptModelClass'
    );
  }
}

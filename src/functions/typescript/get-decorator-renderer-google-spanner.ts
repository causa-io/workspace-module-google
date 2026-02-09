import { WorkspaceContext } from '@causa/workspace';
import {
  TypeScriptGetDecoratorRenderer,
  type TypeScriptWithDecoratorsRendererType,
} from '@causa/workspace-typescript';

/**
 * Implements {@link TypeScriptGetDecoratorRenderer} for the `GoogleSpannerRenderer`.
 */
export class TypeScriptGetDecoratorRendererForGoogleSpanner extends TypeScriptGetDecoratorRenderer {
  async _call(): Promise<TypeScriptWithDecoratorsRendererType> {
    const { GoogleSpannerRenderer } =
      await import('../../code-generation/index.js');
    return GoogleSpannerRenderer;
  }

  _supports(context: WorkspaceContext): boolean {
    return (
      context.get('project.language') === 'typescript' &&
      this.generator === 'typescriptModelClass'
    );
  }
}

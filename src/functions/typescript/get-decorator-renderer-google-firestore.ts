import { WorkspaceContext } from '@causa/workspace';
import {
  TypeScriptGetDecoratorRenderer,
  type TypeScriptWithDecoratorsRendererType,
} from '@causa/workspace-typescript';

/**
 * Implements {@link TypeScriptGetDecoratorRenderer} for the `GoogleFirestoreRenderer`.
 */
export class TypeScriptGetDecoratorRendererForGoogleFirestore extends TypeScriptGetDecoratorRenderer {
  async _call(): Promise<TypeScriptWithDecoratorsRendererType> {
    const { GoogleFirestoreRenderer } =
      await import('../../code-generation/index.js');
    return GoogleFirestoreRenderer;
  }

  _supports(context: WorkspaceContext): boolean {
    return (
      context.get('project.language') === 'typescript' &&
      this.generator === 'typescriptModelClass'
    );
  }
}

import { WorkspaceContext } from '@causa/workspace';
import { TypeScriptGetDecoratorRenderer } from '@causa/workspace-typescript';
import type { TypeScriptWithDecoratorsRenderer } from '@causa/workspace-typescript/code-generation';
import { GoogleFirestoreRenderer } from '../../code-generation/index.js';

/**
 * Implements {@link TypeScriptGetDecoratorRenderer} for the {@link GoogleFirestoreRenderer}.
 */
export class TypeScriptGetDecoratorRendererForGoogleFirestore extends TypeScriptGetDecoratorRenderer {
  _call(): new (...args: any[]) => TypeScriptWithDecoratorsRenderer {
    return GoogleFirestoreRenderer;
  }

  _supports(context: WorkspaceContext): boolean {
    return (
      context.get('project.language') === 'typescript' &&
      this.generator === 'typescriptModelClass'
    );
  }
}

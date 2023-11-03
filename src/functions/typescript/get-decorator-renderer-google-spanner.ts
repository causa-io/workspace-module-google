import { WorkspaceContext } from '@causa/workspace';
import {
  TypeScriptDecoratorsRenderer,
  TypeScriptGetDecoratorRenderer,
} from '@causa/workspace-typescript';
import { GoogleSpannerRenderer } from '../../code-generation/index.js';

/**
 * Implements {@link TypeScriptGetDecoratorRenderer} for the {@link GoogleSpannerRenderer}.
 * The configuration name for the renderer is `google.spanner`.
 */
export class TypeScriptGetDecoratorRendererForGoogleSpanner extends TypeScriptGetDecoratorRenderer {
  _call(): new (...args: any[]) => TypeScriptDecoratorsRenderer {
    return GoogleSpannerRenderer;
  }

  _supports(context: WorkspaceContext): boolean {
    if (context.get('project.language') !== 'typescript') {
      return false;
    }

    const decoratorRenderers =
      context
        .asConfiguration<any>()
        .get('typescript.codeGeneration.decoratorRenderers') ?? [];
    return (
      decoratorRenderers.length === 0 ||
      decoratorRenderers.includes('google.spanner')
    );
  }
}

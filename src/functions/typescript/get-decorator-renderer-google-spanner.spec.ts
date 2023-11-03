import { TypeScriptGetDecoratorRenderer } from '@causa/workspace-typescript';
import { NoImplementationFoundError } from '@causa/workspace/function-registry';
import { createContext } from '@causa/workspace/testing';
import { GoogleSpannerRenderer } from '../../code-generation/index.js';
import { TypeScriptGetDecoratorRendererForGoogleSpanner } from './get-decorator-renderer-google-spanner.js';

describe('TypeScriptGetDecoratorRendererForGoogleSpanner', () => {
  it('should not support languages other than TypeScript', () => {
    const { context } = createContext({
      configuration: {
        project: {
          name: 'my-project',
          type: 'serviceContainer',
          language: 'javascript',
        },
      },
      functions: [TypeScriptGetDecoratorRendererForGoogleSpanner],
    });

    expect(() => context.call(TypeScriptGetDecoratorRenderer, {})).toThrow(
      NoImplementationFoundError,
    );
  });

  it('should not support a configuration without the renderer', () => {
    const { context } = createContext({
      configuration: {
        project: {
          name: 'my-project',
          type: 'serviceContainer',
          language: 'typescript',
        },
        typescript: { codeGeneration: { decoratorRenderers: ['other'] } },
      },
      functions: [TypeScriptGetDecoratorRendererForGoogleSpanner],
    });

    expect(() => context.call(TypeScriptGetDecoratorRenderer, {})).toThrow(
      NoImplementationFoundError,
    );
  });

  it('should return the renderer', () => {
    const { context } = createContext({
      configuration: {
        project: {
          name: 'my-project',
          type: 'serviceContainer',
          language: 'typescript',
        },
        typescript: {
          codeGeneration: { decoratorRenderers: ['google.spanner'] },
        },
      },
      functions: [TypeScriptGetDecoratorRendererForGoogleSpanner],
    });

    const actualRenderer = context.call(TypeScriptGetDecoratorRenderer, {});

    expect(actualRenderer).toBe(GoogleSpannerRenderer);
  });

  it('should return the renderer when none is specified', () => {
    const { context } = createContext({
      configuration: {
        project: {
          name: 'my-project',
          type: 'serviceContainer',
          language: 'typescript',
        },
      },
      functions: [TypeScriptGetDecoratorRendererForGoogleSpanner],
    });

    const actualRenderer = context.call(TypeScriptGetDecoratorRenderer, {});

    expect(actualRenderer).toBe(GoogleSpannerRenderer);
  });
});

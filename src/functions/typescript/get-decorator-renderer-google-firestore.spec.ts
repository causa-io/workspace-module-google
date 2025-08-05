import { TypeScriptGetDecoratorRenderer } from '@causa/workspace-typescript';
import { NoImplementationFoundError } from '@causa/workspace/function-registry';
import { createContext } from '@causa/workspace/testing';
import { GoogleFirestoreRenderer } from '../../code-generation/index.js';
import { TypeScriptGetDecoratorRendererForGoogleFirestore } from './get-decorator-renderer-google-firestore.js';

describe('TypeScriptGetDecoratorRendererForGoogleFirestore', () => {
  it('should not support languages other than TypeScript', () => {
    const { context } = createContext({
      configuration: {
        project: {
          name: 'my-project',
          type: 'serviceContainer',
          language: 'javascript',
        },
      },
      functions: [TypeScriptGetDecoratorRendererForGoogleFirestore],
    });

    expect(() =>
      context.call(TypeScriptGetDecoratorRenderer, {
        generator: 'typescriptModelClass',
        configuration: {},
      }),
    ).toThrow(NoImplementationFoundError);
  });

  it('should not support a generator other than typescriptModelClass', () => {
    const { context } = createContext({
      configuration: {
        project: {
          name: 'my-project',
          type: 'serviceContainer',
          language: 'typescript',
        },
      },
      functions: [TypeScriptGetDecoratorRendererForGoogleFirestore],
    });

    expect(() =>
      context.call(TypeScriptGetDecoratorRenderer, {
        generator: '🤖',
        configuration: {},
      }),
    ).toThrow(NoImplementationFoundError);
  });

  it('should return the renderer', () => {
    const { context } = createContext({
      configuration: {
        project: {
          name: 'my-project',
          type: 'serviceContainer',
          language: 'typescript',
        },
      },
      functions: [TypeScriptGetDecoratorRendererForGoogleFirestore],
    });

    const actualRenderer = context.call(TypeScriptGetDecoratorRenderer, {
      generator: 'typescriptModelClass',
      configuration: {},
    });

    expect(actualRenderer).toBe(GoogleFirestoreRenderer);
  });
});

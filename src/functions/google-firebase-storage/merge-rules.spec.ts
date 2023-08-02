import { WorkspaceContext } from '@causa/workspace';
import { createContext } from '@causa/workspace/testing';
import { jest } from '@jest/globals';
import 'jest-extended';

const mergeFirebaseRulesFilesMock = jest.fn(async () => '');
jest.unstable_mockModule('../../firebase/index.js', () => ({
  mergeFirebaseRulesFiles: mergeFirebaseRulesFilesMock,
}));

describe('GoogleFirebaseStorageMergeRules', () => {
  let context: WorkspaceContext;
  let GoogleFirebaseStorageMergeRules: any;

  beforeEach(async () => {
    ({ GoogleFirebaseStorageMergeRules } = await import('./merge-rules.js'));
    ({ context } = createContext({
      configuration: {
        workspace: { name: '🏷️' },
        google: {
          firebaseStorage: {
            securityRuleFile: 'output',
            securityRuleFiles: ['**/*.rules'],
          },
        },
      },
      functions: [GoogleFirebaseStorageMergeRules],
    }));
  });

  it('should call mergeFirebaseRulesFiles', async () => {
    mergeFirebaseRulesFilesMock.mockResolvedValue('/abs/path/output');

    const actualResult = await context.call(
      GoogleFirebaseStorageMergeRules,
      {},
    );

    expect(actualResult).toEqual({
      configuration: {
        google: { firebaseStorage: { securityRuleFile: '/abs/path/output' } },
      },
      securityRuleFile: '/abs/path/output',
    });
    expect(mergeFirebaseRulesFilesMock).toHaveBeenCalledExactlyOnceWith(
      'Firebase Storage',
      ['**/*.rules'],
      expect.any(Function),
      'output',
      context,
    );
    const actualTemplate = (
      mergeFirebaseRulesFilesMock.mock.calls[0] as any
    )[2];
    expect(actualTemplate('🛂')).toEqual(
      `rules_version = '2';

service firebase.storage {
  match /b/{bucket}/o {
🛂
  }
}
`,
    );
  });

  it('should not merge files during teardown', async () => {
    const actualResult = await context.call(GoogleFirebaseStorageMergeRules, {
      tearDown: true,
    });

    expect(actualResult).toEqual({
      configuration: {},
      securityRuleFile: null,
    });
    expect(mergeFirebaseRulesFilesMock).not.toHaveBeenCalled();
  });
});

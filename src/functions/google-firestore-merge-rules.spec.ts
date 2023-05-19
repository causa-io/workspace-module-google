import { WorkspaceContext } from '@causa/workspace';
import { createContext } from '@causa/workspace/testing';
import { jest } from '@jest/globals';
import 'jest-extended';

const mergeFirebaseRulesFilesMock = jest.fn(async () => '');
jest.unstable_mockModule('../firebase/index.js', () => ({
  mergeFirebaseRulesFiles: mergeFirebaseRulesFilesMock,
}));

describe('GoogleFirestoreMergeRules', () => {
  let context: WorkspaceContext;
  let GoogleFirestoreMergeRules: any;

  beforeEach(async () => {
    ({ GoogleFirestoreMergeRules } = await import(
      './google-firestore-merge-rules.js'
    ));
    ({ context } = createContext({
      configuration: {
        workspace: { name: '🏷️' },
        google: {
          firestore: {
            securityRuleFile: 'output',
            securityRuleFiles: ['**/*.rules'],
          },
        },
      },
      functions: [GoogleFirestoreMergeRules],
    }));
  });

  it('should call mergeFirebaseRulesFiles', async () => {
    mergeFirebaseRulesFilesMock.mockResolvedValue('/abs/path/output');

    const actualResult = await context.call(GoogleFirestoreMergeRules, {});

    expect(actualResult).toEqual({
      configuration: {
        google: { firestore: { securityRuleFile: '/abs/path/output' } },
      },
      securityRuleFile: '/abs/path/output',
    });
    expect(mergeFirebaseRulesFilesMock).toHaveBeenCalledOnceWith(
      'Firestore',
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

service cloud.firestore {
  match /databases/{database}/documents {
🛂
  }
}
`,
    );
  });
});

import { WorkspaceContext } from '@causa/workspace';
import { createContext } from '@causa/workspace/testing';
import { jest } from '@jest/globals';
import 'jest-extended';
import { FirebaseAppService } from '../services/index.js';
import type { GoogleIdentityPlatformGenerateCustomToken as GoogleIdentityPlatformGenerateCustomTokenType } from './google-identity-platform-generate-custom-token.js';

const firebaseAdminAppMock = {};
const authMock = {
  createCustomToken: jest.fn((_user: string, _claims: Record<string, any>) =>
    Promise.resolve('🗝️'),
  ),
};
jest.unstable_mockModule('firebase-admin/auth', () => ({
  getAuth: () => authMock,
}));

describe('GoogleIdentityPlatformGenerateCustomToken', () => {
  let context: WorkspaceContext;
  let GoogleIdentityPlatformGenerateCustomToken: typeof GoogleIdentityPlatformGenerateCustomTokenType;
  let firebaseAppService: FirebaseAppService;

  beforeEach(async () => {
    ({ GoogleIdentityPlatformGenerateCustomToken } = await import(
      './google-identity-platform-generate-custom-token.js'
    ));
    ({ context } = createContext({
      configuration: {
        workspace: { name: 'test' },
        google: { project: 'my-project' },
      },
      functions: [GoogleIdentityPlatformGenerateCustomToken],
    }));
    firebaseAppService = context.service(FirebaseAppService);
    jest
      .spyOn(firebaseAppService, 'getAdminAppForAdminServiceAccount')
      .mockResolvedValue(firebaseAdminAppMock as any);
  });

  it('should generate a token for the specified user', async () => {
    const actualToken = await context.call(
      GoogleIdentityPlatformGenerateCustomToken,
      { user: 'bob', claims: { admin: true } },
    );

    expect(actualToken).toEqual('🗝️');
    expect(authMock.createCustomToken).toHaveBeenCalledOnceWith('bob', {
      admin: true,
    });
  });
});

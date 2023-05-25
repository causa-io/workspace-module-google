import { runCli } from '@causa/cli';
import { WorkspaceContext } from '@causa/workspace';
import { FunctionRegistry } from '@causa/workspace/function-registry';
import { createContext, registerMockFunction } from '@causa/workspace/testing';
import { jest } from '@jest/globals';
import 'jest-extended';
import type { GoogleIdentityPlatformGenerateToken as GoogleIdentityPlatformGenerateTokenType } from './google-identity-platform-generate-token.js';

const firebaseAppMock = {};
const authMock = {};
const signInWithCustomTokenMock = jest.fn(() =>
  Promise.resolve({
    user: { getIdToken: jest.fn(() => Promise.resolve('🗝️')) },
  }),
);

jest.unstable_mockModule('firebase/auth', () => ({
  getAuth: () => authMock,
  signInWithCustomToken: signInWithCustomTokenMock,
}));

describe('GoogleIdentityPlatformGenerateToken', () => {
  let context: WorkspaceContext;
  let functionRegistry: FunctionRegistry<WorkspaceContext>;
  let GoogleIdentityPlatformGenerateToken: typeof GoogleIdentityPlatformGenerateTokenType;

  beforeEach(async () => {
    ({ GoogleIdentityPlatformGenerateToken } = await import(
      './google-identity-platform-generate-token.js'
    ));
    const { GoogleIdentityPlatformGenerateCustomToken } = await import(
      './google-identity-platform-generate-custom-token.js'
    );

    ({ context, functionRegistry } = createContext({
      configuration: {
        workspace: { name: 'test' },
        google: { project: 'my-project' },
      },
      functions: [GoogleIdentityPlatformGenerateToken],
    }));

    registerMockFunction(
      functionRegistry,
      GoogleIdentityPlatformGenerateCustomToken,
      async (_, { user, claims }) =>
        `🔑 ${JSON.stringify({ user, ...claims })}`,
    );

    const { FirebaseAppService } = await import('../services/index.js');
    jest
      .spyOn(context.service(FirebaseAppService), 'getApp')
      .mockResolvedValue(firebaseAppMock as any);
  });

  it('should generate a token using the custom token', async () => {
    const actualToken = await context.call(
      GoogleIdentityPlatformGenerateToken,
      {
        user: 'bob',
        claims: { admin: true },
      },
    );

    expect(actualToken).toEqual('🗝️');
    expect(signInWithCustomTokenMock).toHaveBeenCalledOnceWith(
      authMock,
      '🔑 {"user":"bob","admin":true}',
    );
  });

  it('should expose the google identityPlatform genToken command', async () => {
    jest.spyOn(console, 'log');

    const actualExitCode = await runCli(
      [
        'google',
        'identityPlatform',
        'genToken',
        'bob',
        '--claims',
        '{"admin":true}',
      ],
      context,
    );

    expect(console.log).toHaveBeenCalledWith('🗝️');
    expect(actualExitCode).toEqual(0);
    expect(signInWithCustomTokenMock).toHaveBeenCalledOnceWith(
      authMock,
      '🔑 {"user":"bob","admin":true}',
    );
  });
});

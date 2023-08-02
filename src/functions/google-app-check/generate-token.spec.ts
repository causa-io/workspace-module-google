import { runCli } from '@causa/cli';
import { WorkspaceContext } from '@causa/workspace';
import { createContext } from '@causa/workspace/testing';
import { jest } from '@jest/globals';
import 'jest-extended';
import { FirebaseAppService } from '../../services/index.js';
import type { GoogleAppCheckGenerateToken as GoogleAppCheckGenerateTokenType } from './generate-token.js';

const firebaseAdminAppMock = {};
const appCheckMock = {
  createToken: jest.fn(() => Promise.resolve({ token: '🗝️' })),
};
jest.unstable_mockModule('firebase-admin/app-check', () => ({
  getAppCheck: () => appCheckMock,
}));

describe('GoogleAppCheckGenerateToken', () => {
  let context: WorkspaceContext;
  let firebaseAppService: FirebaseAppService;
  let GoogleAppCheckGenerateToken: typeof GoogleAppCheckGenerateTokenType;

  beforeEach(async () => {
    ({ GoogleAppCheckGenerateToken } = await import('./generate-token.js'));
    ({ context } = createContext({
      configuration: {
        workspace: { name: 'test' },
        google: { project: 'my-project' },
      },
      functions: [GoogleAppCheckGenerateToken],
    }));
    firebaseAppService = context.service(FirebaseAppService);
    jest
      .spyOn(firebaseAppService, 'getAdminAppForAdminServiceAccount')
      .mockResolvedValue(firebaseAdminAppMock as any);
    jest.spyOn(firebaseAppService, 'getAppId').mockResolvedValue('🍏');
  });

  it('should generate a token for the specified app', async () => {
    const actualToken = await context.call(GoogleAppCheckGenerateToken, {
      app: '🤖',
    });

    expect(actualToken).toEqual('🗝️');
    expect(appCheckMock.createToken).toHaveBeenCalledExactlyOnceWith('🤖', {
      ttlMillis: expect.any(Number),
    });
  });

  it('should generate a token for the configured app', async () => {
    const actualToken = await context.call(GoogleAppCheckGenerateToken, {});

    expect(actualToken).toEqual('🗝️');
    expect(appCheckMock.createToken).toHaveBeenCalledExactlyOnceWith('🍏', {
      ttlMillis: expect.any(Number),
    });
  });

  it('should expose the google appCheck genToken command', async () => {
    jest.spyOn(console, 'log');

    const actualExitCode = await runCli(
      ['google', 'appCheck', 'genToken', '-a', '🤖'],
      context,
    );

    expect(console.log).toHaveBeenCalledWith('🗝️');
    expect(actualExitCode).toEqual(0);
    expect(appCheckMock.createToken).toHaveBeenCalledExactlyOnceWith('🤖', {
      ttlMillis: expect.any(Number),
    });
  });
});

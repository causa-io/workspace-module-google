import { SecretBackendNotFoundError, WorkspaceContext } from '@causa/workspace';
import { createContext } from '@causa/workspace/testing';
import { jest } from '@jest/globals';
import 'jest-extended';
import { GoogleApisService } from '../../services/index.js';
import {
  AuthClientResponseError,
  SecretFetchForGoogleAccessToken,
} from './fetch-access-token.js';

describe('SecretFetchForGoogleAccessToken', () => {
  let context: WorkspaceContext;
  let googleApisService: GoogleApisService;

  beforeEach(() => {
    ({ context } = createContext({
      configuration: {
        workspace: { name: '🏷️' },
        secrets: {
          gcpAccessToken: { backend: 'google.accessToken' },
          notGoogle: { backend: '❌' },
        },
      },
      functions: [SecretFetchForGoogleAccessToken],
    }));
    googleApisService = context.service(GoogleApisService);
  });

  it('should not handle secrets with other backends', async () => {
    const actualPromise = context.secret('notGoogle');

    await expect(actualPromise).rejects.toThrow(SecretBackendNotFoundError);
  });

  it('should return an error if the auth client does not return a token', async () => {
    const getAccessToken = jest.fn(() => Promise.resolve({}));
    jest.spyOn(googleApisService, 'getAuthClient').mockResolvedValue({
      getAccessToken,
    } as any);

    const actualPromise = context.secret('gcpAccessToken');

    await expect(actualPromise).rejects.toThrow(AuthClientResponseError);
    expect(googleApisService.getAuthClient).toHaveBeenCalledExactlyOnceWith();
    expect(getAccessToken).toHaveBeenCalledExactlyOnceWith();
  });

  it('should return an access token', async () => {
    const expectedSecret = '🗝️';
    const getAccessToken = jest.fn(() =>
      Promise.resolve({ token: expectedSecret }),
    );
    jest.spyOn(googleApisService, 'getAuthClient').mockResolvedValue({
      getAccessToken,
    } as any);

    const actualSecret = await context.secret('gcpAccessToken');

    expect(actualSecret).toEqual(expectedSecret);
    expect(googleApisService.getAuthClient).toHaveBeenCalledExactlyOnceWith();
    expect(getAccessToken).toHaveBeenCalledExactlyOnceWith();
  });
});

import { WorkspaceContext } from '@causa/workspace';
import { createContext } from '@causa/workspace/testing';
import { jest } from '@jest/globals';
import { iam_v1 } from 'googleapis';
import 'jest-extended';
import {
  FirebaseAdminServiceAccountNotFoundError,
  NoFirebaseAppFoundError,
} from './firebase-app.errors.js';
import type { FirebaseAppService as FirebaseAppServiceType } from './firebase-app.js';
import { GoogleApisService } from './google-apis.js';

class ApiKeysClientMock {
  async *listKeysAsync(request: { parent: string }) {
    yield {
      name: `${request.parent}/keys/custom-key`,
      displayName: 'Custom key',
    };
    yield {
      name: `${request.parent}/keys/firebase-key`,
      displayName: 'iOS key (auto created by Firebase)',
    };
  }

  async getKeyString(request: {
    name: string;
  }): Promise<[{ keyString: string }]> {
    return [{ keyString: `${request.name} 🔑` }];
  }
}

const expectedApp = {};
const initializeAppMock = jest.fn(() => expectedApp);
const expectedAdminApp = {};
const initializeAdminAppMock = jest.fn(() => expectedAdminApp);
jest.unstable_mockModule('@google-cloud/apikeys', () => ({
  ApiKeysClient: ApiKeysClientMock,
}));
jest.unstable_mockModule('firebase/app', () => ({
  initializeApp: initializeAppMock,
}));
jest.unstable_mockModule('firebase-admin/app', () => ({
  initializeApp: initializeAdminAppMock,
}));

describe('FirebaseAppService', () => {
  let context: WorkspaceContext;
  let FirebaseAppService: typeof FirebaseAppServiceType;
  let service: FirebaseAppServiceType;

  beforeEach(async () => {
    ({ context } = createContext({
      configuration: {
        workspace: { name: '️my-workspace' },
        google: {
          project: 'my-project',
          firebase: {
            apiKey: 'ABCD',
            adminServiceAccount: 'bob@my-project.gcp.com',
            appId: '1:123:web:123',
          },
        },
      },
    }));
    ({ FirebaseAppService } = await import('./firebase-app.js'));
    service = context.service(FirebaseAppService);
  });

  describe('getApiKey', () => {
    it('should return the API key from the configuration', async () => {
      const actualKey = await service.getApiKey();

      expect(actualKey).toEqual('ABCD');
    });

    it('should find the API key using the API keys API', async () => {
      ({ context } = createContext({
        configuration: {
          workspace: { name: '️my-workspace' },
          google: { project: 'my-project' },
        },
      }));
      service = context.service(FirebaseAppService);

      const actualKey = await service.getApiKey();

      expect(actualKey).toEqual(
        'projects/my-project/locations/global/keys/firebase-key 🔑',
      );
    });
  });

  describe('getApp', () => {
    it('should return a correctly initialized app', async () => {
      const actualApp = await service.getApp();

      expect(actualApp).toBe(expectedApp);
      expect(initializeAppMock).toHaveBeenCalledWith(
        {
          projectId: 'my-project',
          apiKey: 'ABCD',
          authDomain: 'my-project.firebaseapp.com',
        },
        expect.any(String),
      );
    });

    it('should cache the app', async () => {
      const actualApp = await service.getApp();
      const actualApp2 = await service.getApp();

      expect(actualApp).toBe(expectedApp);
      expect(actualApp).toBe(actualApp2);
    });
  });

  describe('getAdminServiceAccount', () => {
    it('should return the service account from the configuration', async () => {
      const actualServiceAccount = await service.getAdminServiceAccount();

      expect(actualServiceAccount).toEqual('bob@my-project.gcp.com');
    });

    it('should find the admin service account using the IAM API', async () => {
      ({ context } = createContext({
        configuration: {
          workspace: { name: '️my-workspace' },
          google: { project: 'my-project' },
        },
      }));
      service = context.service(FirebaseAppService);
      const iamClientMock = mockIamClient([
        'nope@my-project.iam.gserviceaccount.com',
        'firebase-adminsdk-abc123@my-project.iam.gserviceaccount.com',
      ]);

      const actualServiceAccount = await service.getAdminServiceAccount();

      expect(actualServiceAccount).toEqual(
        'firebase-adminsdk-abc123@my-project.iam.gserviceaccount.com',
      );
      expect(
        iamClientMock.projects.serviceAccounts.list,
      ).toHaveBeenCalledOnceWith({
        name: 'projects/my-project',
        pageSize: expect.any(Number),
        pageToken: undefined,
      });
    });

    it('should throw when the admin service account cannot be found', async () => {
      ({ context } = createContext({
        configuration: {
          workspace: { name: '️my-workspace' },
          google: { project: 'my-project' },
        },
      }));
      service = context.service(FirebaseAppService);
      const iamClientMock = mockIamClient([
        'nope@my-project.iam.gserviceaccount.com',
      ]);

      const actualPromise = service.getAdminServiceAccount();

      await expect(actualPromise).rejects.toThrow(
        FirebaseAdminServiceAccountNotFoundError,
      );
      expect(
        iamClientMock.projects.serviceAccounts.list,
      ).toHaveBeenCalledOnceWith({
        name: 'projects/my-project',
        pageSize: expect.any(Number),
        pageToken: undefined,
      });
    });

    function mockIamClient(emails: string[]): iam_v1.Iam {
      const googleApisService = context.service(GoogleApisService);
      const iamClientMock = {
        projects: {
          serviceAccounts: {
            list: jest.fn(() => ({
              data: { accounts: emails.map((email) => ({ email })) },
            })),
          },
        },
      };
      jest
        .spyOn(googleApisService, 'getClient')
        .mockReturnValue(iamClientMock as any);
      return iamClientMock as any;
    }
  });

  describe('getAdminAppForAdminServiceAccount', () => {
    const iamCredentialsMock = {
      projects: {
        serviceAccounts: {
          generateAccessToken: jest.fn(() =>
            Promise.resolve({
              data: {
                expireTime: '2999-01-01T00:00:00.000Z',
                accessToken: '🔑',
              },
            }),
          ),
        },
      },
    };
    beforeEach(() => {
      const googleApisService = context.service(GoogleApisService);
      jest
        .spyOn(googleApisService, 'getClient')
        .mockReturnValue(iamCredentialsMock as any);
    });

    it('should return the admin Firebase app initialized with the admin account', async () => {
      const actualApp = await service.getAdminAppForAdminServiceAccount();

      expect(actualApp).toBe(expectedAdminApp);
      expect(initializeAdminAppMock).toHaveBeenCalledWith(
        {
          projectId: 'my-project',
          serviceAccountId: 'bob@my-project.gcp.com',
          credential: expect.anything(),
        },
        expect.any(String),
      );

      const actualToken = await (
        initializeAdminAppMock.mock.calls[0] as any
      )[0].credential.getAccessToken();

      expect(actualToken).toEqual({
        access_token: '🔑',
        expires_in: expect.any(Number),
      });
      expect(
        iamCredentialsMock.projects.serviceAccounts.generateAccessToken,
      ).toHaveBeenCalledOnceWith({
        name: 'projects/-/serviceAccounts/bob@my-project.gcp.com',
        requestBody: {
          scope: ['https://www.googleapis.com/auth/cloud-platform'],
        },
      });
    });

    it('should cache the app', async () => {
      const actualApp = await service.getAdminAppForAdminServiceAccount();
      const actualApp2 = await service.getAdminAppForAdminServiceAccount();

      expect(actualApp).toBe(expectedAdminApp);
      expect(actualApp).toBe(actualApp2);
    });
  });

  describe('getAnyAppId', () => {
    const firebaseClientMock = {
      projects: {
        androidApps: {
          list: jest.fn(() =>
            Promise.resolve({ data: { apps: [{ appId: '🤖' }] } }),
          ),
        },
        iosApps: {
          list: jest.fn(() =>
            Promise.resolve({ data: { apps: [{ appId: '🍏' }] } }),
          ),
        },
        webApps: {
          list: jest.fn(() =>
            Promise.resolve({ data: { apps: [{ appId: '🌍' }] } }),
          ),
        },
      },
    };

    beforeEach(() => {
      const googleApisService = context.service(GoogleApisService);
      jest
        .spyOn(googleApisService, 'getClient')
        .mockReturnValue(firebaseClientMock as any);
    });

    it('should return any of the apps', async () => {
      const actualAppId = await service.getAnyAppId();

      expect(actualAppId).toBeOneOf(['🤖', '🍏', '🌍']);
    });

    it('should throw when no apps are found', async () => {
      firebaseClientMock.projects.androidApps.list.mockResolvedValueOnce({
        data: { apps: [] },
      } as any);
      firebaseClientMock.projects.iosApps.list.mockResolvedValueOnce({
        data: { apps: [] },
      } as any);
      firebaseClientMock.projects.webApps.list.mockResolvedValueOnce({
        data: { apps: [] },
      } as any);

      const actualPromise = service.getAnyAppId();

      await expect(actualPromise).rejects.toThrow(NoFirebaseAppFoundError);
    });

    it('should only return an app of the requested type', async () => {
      const actualAppId = await service.getAnyAppId({ appTypes: ['iosApps'] });

      expect(actualAppId).toEqual('🍏');
    });
  });

  describe('getAppId', () => {
    it('should return the app ID from the configuration', async () => {
      const actualAppId = await service.getAppId();

      expect(actualAppId).toEqual('1:123:web:123');
    });

    it('should get any app ID when none is configured', async () => {
      ({ context } = createContext({
        configuration: {
          workspace: { name: '️my-workspace' },
          google: { project: 'my-project' },
        },
      }));
      service = context.service(FirebaseAppService);
      jest.spyOn(service, 'getAnyAppId').mockResolvedValueOnce('🍏');

      const actualAppId = await service.getAppId();

      expect(actualAppId).toEqual('🍏');
      expect(service.getAnyAppId).toHaveBeenCalledOnceWith();
    });

    it('should cache the app ID', async () => {
      ({ context } = createContext({
        configuration: {
          workspace: { name: '️my-workspace' },
          google: { project: 'my-project' },
        },
      }));
      service = context.service(FirebaseAppService);
      jest.spyOn(service, 'getAnyAppId').mockResolvedValueOnce('🍏');

      const actualAppId = await service.getAppId();
      const actualAppId2 = await service.getAppId();

      expect(actualAppId).toEqual('🍏');
      expect(actualAppId2).toEqual('🍏');
      expect(service.getAnyAppId).toHaveBeenCalledOnceWith();
    });
  });
});

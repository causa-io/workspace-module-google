import { WorkspaceContext } from '@causa/workspace';
import { createContext } from '@causa/workspace/testing';
import { jest } from '@jest/globals';

class GoogleAuthMock {
  constructor(readonly options: any) {}

  async getClient() {
    return this.options;
  }
}

const someClientMock = jest.fn();

jest.unstable_mockModule('googleapis', () => ({
  google: { auth: { GoogleAuth: GoogleAuthMock }, someClient: someClientMock },
}));

describe('GoogleApisService', () => {
  let context: WorkspaceContext;
  let service: any;

  beforeEach(async () => {
    ({ context } = createContext({
      configuration: {
        workspace: { name: 'test' },
        google: { project: 'some-project' },
      },
    }));
    const { GoogleApisService } = await import('./google-apis.js');
    service = context.service(GoogleApisService);
  });

  describe('getAuthClient', () => {
    it('should return the auth client for the correct project', async () => {
      const actualClient = await service.getAuthClient();

      // This is not a real client, but the `GoogleApisService` should have instantiated the mock, which returns the
      // options passed to the constructor.
      expect(actualClient).toEqual({
        projectId: 'some-project',
        scopes: ['https://www.googleapis.com/auth/cloud-platform'],
      });
    });

    it('should cache the auth client', async () => {
      const actualClient1 = await service.getAuthClient();
      const actualClient2 = await service.getAuthClient();

      expect(actualClient1).toBe(actualClient2);
    });
  });

  describe('getClient', () => {
    it('should return a client initialized with the correct version and auth client', async () => {
      const expectedClient = { client: '🎁' };
      someClientMock.mockReturnValueOnce(expectedClient);
      const authClient = await service.getAuthClient();

      const actualClient = await service.getClient('someClient', 'v1', {
        someOption: '🔧',
      });

      expect(actualClient).toBe(expectedClient);
      expect(someClientMock).toHaveBeenCalledWith({
        someOption: '🔧',
        version: 'v1',
        auth: authClient,
      });
    });
  });
});

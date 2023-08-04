import { WorkspaceContext } from '@causa/workspace';
import { createContext } from '@causa/workspace/testing';
import { jest } from '@jest/globals';
import { iam_v1 } from 'googleapis';
import 'jest-extended';
import { GoogleApisService } from './google-apis.js';
import { IamService } from './iam.js';

describe('IamService', () => {
  let context: WorkspaceContext;
  let service: IamService;

  beforeEach(() => {
    ({ context } = createContext({
      configuration: {
        google: { project: 'my-project' },
      },
    }));
    service = context.service(IamService);
  });

  function mockIamClient(
    options: {
      createdAccount?: iam_v1.Schema$ServiceAccount;
      existingPolicy?: iam_v1.Schema$Policy;
    } = {},
  ): iam_v1.Iam {
    const googleApisService = context.service(GoogleApisService);
    const iamClientMock = {
      projects: {
        serviceAccounts: {
          create: jest.fn(async () => ({ data: options.createdAccount })),
          getIamPolicy: jest.fn(async () => ({ data: options.existingPolicy })),
          setIamPolicy: jest.fn(() => Promise.resolve()),
          delete: jest.fn(() => Promise.resolve()),
        },
      },
    };
    jest
      .spyOn(googleApisService, 'getClient')
      .mockImplementation(
        (api) => (api === 'iam' ? iamClientMock : undefined) as any,
      );
    return iamClientMock as any;
  }

  describe('createServiceAccount', () => {
    it('should create a service account', async () => {
      const expectedAccount: iam_v1.Schema$ServiceAccount = {
        name: 'projects/my-project/serviceAccounts/my-account',
      };
      const iamMock = mockIamClient({ createdAccount: expectedAccount });

      const actualServiceAccount = await service.createServiceAccount(
        'my-project',
        'my-account',
      );

      expect(actualServiceAccount).toEqual(expectedAccount);
      expect(
        iamMock.projects.serviceAccounts.create,
      ).toHaveBeenCalledExactlyOnceWith({
        name: 'projects/my-project',
        requestBody: { accountId: 'my-account' },
      });
      expect(
        iamMock.projects.serviceAccounts.getIamPolicy,
      ).not.toHaveBeenCalled();
      expect(
        iamMock.projects.serviceAccounts.setIamPolicy,
      ).not.toHaveBeenCalled();
    });

    it('should set the bindings for the service account', async () => {
      const expectedAccount: iam_v1.Schema$ServiceAccount = {
        name: 'projects/my-project/serviceAccounts/my-account',
      };
      const existingPolicy: iam_v1.Schema$Policy = {
        version: 1,
        etag: 'ABCD',
        bindings: [{ role: 'roles/someRole', members: ['serviceAccount:bob'] }],
      };
      const iamMock = mockIamClient({
        createdAccount: expectedAccount,
        existingPolicy,
      });

      const actualServiceAccount = await service.createServiceAccount(
        'my-project',
        'my-account',
        {
          bindings: [
            { role: 'roles/otherRole', members: ['serviceAccount:alice'] },
          ],
        },
      );

      expect(actualServiceAccount).toEqual(expectedAccount);
      expect(
        iamMock.projects.serviceAccounts.create,
      ).toHaveBeenCalledExactlyOnceWith({
        name: 'projects/my-project',
        requestBody: { accountId: 'my-account' },
      });
      expect(
        iamMock.projects.serviceAccounts.getIamPolicy,
      ).toHaveBeenCalledExactlyOnceWith({
        resource: expectedAccount.name,
      });
      expect(
        iamMock.projects.serviceAccounts.setIamPolicy,
      ).toHaveBeenCalledExactlyOnceWith({
        resource: expectedAccount.name,
        requestBody: {
          policy: {
            version: 1,
            etag: 'ABCD',
            bindings: [
              { role: 'roles/someRole', members: ['serviceAccount:bob'] },
              { role: 'roles/otherRole', members: ['serviceAccount:alice'] },
            ],
          },
        },
      });
    });
  });

  describe('deleteServiceAccount', () => {
    it('should delete a service account', async () => {
      const iamMock = mockIamClient();

      await service.deleteServiceAccount(
        'projects/my-project/serviceAccounts/my-account',
      );

      expect(
        iamMock.projects.serviceAccounts.delete,
      ).toHaveBeenCalledExactlyOnceWith({
        name: 'projects/my-project/serviceAccounts/my-account',
      });
    });
  });
});

import { WorkspaceContext } from '@causa/workspace';
import { jest } from '@jest/globals';
import 'jest-extended';
import { CloudRunService } from '../../../services/index.js';
import { makeContext, makeEnvironment } from '../fixture.test.js';
import { googleCloudRun } from './cloud-run.js';

describe('googleCloudRun', () => {
  let context: WorkspaceContext;
  let listServices: jest.Mock<(request: any) => Promise<any>>;

  beforeEach(() => {
    context = makeContext();
    listServices = jest.fn(async () => [
      [
        {
          name: 'projects/my-project/locations/europe-west1/services/ordering-api',
          template: { containers: [{ image: 'ordering:1.2.3' }] },
          updateTime: { seconds: '1790856000', nanos: 0 },
          terminalCondition: { type: 'Ready', state: 'CONDITION_SUCCEEDED' },
        },
      ],
    ]);
    jest
      .spyOn(context.service(CloudRunService).servicesClient, 'initialize')
      .mockResolvedValue({});
    jest
      .spyOn(context.service(CloudRunService).servicesClient, 'listServices')
      .mockImplementation(listServices as any);
  });

  it('should return the deployments of services', async () => {
    const actualOutput = await googleCloudRun.fetch(
      await makeEnvironment(context),
    );

    expect(actualOutput).toEqual({
      nodes: {
        'service:domains/ordering/api#ordering-api': {
          data: {
            deployment: {
              image: 'ordering:1.2.3',
              updatedAt: new Date('2026-10-01T12:00:00Z'),
              status: 'deployed',
            },
          },
        },
      },
      warnings: [
        {
          message:
            "The Cloud Run service 'projects/my-project/locations/europe-west1/services/ordering-events' of 'service:domains/ordering/api#ordering-events' does not exist.",
        },
      ],
    });
    expect(listServices).toHaveBeenCalledExactlyOnceWith({
      parent: 'projects/my-project/locations/europe-west1',
    });
  });

  it('should warn when a service was updated after the end of the window', async () => {
    listServices.mockResolvedValueOnce([
      [
        {
          name: 'projects/my-project/locations/europe-west1/services/ordering-api',
          template: { containers: [{ image: 'ordering:1.2.4' }] },
          updateTime: { seconds: '1790857800', nanos: 0 },
        },
      ],
    ]);

    const actualOutput = await googleCloudRun.fetch(
      await makeEnvironment(context),
    );

    expect(
      actualOutput.nodes?.['service:domains/ordering/api#ordering-api'],
    ).toEqual({
      data: {
        deployment: {
          image: 'ordering:1.2.4',
          updatedAt: new Date('2026-10-01T12:30:00Z'),
        },
      },
    });
    expect(actualOutput.warnings).toContainEqual({
      message:
        "The Cloud Run service 'projects/my-project/locations/europe-west1/services/ordering-api' of 'service:domains/ordering/api#ordering-api' was updated at 2026-10-01T12:30:00.000Z, after the end of the evaluation window. Its deployment is the current one.",
    });
  });

  it.each([
    ['CONDITION_PENDING', 'deploying'],
    ['CONDITION_RECONCILING', 'deploying'],
    [2, 'deploying'],
    ['CONDITION_FAILED', 'failed'],
    [4, 'deployed'],
  ])(
    'should map the %s state of the Ready condition to the %s status',
    async (state, expectedStatus) => {
      listServices.mockResolvedValueOnce([
        [
          {
            name: 'projects/my-project/locations/europe-west1/services/ordering-api',
            terminalCondition: { type: 'Ready', state, message: '💬' },
          },
        ],
      ]);

      const actualOutput = await googleCloudRun.fetch(
        await makeEnvironment(context),
      );

      expect(
        actualOutput.nodes?.['service:domains/ordering/api#ordering-api'],
      ).toEqual({
        data: { deployment: { status: expectedStatus, message: '💬' } },
      });
    },
  );

  it('should not return a status for an unspecified state', async () => {
    listServices.mockResolvedValueOnce([
      [
        {
          name: 'projects/my-project/locations/europe-west1/services/ordering-api',
          terminalCondition: {
            type: 'Ready',
            state: 'STATE_UNSPECIFIED',
            message: '💬',
          },
        },
      ],
    ]);

    const actualOutput = await googleCloudRun.fetch(
      await makeEnvironment(context),
    );

    expect(
      actualOutput.nodes?.['service:domains/ordering/api#ordering-api'],
    ).toEqual({ data: { deployment: {} } });
  });

  it('should warn when services cannot be listed', async () => {
    listServices.mockRejectedValueOnce(new Error('💥'));

    const actualOutput = await googleCloudRun.fetch(
      await makeEnvironment(context),
    );

    expect(actualOutput).toEqual({
      nodes: {},
      warnings: [
        {
          message:
            "Failed to list the Cloud Run services in 'projects/my-project/locations/europe-west1': 💥",
        },
      ],
    });
  });
});

import { WorkspaceContext } from '@causa/workspace';
import { jest } from '@jest/globals';
import 'jest-extended';
import { GoogleApisService } from '../../../services/index.js';
import { makeContext, makeEnvironment } from '../fixture.test.js';
import { googleCloudScheduler } from './cloud-scheduler.js';

const JOB_NAME =
  'projects/my-project/locations/europe-west1/jobs/run-ordering-events-expireOrders';

describe('googleCloudScheduler', () => {
  let context: WorkspaceContext;
  let list: jest.Mock<(request: any) => Promise<any>>;

  beforeEach(() => {
    context = makeContext();
    list = jest.fn(async () => ({ data: { jobs: [] } }));
    jest
      .spyOn(context.service(GoogleApisService), 'getClient')
      .mockImplementation(
        async () =>
          ({
            projects: { locations: { jobs: { list } } },
          }) as never,
      );
  });

  it('should return the last attempt and next run of enabled jobs', async () => {
    list.mockResolvedValueOnce({
      data: {
        jobs: [
          {
            name: JOB_NAME,
            state: 'ENABLED',
            lastAttemptTime: '2026-10-01T11:00:00Z',
            status: { code: 14, message: 'Unavailable.' },
            scheduleTime: '2026-10-01T13:00:00Z',
          },
        ],
      },
    });

    const actualOutput = await googleCloudScheduler.fetch(
      await makeEnvironment(context),
    );

    expect(actualOutput).toEqual({
      nodes: {
        'scheduledJob:domains/ordering/api#expireOrders': {
          data: {
            lastAttempt: {
              time: new Date('2026-10-01T11:00:00Z'),
              status: 'failed',
              message: 'Unavailable.',
            },
            nextRun: new Date('2026-10-01T13:00:00Z'),
          },
        },
      },
      warnings: [],
    });
    expect(list).toHaveBeenCalledExactlyOnceWith({
      parent: 'projects/my-project/locations/europe-west1',
      pageSize: 500,
    });
  });

  it('should warn when a job was attempted after the end of the window', async () => {
    list.mockResolvedValueOnce({
      data: {
        jobs: [
          {
            name: JOB_NAME,
            state: 'ENABLED',
            lastAttemptTime: '2026-10-01T12:30:00Z',
            scheduleTime: '2026-10-01T13:30:00Z',
          },
        ],
      },
    });

    const actualOutput = await googleCloudScheduler.fetch(
      await makeEnvironment(context),
    );

    expect(actualOutput).toEqual({
      nodes: {
        'scheduledJob:domains/ordering/api#expireOrders': {
          data: {
            lastAttempt: {
              time: new Date('2026-10-01T12:30:00Z'),
              status: 'succeeded',
            },
            nextRun: new Date('2026-10-01T13:30:00Z'),
          },
        },
      },
      warnings: [
        {
          message: `The Cloud Scheduler job '${JOB_NAME}' of 'scheduledJob:domains/ordering/api#expireOrders' was last attempted at 2026-10-01T12:30:00.000Z, after the end of the evaluation window. Its last attempt and next run are the current ones.`,
        },
      ],
    });
  });

  it('should not return the next run of paused jobs, nor the last attempt of jobs that never ran', async () => {
    list.mockResolvedValueOnce({
      data: {
        jobs: [
          {
            name: JOB_NAME,
            state: 'PAUSED',
            scheduleTime: '2026-10-01T13:00:00Z',
          },
        ],
      },
    });

    const actualOutput = await googleCloudScheduler.fetch(
      await makeEnvironment(context),
    );

    expect(actualOutput.nodes).toEqual({
      'scheduledJob:domains/ordering/api#expireOrders': { data: {} },
    });
  });

  it('should return a successful status when the job has no error', async () => {
    list.mockResolvedValueOnce({
      data: {
        jobs: [
          {
            name: JOB_NAME,
            state: 'ENABLED',
            lastAttemptTime: '2026-10-01T11:00:00Z',
            status: {},
          },
        ],
      },
    });

    const actualOutput = await googleCloudScheduler.fetch(
      await makeEnvironment(context),
    );

    expect(actualOutput.nodes).toEqual({
      'scheduledJob:domains/ordering/api#expireOrders': {
        data: {
          lastAttempt: {
            time: new Date('2026-10-01T11:00:00Z'),
            status: 'succeeded',
          },
        },
      },
    });
  });

  it('should use the name of the code as the message of a failure without one', async () => {
    list.mockResolvedValueOnce({
      data: {
        jobs: [
          {
            name: JOB_NAME,
            state: 'ENABLED',
            lastAttemptTime: '2026-10-01T11:00:00Z',
            status: { code: 5 },
          },
        ],
      },
    });

    const actualOutput = await googleCloudScheduler.fetch(
      await makeEnvironment(context),
    );

    expect(actualOutput.nodes).toEqual({
      'scheduledJob:domains/ordering/api#expireOrders': {
        data: {
          lastAttempt: {
            time: new Date('2026-10-01T11:00:00Z'),
            status: 'failed',
            message: 'NOT_FOUND',
          },
        },
      },
    });
  });

  it('should warn about missing jobs and failures', async () => {
    const actualMissing = await googleCloudScheduler.fetch(
      await makeEnvironment(context),
    );
    list.mockRejectedValueOnce(new Error('💥'));
    const actualFailure = await googleCloudScheduler.fetch(
      await makeEnvironment(context),
    );

    expect(actualMissing).toEqual({
      nodes: {},
      warnings: [
        {
          message: `The Cloud Scheduler job '${JOB_NAME}' of 'scheduledJob:domains/ordering/api#expireOrders' does not exist.`,
        },
      ],
    });
    expect(actualFailure).toEqual({
      nodes: {},
      warnings: [
        {
          message:
            "Failed to list the Cloud Scheduler jobs in 'projects/my-project/locations/europe-west1': 💥",
        },
      ],
    });
  });
});

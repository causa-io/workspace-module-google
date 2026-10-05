import { WorkspaceContext } from '@causa/workspace';
import { GraphAlertSeverity } from '@causa/workspace-core';
import { jest } from '@jest/globals';
import 'jest-extended';
import { GoogleApisService } from '../../../services/index.js';
import {
  ENVIRONMENT_GRAPH,
  makeContext,
  makeEnvironment,
} from '../fixture.test.js';
import { googleErrorReporting } from './error-reporting.js';

describe('googleErrorReporting', () => {
  let context: WorkspaceContext;
  let list: jest.Mock<(request: any) => Promise<any>>;

  beforeEach(() => {
    jest.useFakeTimers({ now: new Date('2026-10-01T12:30:00Z') });
    context = makeContext();
    list = jest.fn(async () => ({ data: {} }));
    jest
      .spyOn(context.service(GoogleApisService), 'getClient')
      .mockImplementation(
        async () => ({ projects: { groupStats: { list } } }) as never,
      );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should return the open groups first seen before the end of the window as alerts', async () => {
    const group = (
      groupId: string,
      resolutionStatus: string | undefined,
      firstSeenTime: string,
      message?: string,
    ) => ({
      group: { groupId, ...(resolutionStatus ? { resolutionStatus } : {}) },
      firstSeenTime,
      ...(message ? { representative: { message } } : {}),
    });
    list.mockImplementation(async (request: any) =>
      request['serviceFilter.service'] === 'ordering-api'
        ? {
            data: {
              errorGroupStats: request.pageToken
                ? [
                    group('unspecified', undefined, '2026-10-01T11:00:00Z'),
                    group('later', 'OPEN', '2026-10-01T12:10:00Z', 'Later'),
                  ]
                : [
                    group(
                      'open',
                      'OPEN',
                      '2026-09-20T08:00:00Z',
                      'TypeError: 💥\n    at handler (index.js:1:1)',
                    ),
                    group('acked', 'ACKNOWLEDGED', '2026-09-20T08:00:00Z'),
                    group('resolved', 'RESOLVED', '2026-09-20T08:00:00Z'),
                    group('muted', 'MUTED', '2026-09-20T08:00:00Z'),
                  ],
              nextPageToken: request.pageToken ? undefined : '📄',
            },
          }
        : { data: {} },
    );

    const actualOutput = await googleErrorReporting.fetch(
      await makeEnvironment(context),
    );

    expect(actualOutput).toEqual({
      nodes: {
        'service:domains/ordering/api#ordering-api': {
          alerts: [
            {
              title: 'TypeError: 💥',
              severity: GraphAlertSeverity.Error,
              openedAt: new Date('2026-09-20T08:00:00Z'),
              url: 'https://console.cloud.google.com/errors/detail/open?project=my-project',
            },
            {
              title: 'Error group unspecified',
              severity: GraphAlertSeverity.Error,
              openedAt: new Date('2026-10-01T11:00:00Z'),
              url: 'https://console.cloud.google.com/errors/detail/unspecified?project=my-project',
            },
          ],
        },
      },
      warnings: [],
    });
    expect(list).toHaveBeenCalledWith({
      projectName: 'projects/my-project',
      'serviceFilter.service': 'ordering-api',
      'timeRange.period': 'PERIOD_30_DAYS',
      pageSize: 100,
      pageToken: '📄',
    });
  });

  it('should warn when the window ends more than 30 days ago', async () => {
    const environment = await makeEnvironment(
      context,
      ENVIRONMENT_GRAPH,
      new Date('2026-08-01T12:00:00Z'),
    );

    const actualOutput = await googleErrorReporting.fetch(environment);

    expect(actualOutput).toEqual({
      warnings: [
        {
          message:
            'Error groups cannot be listed for an evaluation window ending more than 30 days ago.',
        },
      ],
    });
    expect(list).not.toHaveBeenCalled();
  });

  it('should warn when groups cannot be listed', async () => {
    list.mockRejectedValue(new Error('💥'));

    const actualOutput = await googleErrorReporting.fetch(
      await makeEnvironment(context),
    );

    expect(actualOutput).toEqual({
      nodes: {},
      warnings: [
        {
          message:
            "Failed to list the error groups of 'service:domains/ordering/api#ordering-api': 💥",
        },
        {
          message:
            "Failed to list the error groups of 'service:domains/ordering/api#ordering-events': 💥",
        },
      ],
    });
  });
});

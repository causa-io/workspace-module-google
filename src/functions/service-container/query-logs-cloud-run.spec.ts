import { WorkspaceContext } from '@causa/workspace';
import { ServiceContainerQueryLogs } from '@causa/workspace-core';
import { NoImplementationFoundError } from '@causa/workspace/function-registry';
import { createContext } from '@causa/workspace/testing';
import { jest } from '@jest/globals';
import 'jest-extended';
import { LoggingService } from '../../services/index.js';
import { ServiceContainerQueryLogsForCloudRun } from './query-logs-cloud-run.js';

describe('ServiceContainerQueryLogsForCloudRun', () => {
  let context: WorkspaceContext;
  let getEntriesMock: jest.Mock<(query: any) => Promise<any>>;

  beforeEach(() => {
    ({ context } = createContext({
      configuration: {
        workspace: { name: '🏷️' },
        google: { project: 'my-project' },
        serviceContainer: { platform: 'google.cloudRun' },
      },
      functions: [ServiceContainerQueryLogsForCloudRun],
    }));
    getEntriesMock = jest.spyOn(
      context.service(LoggingService).logging,
      'getEntries',
    ) as any;
  });

  function makeEntry(timestamp: string, structured: any) {
    return {
      metadata: { timestamp: new Date(timestamp) },
      toStructuredJSON: () => structured,
    } as any;
  }

  it('should not support a different platform', () => {
    ({ context } = createContext({
      configuration: {
        workspace: { name: '🏷️' },
        google: { project: 'my-project' },
        serviceContainer: { platform: 'other.platform' },
      },
      functions: [ServiceContainerQueryLogsForCloudRun],
    }));

    expect(() =>
      context.call(ServiceContainerQueryLogs, { service: 'my-service' }),
    ).toThrow(NoImplementationFoundError);
  });

  it('should query Cloud Logging with the Cloud Run prefix and default time range', async () => {
    getEntriesMock.mockResolvedValueOnce([
      [
        makeEntry('2026-04-30T09:00:00.000Z', 'world'),
        makeEntry('2026-04-30T10:00:00.000Z', { message: 'hello' }),
      ],
      {},
      {},
    ] as any);

    const before = Date.now();
    const actualEntries = await context.call(ServiceContainerQueryLogs, {
      service: 'my-service',
    });
    const after = Date.now();

    expect(actualEntries).toEqual([
      { timestamp: new Date('2026-04-30T09:00:00.000Z'), message: 'world' },
      {
        timestamp: new Date('2026-04-30T10:00:00.000Z'),
        message: { message: 'hello' },
      },
    ]);
    expect(getEntriesMock).toHaveBeenCalledExactlyOnceWith({
      filter: expect.any(String),
      orderBy: 'timestamp asc',
      maxResults: 1000,
    });
    const lines = getEntriesMock.mock.calls[0][0].filter.split('\n');
    expect(lines.slice(0, 2)).toEqual([
      `resource.type="cloud_run_revision"`,
      `resource.labels.service_name=~"my-service"`,
    ]);
    expect(lines).toHaveLength(3);
    const fromMatch = lines[2].match(/^timestamp>="([^"]+)"$/);
    const fromMs = new Date(fromMatch![1]).getTime();
    expect(fromMs).toBeWithin(
      before - 60 * 60 * 1000,
      after - 60 * 60 * 1000 + 1,
    );
  });

  it('should append the time range and filter to the query', async () => {
    getEntriesMock.mockResolvedValueOnce([[], {}, {}] as any);

    await context.call(ServiceContainerQueryLogs, {
      service: 'my-service',
      from: new Date('2026-04-30T00:00:00.000Z'),
      to: new Date('2026-04-30T12:00:00.000Z'),
      filter: 'severity>=ERROR',
      limit: 2,
    });

    expect(getEntriesMock).toHaveBeenCalledExactlyOnceWith({
      orderBy: 'timestamp asc',
      maxResults: 2,
      filter: `resource.type="cloud_run_revision"
resource.labels.service_name=~"my-service"
timestamp>="2026-04-30T00:00:00.000Z"
timestamp<"2026-04-30T12:00:00.000Z"
severity>=ERROR`,
    });
  });
});

import { WorkspaceContext } from '@causa/workspace';
import { EventTopicQueryEvents } from '@causa/workspace-core';
import { NoImplementationFoundError } from '@causa/workspace/function-registry';
import { createContext } from '@causa/workspace/testing';
import { jest } from '@jest/globals';
import 'jest-extended';
import { BigQueryService } from '../../services/index.js';
import { EventTopicQueryEventsForBigQuery } from './query-events-bigquery.js';

describe('EventTopicQueryEventsForBigQuery', () => {
  let context: WorkspaceContext;
  let queryMock: jest.Mock<(opts: any) => Promise<any>>;

  beforeEach(() => {
    ({ context } = createContext({
      configuration: {
        workspace: { name: 'my-workspace' },
        events: { broker: 'google.pubSub', format: 'json' },
        google: {
          project: 'my-project',
          pubSub: { bigQueryStorage: { rawEventsDatasetId: 'my-dataset' } },
        },
      },
      functions: [EventTopicQueryEventsForBigQuery],
    }));
    queryMock = jest.spyOn(
      context.service(BigQueryService).bigQuery,
      'query',
    ) as any;
  });

  it('should not support a non-Pub/Sub broker', () => {
    ({ context } = createContext({
      configuration: {
        workspace: { name: 'my-workspace' },
        events: { broker: 'kafka', format: 'json' },
        google: {
          project: 'my-project',
          pubSub: { bigQueryStorage: { rawEventsDatasetId: 'my-dataset' } },
        },
      },
      functions: [EventTopicQueryEventsForBigQuery],
    }));

    expect(() =>
      context.call(EventTopicQueryEvents, { topic: 'my.topic.v1' }),
    ).toThrow(NoImplementationFoundError);
  });

  it('should not support a non-JSON event format', () => {
    ({ context } = createContext({
      configuration: {
        workspace: { name: 'my-workspace' },
        events: { broker: 'google.pubSub', format: 'avro' },
        google: {
          project: 'my-project',
          pubSub: { bigQueryStorage: { rawEventsDatasetId: 'my-dataset' } },
        },
      },
      functions: [EventTopicQueryEventsForBigQuery],
    }));

    expect(() =>
      context.call(EventTopicQueryEvents, { topic: 'my.topic.v1' }),
    ).toThrow(NoImplementationFoundError);
  });

  it('should not support a Pub/Sub broker without BigQuery storage', () => {
    ({ context } = createContext({
      configuration: {
        workspace: { name: 'my-workspace' },
        events: { broker: 'google.pubSub', format: 'json' },
        google: { project: 'my-project' },
      },
      functions: [EventTopicQueryEventsForBigQuery],
    }));

    expect(() =>
      context.call(EventTopicQueryEvents, { topic: 'my.topic.v1' }),
    ).toThrow(NoImplementationFoundError);
  });

  it('should query the raw events table with the default time range and limit', async () => {
    queryMock.mockResolvedValueOnce([
      [
        {
          publish_time: { value: '2026-04-30T10:00:00.000Z' },
          data: '{"id":0}',
          attributes: '{"k":"v0"}',
        },
        {
          publish_time: { value: '2026-04-30T11:00:00.000Z' },
          data: '{"id":1}',
          attributes: null,
        },
      ],
    ]);

    const before = Date.now();
    const actualEvents = await context.call(EventTopicQueryEvents, {
      topic: 'my.topic-name.v1',
    });
    const after = Date.now();

    expect(actualEvents).toEqual([
      {
        timestamp: new Date('2026-04-30T10:00:00.000Z'),
        attributes: { k: 'v0' },
        data: { id: 0 },
      },
      {
        timestamp: new Date('2026-04-30T11:00:00.000Z'),
        attributes: {},
        data: { id: 1 },
      },
    ]);
    expect(queryMock).toHaveBeenCalledOnce();
    const { query, params } = queryMock.mock.calls[0][0];
    expect(query).toContain('`my-project.my-dataset.my_topic_name_v1`');
    expect(query).toContain('publish_time >= @from');
    expect(query).toContain('ORDER BY publish_time ASC');
    expect(query).toContain('LIMIT 1000');
    expect(params.to).toBeUndefined();
    const fromMs = new Date(params.from).getTime();
    expect(fromMs).toBeWithin(
      before - 60 * 60 * 1000,
      after - 60 * 60 * 1000 + 1,
    );
  });

  it('should forward the time range, filter, and limit', async () => {
    queryMock.mockResolvedValueOnce([[]]);

    await context.call(EventTopicQueryEvents, {
      topic: 'my.topic.v1',
      from: new Date('2026-04-30T00:00:00.000Z'),
      to: new Date('2026-04-30T12:00:00.000Z'),
      filter: `JSON_VALUE(attributes, '$.k') = 'v'`,
      limit: 5,
    });

    const opts = queryMock.mock.calls[0][0];
    expect(opts.params).toEqual({
      from: '2026-04-30T00:00:00.000Z',
      to: '2026-04-30T12:00:00.000Z',
    });
    expect(opts.query).toContain('publish_time < @to');
    expect(opts.query).toContain(`(JSON_VALUE(attributes, '$.k') = 'v')`);
    expect(opts.query).toContain('LIMIT 5');
  });
});

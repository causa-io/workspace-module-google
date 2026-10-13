import { WorkspaceContext } from '@causa/workspace';
import { EventTopicCountEvents } from '@causa/workspace-core';
import { NoImplementationFoundError } from '@causa/workspace/function-registry';
import { createContext } from '@causa/workspace/testing';
import { jest } from '@jest/globals';
import 'jest-extended';
import { BigQueryService } from '../../services/index.js';
import { EventTopicCountEventsForBigQuery } from './count-events-bigquery.js';

describe('EventTopicCountEventsForBigQuery', () => {
  let context: WorkspaceContext;
  let queryMock: jest.Mock<(opts: any) => Promise<any>>;

  function makeContext(configuration: Record<string, any> = {}) {
    ({ context } = createContext({
      configuration: {
        workspace: { name: 'my-workspace' },
        events: { broker: 'google.pubSub', format: 'json' },
        google: {
          project: 'my-project',
          pubSub: { bigQueryStorage: { rawEventsDatasetId: 'my-dataset' } },
        },
        ...configuration,
      },
      functions: [EventTopicCountEventsForBigQuery],
    }));
    queryMock = jest.spyOn(
      context.service(BigQueryService).bigQuery,
      'query',
    ) as any;
  }

  beforeEach(() => makeContext());

  it('should not support a non-Pub/Sub broker', () => {
    makeContext({ events: { broker: 'kafka', format: 'json' } });

    expect(() =>
      context.call(EventTopicCountEvents, {
        topic: 'my.topic.v1',
        from: new Date(),
        to: new Date(),
        filters: {},
      }),
    ).toThrow(NoImplementationFoundError);
  });

  it('should not support a non-JSON event format', () => {
    makeContext({ events: { broker: 'google.pubSub', format: 'avro' } });

    expect(() =>
      context.call(EventTopicCountEvents, {
        topic: 'my.topic.v1',
        from: new Date(),
        to: new Date(),
        filters: {},
      }),
    ).toThrow(NoImplementationFoundError);
  });

  it('should not support a Pub/Sub broker without BigQuery storage', () => {
    makeContext({ google: { project: 'my-project' } });

    expect(() =>
      context.call(EventTopicCountEvents, {
        topic: 'my.topic.v1',
        from: new Date(),
        to: new Date(),
        filters: {},
      }),
    ).toThrow(NoImplementationFoundError);
  });

  it('should count the deduplicated events matching each filter in a single query', async () => {
    queryMock.mockResolvedValueOnce([[{ total: 12, f0: 4, f1: 0, f2: 12 }]]);

    const actualCounts = await context.call(EventTopicCountEvents, {
      topic: 'my.topic-name.v1',
      from: new Date('2026-10-01T00:00:00.000Z'),
      to: new Date('2026-10-02T00:00:00.000Z'),
      filters: {
        published: [
          { path: ['name'], operator: 'equals', value: 'postPublished' },
          { path: ['data', 'publishedAt'], operator: 'isNotNull' },
          { path: ['data', 'deletedAt'], operator: 'isNull' },
        ],
        other: [
          { path: ['data', 'count'], operator: 'equals', value: 3 },
          { path: ['data', 'is-active'], operator: 'equals', value: true },
        ],
        all: [],
      },
    });

    expect(actualCounts).toEqual({
      total: 12,
      counts: { published: 4, other: 0, all: 12 },
    });
    expect(queryMock).toHaveBeenCalledOnce();
    const { query, params } = queryMock.mock.calls[0][0];
    expect(query.replace(/\s+/g, ' ').trim()).toEqual(
      [
        'WITH events AS ( SELECT data FROM `my-project.my-dataset.my_topic_name_v1`',
        'WHERE publish_time >= @from AND publish_time < @to',
        'QUALIFY ROW_NUMBER() OVER (PARTITION BY message_id ORDER BY publish_time) = 1 )',
        'SELECT COUNT(*) AS total,',
        `COUNTIF(JSON_TYPE(data["name"]) = 'string' AND LAX_STRING(data["name"]) = @p0 AND JSON_TYPE(data["data"]["publishedAt"]) != 'null' AND (data["data"]["deletedAt"] IS NULL OR JSON_TYPE(data["data"]["deletedAt"]) = 'null')) AS f0,`,
        `COUNTIF(JSON_TYPE(data["data"]["count"]) = 'number' AND LAX_FLOAT64(data["data"]["count"]) = @p1 AND JSON_TYPE(data["data"]["is-active"]) = 'boolean' AND LAX_BOOL(data["data"]["is-active"]) = @p2) AS f1,`,
        'COUNTIF(TRUE) AS f2',
        'FROM events',
      ].join(' '),
    );
    expect(params).toEqual({
      from: '2026-10-01T00:00:00.000Z',
      to: '2026-10-02T00:00:00.000Z',
      p0: 'postPublished',
      p1: 3,
      p2: true,
    });
  });
});

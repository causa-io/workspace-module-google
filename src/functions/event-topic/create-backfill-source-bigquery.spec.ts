import { WorkspaceContext } from '@causa/workspace';
import { EventTopicCreateBackfillSource } from '@causa/workspace-core';
import { NoImplementationFoundError } from '@causa/workspace/function-registry';
import { createContext } from '@causa/workspace/testing';
import { BigQuery } from '@google-cloud/bigquery';
import { jest } from '@jest/globals';
import 'jest-extended';
import { BigQueryService } from '../../services/index.js';
import { EventTopicCreateBackfillSourceForBigQuery } from './create-backfill-source-bigquery.js';

describe('EventTopicCreateBackfillSourceForBigQuery', () => {
  let context: WorkspaceContext;
  let bigQuery: BigQuery;

  beforeEach(() => {
    ({ context } = createContext({
      configuration: {
        workspace: { name: 'my-workspace' },
        events: { broker: 'google.pubSub' },
        google: {
          project: 'my-project',
          pubSub: {
            bigQueryStorage: {
              rawEventsDatasetId: 'my-dataset',
              location: 'EU',
            },
          },
        },
      },
      functions: [EventTopicCreateBackfillSourceForBigQuery],
    }));
    bigQuery = context.service(BigQueryService).bigQuery;
  });

  function mockJob(rows: any[]): jest.Mock {
    const getQueryResultsStream = jest.fn(() =>
      (async function* () {
        for (const row of rows) {
          yield row;
        }
      })(),
    );
    jest
      .spyOn(bigQuery as any, 'createQueryJob')
      .mockResolvedValueOnce([{ getQueryResultsStream }]);
    return getQueryResultsStream;
  }

  it('should not support non-BigQuery source strings', () => {
    expect(() =>
      context.call(EventTopicCreateBackfillSource, {
        eventTopic: 'my-topic',
        source: 'json://some/path',
      }),
    ).toThrow(NoImplementationFoundError);
  });

  it('should not support a missing source when BigQuery storage is not configured', () => {
    ({ context } = createContext({
      configuration: {
        workspace: { name: 'my-workspace' },
        events: { broker: 'google.pubSub' },
        google: { project: 'my-project' },
      },
      functions: [EventTopicCreateBackfillSourceForBigQuery],
    }));

    expect(() =>
      context.call(EventTopicCreateBackfillSource, {
        eventTopic: 'my-topic',
      }),
    ).toThrow(NoImplementationFoundError);
  });

  it('should not support a missing source when the broker is not Pub/Sub', () => {
    ({ context } = createContext({
      configuration: {
        workspace: { name: 'my-workspace' },
        events: { broker: 'kafka' },
        google: {
          project: 'my-project',
          pubSub: {
            bigQueryStorage: {
              rawEventsDatasetId: 'my-dataset',
            },
          },
        },
      },
      functions: [EventTopicCreateBackfillSourceForBigQuery],
    }));

    expect(() =>
      context.call(EventTopicCreateBackfillSource, {
        eventTopic: 'my-topic',
      }),
    ).toThrow(NoImplementationFoundError);
  });

  it('should iterate events from a `bq://` source with a filter', async () => {
    const expectedAttributes = { someAttribute: '🎉' };
    const getQueryResultsStream = mockJob([
      { data: 'd0', attributes: JSON.stringify(expectedAttributes) },
      { data: 'd1', attributes: JSON.stringify(expectedAttributes) },
      { data: 'd2', attributes: JSON.stringify(expectedAttributes) },
    ]);

    const iterable = await context.call(EventTopicCreateBackfillSource, {
      eventTopic: 'my-topic',
      source: 'bq://custom-project.custom-dataset.custom-table',
      filter: 'filter-expression',
    });

    const events = await Array.fromAsync(iterable);
    expect(events.map((e) => ({ ...e, data: e.data.toString() }))).toEqual([
      { data: 'd0', attributes: expectedAttributes },
      { data: 'd1', attributes: expectedAttributes },
      { data: 'd2', attributes: expectedAttributes },
    ]);
    expect(bigQuery.createQueryJob).toHaveBeenCalledOnce();
    const actualQuery = (bigQuery.createQueryJob as any).mock.calls[0][0]
      .replace(/\s+/g, ' ')
      .trim();
    expect(actualQuery).toEqual(
      'SELECT data, attributes, FROM `custom-project.custom-dataset.custom-table` WHERE (filter-expression)',
    );
    expect(getQueryResultsStream).toHaveBeenCalledOnce();
  });

  it('should iterate events from the default BigQuery storage', async () => {
    mockJob([{ data: 'default', attributes: JSON.stringify({}) }]);

    const iterable = await context.call(EventTopicCreateBackfillSource, {
      eventTopic: 'my-topic-name',
    });

    const events = await Array.fromAsync(iterable);
    expect(events.map((e) => ({ ...e, data: e.data.toString() }))).toEqual([
      { data: 'default', attributes: {} },
    ]);
    const createQueryJobMock = bigQuery.createQueryJob as jest.Mock;
    const actualQuery = (createQueryJobMock.mock.calls[0][0] as string)
      .replace(/\s+/g, ' ')
      .trim();
    expect(actualQuery).toEqual(
      'SELECT data, attributes, FROM `my-project.my-dataset.my_topic_name`',
    );
  });
});

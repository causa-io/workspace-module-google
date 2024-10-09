import { WorkspaceContext } from '@causa/workspace';
import type { BackfillEvent } from '@causa/workspace-core';
import { createContext } from '@causa/workspace/testing';
import { BigQuery } from '@google-cloud/bigquery';
import { jest } from '@jest/globals';
import 'jest-extended';
import { BigQueryService } from '../services/index.js';
import { BigQueryEventsSource } from './bigquery.js';

describe('BigQueryEventSource', () => {
  let context: WorkspaceContext;
  let bigQuery: BigQuery;

  beforeEach(() => {
    ({ context } = createContext({
      configuration: {
        workspace: { name: 'test-workspace' },
        google: { project: 'test-project' },
      },
    }));
    bigQuery = context.service(BigQueryService).bigQuery;
  });

  describe('fromSourceAndFilter', () => {
    it('should return null for a non-supported string', async () => {
      const actualSource = await BigQueryEventsSource.fromSourceAndFilter(
        context,
        'not-a-bigquery-table',
      );

      expect(actualSource).toBeNull();
    });

    it('should return a source with the configured table ID and filter', async () => {
      const actualSource = await BigQueryEventsSource.fromSourceAndFilter(
        context,
        'bq://test-project.test-dataset.test-table',
        'filter-expression',
      );

      expect(actualSource).toBeInstanceOf(BigQueryEventsSource);
      expect(actualSource?.tableId).toEqual(
        'test-project.test-dataset.test-table',
      );
      expect(actualSource?.filter).toEqual('filter-expression');
    });
  });

  describe('getBatch', () => {
    let source: BigQueryEventsSource;

    beforeEach(async () => {
      source = (await BigQueryEventsSource.fromSourceAndFilter(
        context,
        'bq://test-project.test-dataset.test-table',
        'filter',
      ))!;
    });

    it('should create the job and get several pages of results', async () => {
      const expectedAttributes = { someAttribute: '🎉' };
      const job = {
        getQueryResults: jest.fn(async (options: any) => {
          const pageCount = options.pageCount ?? 0;
          const rows = [
            {
              data: `data-${pageCount * 2}`,
              attributes: JSON.stringify(expectedAttributes),
            },
            {
              data: `data-${pageCount * 2 + 1}`,
              attributes: JSON.stringify(expectedAttributes),
            },
          ];
          const nextPageRequest =
            pageCount < 2 ? { pageCount: pageCount + 1 } : null;
          return [rows, nextPageRequest];
        }),
      };
      const createQueryJobMock = jest
        .spyOn(bigQuery as any, 'createQueryJob')
        .mockResolvedValue([job]);

      const batches: BackfillEvent[][] = [];
      let batch: BackfillEvent[] | null;
      while ((batch = await source.getBatch())) {
        batches.push(batch);
      }

      expect(
        batches.map((b) => b.map((e) => ({ ...e, data: e.data.toString() }))),
      ).toEqual([
        [
          { data: 'data-0', attributes: expectedAttributes },
          { data: 'data-1', attributes: expectedAttributes },
        ],
        [
          { data: 'data-2', attributes: expectedAttributes },
          { data: 'data-3', attributes: expectedAttributes },
        ],
        [
          { data: 'data-4', attributes: expectedAttributes },
          { data: 'data-5', attributes: expectedAttributes },
        ],
      ]);
      expect(bigQuery.createQueryJob).toHaveBeenCalledOnce();
      const actualQuery = (createQueryJobMock.mock.calls[0][0] as string)
        .replace('\n', ' ')
        .replace(/\s+/g, ' ')
        .trim();
      expect(actualQuery).toEqual(
        'SELECT data, attributes, FROM `test-project.test-dataset.test-table` WHERE (filter)',
      );
      expect(job.getQueryResults).toHaveBeenCalledTimes(3);
      expect(job.getQueryResults).toHaveBeenCalledWith({
        autoPaginate: false,
        maxResults: 10000,
      });
    });
  });
});

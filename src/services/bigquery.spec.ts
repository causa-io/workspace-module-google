import { WorkspaceContext } from '@causa/workspace';
import { createContext } from '@causa/workspace/testing';
import { BigQuery } from '@google-cloud/bigquery';
import { BigQueryService } from './bigquery.js';

describe('BigQueryService', () => {
  let context: WorkspaceContext;
  let service: BigQueryService;

  beforeEach(() => {
    ({ context } = createContext({
      configuration: {
        workspace: { name: 'test-workspace' },
        google: { project: 'test-project' },
      },
    }));
    service = context.service(BigQueryService);
  });

  it('should expose the BigQuery client configured with the GCP project ID', () => {
    expect(service.bigQuery).toBeInstanceOf(BigQuery);
    expect(service.bigQuery.projectId).toBe('test-project');
  });
});

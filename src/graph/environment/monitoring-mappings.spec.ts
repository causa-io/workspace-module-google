import { jest } from '@jest/globals';
import 'jest-extended';
import { GoogleApisService } from '../../services/index.js';
import { AT, makeContext, makeEnvironment } from './fixture.test.js';
import {
  LOAD_BALANCER_BACKEND_MAPPINGS,
  LoadBalancerBackendsFact,
  SERVERLESS_NEG_BACKENDS,
  URL_MAP_MAPPING,
  type LoadBalancerBackend,
} from './load-balancer-backends.js';
import {
  CLOUD_RUN_SERVICE_MAPPING,
  MONITORING_METRICS,
  SPANNER_DATABASE_MAPPING,
} from './monitoring-catalog.js';
import {
  findMonitoredNode,
  monitoringLabelName,
  prepareMonitoringMapping,
  readMonitoringResourceKey,
  templateMapping,
  type MonitoringLabel,
  type MonitoringResourceMapping,
  type PreparedMonitoringMapping,
} from './monitoring-mappings.js';

const ORDERING_API =
  'projects/my-project/locations/europe-west1/services/ordering-api';

const [LOAD_BALANCER_BACKEND_MAPPING] = LOAD_BALANCER_BACKEND_MAPPINGS;

const ORDERING_API_BACKEND: LoadBalancerBackend = {
  kind: SERVERLESS_NEG_BACKENDS,
  project: 'my-project',
  labels: {
    'resource.label.backend_scope': 'europe-west1',
    'resource.label.backend_name': 'run-ordering-api',
  },
  resource: ORDERING_API,
};

async function makeMappingEnvironment(
  backends: LoadBalancerBackend[] = [ORDERING_API_BACKEND],
) {
  return await makeEnvironment(makeContext(), undefined, AT, [
    [LoadBalancerBackendsFact, backends],
  ]);
}

function reader(
  labels: Record<string, string>,
): (label: MonitoringLabel) => string | undefined {
  return (label) => labels[label];
}

describe('monitoring-mappings', () => {
  describe('monitoringLabelName', () => {
    it('should return the name of the label without its source', () => {
      expect(monitoringLabelName('resource.label.service_name')).toEqual(
        'service_name',
      );
      expect(monitoringLabelName('metric.label.database')).toEqual('database');
    });
  });

  describe('templateMapping', () => {
    it('should derive the key labels from the template', () => {
      expect(CLOUD_RUN_SERVICE_MAPPING.keyLabels).toEqual([
        'resource.label.location',
        'resource.label.service_name',
      ]);
      expect(SPANNER_DATABASE_MAPPING.keyLabels).toEqual([
        'resource.label.instance_id',
        'metric.label.database',
      ]);
    });

    it('should build resource names from the values of the key labels and the project', async () => {
      const mapping = templateMapping({
        nodeType: 'service',
        resourceType: 'run.googleapis.com/Service',
        monitoredResource: 'cloud_run_revision',
        name: 'projects/{project}/services/{resource.label.service_name}',
      });

      const resolve = await mapping.resolver(await makeMappingEnvironment());

      expect(
        resolve({
          project: 'other-project',
          labels: { 'resource.label.service_name': 'ordering-api' },
        }),
      ).toEqual('projects/other-project/services/ordering-api');
    });
  });

  describe('readMonitoringResourceKey', () => {
    it('should return the values of the key labels, or undefined if some are missing or empty', () => {
      const labels = {
        'resource.label.service_name': 'ordering-api',
        'resource.label.location': 'europe-west1',
        'metric.label.response_code': '200',
      };

      expect(
        readMonitoringResourceKey(
          CLOUD_RUN_SERVICE_MAPPING,
          'my-project',
          reader(labels),
        ),
      ).toEqual({
        project: 'my-project',
        labels: {
          'resource.label.location': 'europe-west1',
          'resource.label.service_name': 'ordering-api',
        },
      });
      expect(
        readMonitoringResourceKey(
          CLOUD_RUN_SERVICE_MAPPING,
          'my-project',
          reader({ 'resource.label.service_name': 'ordering-api' }),
        ),
      ).toBeUndefined();
      expect(
        readMonitoringResourceKey(
          CLOUD_RUN_SERVICE_MAPPING,
          'my-project',
          reader({ ...labels, 'resource.label.location': '' }),
        ),
      ).toBeUndefined();
    });
  });

  describe('prepareMonitoringMapping', () => {
    it('should prepare a mapping built from a template', async () => {
      const environment = await makeMappingEnvironment();

      const actualPrepared = await prepareMonitoringMapping(
        environment,
        CLOUD_RUN_SERVICE_MAPPING,
      );

      expect(actualPrepared?.mapping).toBe(CLOUD_RUN_SERVICE_MAPPING);
      expect(
        actualPrepared?.resolve({
          project: 'my-project',
          labels: {
            'resource.label.location': 'europe-west1',
            'resource.label.service_name': 'ordering-api',
          },
        }),
      ).toEqual(ORDERING_API);
    });

    it('should prepare the mapping of load balancer backends from the listed backends', async () => {
      const environment = await makeMappingEnvironment();

      const actualPrepared = await prepareMonitoringMapping(
        environment,
        LOAD_BALANCER_BACKEND_MAPPING,
      );

      const labels = {
        'resource.label.backend_scope': 'europe-west1',
        'resource.label.backend_name': 'run-ordering-api',
      } as const;
      expect(
        actualPrepared?.resolve({ project: 'my-project', labels }),
      ).toEqual(ORDERING_API);
      expect(
        actualPrepared?.resolve({ project: 'other-project', labels }),
      ).toBeUndefined();
    });

    it('should return undefined when a fact of the mapping cannot be computed', async () => {
      const context = makeContext();
      jest
        .spyOn(context.service(GoogleApisService), 'getClient')
        .mockRejectedValue(new Error('💥'));
      const environment = await makeEnvironment(context);

      const actualPrepared = await prepareMonitoringMapping(
        environment,
        LOAD_BALANCER_BACKEND_MAPPING,
      );

      expect(actualPrepared).toBeUndefined();
      expect(environment.failures).toEqual([
        { name: 'LoadBalancerBackendsFact', message: expect.any(String) },
      ]);
    });

    it('should rethrow other errors', async () => {
      const environment = await makeMappingEnvironment();
      const mapping: MonitoringResourceMapping = {
        ...CLOUD_RUN_SERVICE_MAPPING,
        resolver: () => {
          throw new Error('💥');
        },
      };

      const actualPromise = prepareMonitoringMapping(environment, mapping);

      await expect(actualPromise).rejects.toThrow('💥');
    });
  });

  describe('findMonitoredNode', () => {
    let mappings: PreparedMonitoringMapping[];

    beforeEach(async () => {
      const environment = await makeMappingEnvironment();
      mappings = (await Promise.all(
        [URL_MAP_MAPPING, LOAD_BALANCER_BACKEND_MAPPING].map((m) =>
          prepareMonitoringMapping(environment, m),
        ),
      )) as PreparedMonitoringMapping[];
    });

    it('should try the mappings from the most specific one', async () => {
      const environment = await makeMappingEnvironment();

      const actualResult = findMonitoredNode(
        environment,
        mappings,
        'my-project',
        reader({
          'resource.label.url_map_name': 'api',
          'resource.label.backend_scope': 'europe-west1',
          'resource.label.backend_name': 'run-ordering-api',
        }),
      );

      expect(actualResult).toEqual({
        node: expect.objectContaining({
          id: 'service:domains/ordering/api#ordering-api',
        }),
        missing: [],
      });
    });

    it('should fall back to less specific mappings, and return the names missing from the graph', async () => {
      const environment = await makeMappingEnvironment([
        {
          ...ORDERING_API_BACKEND,
          resource:
            'projects/my-project/locations/europe-west1/services/missing',
        },
      ]);
      const missingMappings = (await Promise.all(
        [URL_MAP_MAPPING, LOAD_BALANCER_BACKEND_MAPPING].map((m) =>
          prepareMonitoringMapping(environment, m),
        ),
      )) as PreparedMonitoringMapping[];

      const actualResult = findMonitoredNode(
        environment,
        missingMappings,
        'my-project',
        reader({
          'resource.label.url_map_name': 'api',
          'resource.label.backend_scope': 'europe-west1',
          'resource.label.backend_name': 'run-ordering-api',
        }),
      );

      expect(actualResult).toEqual({
        node: expect.objectContaining({ id: 'apiRouter:api' }),
        missing: [
          {
            mapping: LOAD_BALANCER_BACKEND_MAPPING,
            key: {
              project: 'my-project',
              labels: {
                'resource.label.backend_scope': 'europe-west1',
                'resource.label.backend_name': 'run-ordering-api',
              },
            },
            name: 'projects/my-project/locations/europe-west1/services/missing',
          },
        ],
      });
    });

    it('should not return a node of another type than the one of the mapping', async () => {
      const environment = await makeMappingEnvironment();
      const mapping: MonitoringResourceMapping = {
        ...CLOUD_RUN_SERVICE_MAPPING,
        nodeType: 'apiRouter',
      };
      const prepared = await prepareMonitoringMapping(environment, mapping);

      const actualResult = findMonitoredNode(
        environment,
        [prepared!],
        'my-project',
        reader({
          'resource.label.location': 'europe-west1',
          'resource.label.service_name': 'ordering-api',
        }),
      );

      expect(actualResult).toEqual({ missing: [] });
    });

    it('should return no node when no key can be read', async () => {
      const environment = await makeMappingEnvironment();

      const actualResult = findMonitoredNode(
        environment,
        mappings,
        'my-project',
        reader({}),
      );

      expect(actualResult).toEqual({ missing: [] });
    });
  });

  describe('MONITORING_METRICS', () => {
    it('should group by nodes mapped from the monitored resource of each metric', () => {
      const actualMismatches = MONITORING_METRICS.filter(
        ({ mapping, groupByNode }) =>
          (groupByNode ?? []).some(
            (m) => m.monitoredResource !== mapping.monitoredResource,
          ),
      );

      expect(actualMismatches).toBeEmpty();
    });
  });
});

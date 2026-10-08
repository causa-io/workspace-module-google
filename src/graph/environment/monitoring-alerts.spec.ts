import { WorkspaceContext } from '@causa/workspace';
import { jest } from '@jest/globals';
import 'jest-extended';
import { GoogleApisService } from '../../services/index.js';
import type { GraphEnvironmentContext } from '@causa/workspace-core/graph';
import { AT, makeContext, makeEnvironment } from './fixture.test.js';
import {
  LoadBalancerBackendsFact,
  SERVERLESS_NEG_BACKENDS,
} from './load-balancer-backends.js';
import { alertLabelValue, listOpenAlerts } from './monitoring-alerts.js';
import { MONITORING_RESOURCE_MAPPINGS } from './monitoring-catalog.js';
import {
  findMonitoredNode,
  prepareMonitoringMapping,
  type PreparedMonitoringMapping,
} from './monitoring-mappings.js';

describe('monitoring-alerts', () => {
  describe('listOpenAlerts', () => {
    let context: WorkspaceContext;
    let list: jest.Mock<(request: any) => Promise<any>>;

    beforeEach(() => {
      context = makeContext();
      list = jest
        .fn<(request: any) => Promise<any>>()
        .mockResolvedValueOnce({
          data: {
            alerts: [
              {
                name: 'first',
                resource: {
                  type: 'cloud_run_revision',
                  labels: {
                    service_name: 'ordering-api',
                    location: 'europe-west1',
                  },
                },
                metric: {
                  labels: {
                    value: '6',
                    location: '🙅',
                    project_id: 'my-project',
                  },
                },
              },
            ],
            nextPageToken: 'next',
          },
        })
        .mockResolvedValueOnce({
          data: {
            alerts: [
              {
                name: 'second',
                resource: { type: 'prometheus_target' },
                metric: {
                  labels: {
                    monitored_resource: 'cloud_run_revision',
                    service_name: 'ordering-api',
                  },
                },
              },
              {
                name: 'third',
                resource: { type: 'prometheus_target' },
                metric: { labels: { service_name: 'ordering-api' } },
              },
              { name: 'fourth' },
            ],
          },
        });
      jest
        .spyOn(context.service(GoogleApisService), 'getClient')
        .mockImplementation(
          async () => ({ projects: { alerts: { list } } }) as never,
        );
    });

    it('should list the alerts open at the given time, without fractional seconds, across pages, with their resources', async () => {
      const actualAlerts = await listOpenAlerts(
        context,
        'listing-project',
        new Date('2026-10-01T12:00:00.789Z'),
      );

      expect(actualAlerts).toEqual([
        {
          alert: expect.objectContaining({ name: 'first' }),
          project: 'listing-project',
          resource: {
            type: 'cloud_run_revision',
            project: 'my-project',
            labels: {
              service_name: 'ordering-api',
              location: 'europe-west1',
              project_id: 'my-project',
              value: '6',
            },
          },
        },
        {
          alert: expect.objectContaining({ name: 'second' }),
          project: 'listing-project',
          resource: {
            type: 'cloud_run_revision',
            project: 'listing-project',
            labels: {
              monitored_resource: 'cloud_run_revision',
              service_name: 'ordering-api',
            },
          },
        },
        {
          alert: expect.objectContaining({ name: 'third' }),
          project: 'listing-project',
        },
        { alert: { name: 'fourth' }, project: 'listing-project' },
      ]);
      const filter =
        'open_time <= "2026-10-01T12:00:00Z" AND (state = "OPEN" OR close_time >= "2026-10-01T12:00:00Z")';
      expect(list.mock.calls).toEqual([
        [
          {
            parent: 'projects/listing-project',
            filter,
            pageSize: 1000,
            pageToken: undefined,
          },
        ],
        [
          {
            parent: 'projects/listing-project',
            filter,
            pageSize: 1000,
            pageToken: 'next',
          },
        ],
      ]);
    });
  });

  describe('alertLabelValue', () => {
    it('should read labels by name, regardless of their source', () => {
      const resource = {
        type: 'cloud_run_revision',
        project: 'my-project',
        labels: { location: 'europe-west1', value: '6' },
      };

      expect(alertLabelValue(resource, 'resource.label.location')).toEqual(
        'europe-west1',
      );
      expect(alertLabelValue(resource, 'metric.label.location')).toEqual(
        'europe-west1',
      );
      expect(alertLabelValue(resource, 'resource.label.value')).toEqual('6');
      expect(
        alertLabelValue(resource, 'resource.label.unknown'),
      ).toBeUndefined();
    });
  });

  describe('alert nodes', () => {
    let environment: GraphEnvironmentContext;
    let mappings: PreparedMonitoringMapping[];

    beforeEach(async () => {
      environment = await makeEnvironment(makeContext(), undefined, AT, [
        [
          LoadBalancerBackendsFact,
          [
            {
              kind: SERVERLESS_NEG_BACKENDS,
              project: 'my-project',
              labels: {
                'resource.label.backend_scope': 'europe-west1',
                'resource.label.backend_name': 'run-ordering-api',
              },
              resource:
                'projects/my-project/locations/europe-west1/services/ordering-api',
            },
          ],
        ],
      ]);
      mappings = (
        await Promise.all(
          MONITORING_RESOURCE_MAPPINGS.map((m) =>
            prepareMonitoringMapping(environment, m),
          ),
        )
      ).filter((m) => !!m);
    });

    const findNode = (
      type: string,
      labels: Record<string, string>,
      project = labels.project_id ?? 'my-project',
    ) =>
      findMonitoredNode(
        environment,
        mappings.filter(({ mapping }) => mapping.monitoredResource === type),
        project,
        (label) => alertLabelValue({ type, project, labels }, label),
      ).node?.id;

    it('should find the node of the resource', () => {
      expect(
        findNode('cloud_run_revision', {
          location: 'europe-west1',
          service_name: 'ordering-events',
        }),
      ).toEqual('service:domains/ordering/api#ordering-events');
      expect(
        findNode('cloud_scheduler_job', {
          location: 'europe-west1',
          job_id: 'run-ordering-events-expireOrders',
        }),
      ).toEqual('scheduledJob:domains/ordering/api#expireOrders');
    });

    it('should match queues by their resolved names', () => {
      const queue = (queue_id: string) =>
        findNode('cloud_tasks_queue', { location: 'europe-west1', queue_id });

      expect(queue('order-expiration-abc')).toEqual('queue:order-expiration');
      expect(queue('order-expiration-late-def')).toBeUndefined();
    });

    it('should try the mappings from the most specific one', () => {
      expect(findNode('spanner_instance', { instance_id: 'main' })).toEqual(
        'google.spanner.instance:main',
      );
      expect(
        findNode('spanner_instance', {
          instance_id: 'main',
          database: 'ordering',
        }),
      ).toEqual('database:google.spanner/main.ordering');
    });

    it('should attach load balancer alerts to the node of their backend, or to the API router', () => {
      const labels = {
        project_id: 'my-project',
        url_map_name: 'api',
        backend_scope: 'europe-west1',
      };

      expect(
        findNode('https_lb_rule', {
          ...labels,
          backend_name: 'run-ordering-api',
        }),
      ).toEqual('service:domains/ordering/api#ordering-api');
      expect(
        findNode('https_lb_rule', { ...labels, backend_name: 'run-unknown' }),
      ).toEqual('apiRouter:api');
    });

    it('should return undefined when no node matches', () => {
      expect(
        findNode('cloud_run_revision', {
          location: 'europe-west1',
          service_name: 'unknown',
        }),
      ).toBeUndefined();
      expect(
        findNode('cloud_run_revision', { service_name: 'ordering' }),
      ).toBeUndefined();
      expect(
        findNode('cloud_run_revision', {
          location: 'europe-west1',
          service_name: 'ordering-events',
          project_id: 'other-project',
        }),
      ).toBeUndefined();
      expect(findNode('gce_instance', {})).toBeUndefined();
    });
  });
});

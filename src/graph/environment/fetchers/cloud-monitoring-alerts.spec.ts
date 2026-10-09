import { WorkspaceContext } from '@causa/workspace';
import { GraphAlertSeverity } from '@causa/workspace-core';
import { jest } from '@jest/globals';
import 'jest-extended';
import { GoogleApisService } from '../../../services/index.js';
import { makeContext, makeEnvironment } from '../fixture.test.js';
import { googleCloudMonitoringAlerts } from './cloud-monitoring-alerts.js';

const alert = (
  id: string,
  policy: string,
  openTime: string,
  rest: Record<string, unknown>,
) => ({
  name: `projects/my-project/alerts/${id}`,
  policy: { displayName: policy, severity: 'ERROR' },
  openTime,
  ...rest,
});

const url = (id: string) =>
  `https://console.cloud.google.com/monitoring/alerting/alerts/${id}?project=my-project`;

describe('googleCloudMonitoringAlerts', () => {
  let context: WorkspaceContext;
  let alerts: any[];
  let listAlerts: jest.Mock<(request: any) => Promise<any>>;
  let listGroups: jest.Mock<(request: any) => Promise<any>>;

  beforeEach(() => {
    context = makeContext();
    alerts = [];
    listAlerts = jest.fn(async () => ({ data: { alerts } }));
    listGroups = jest.fn(async () => ({
      data: {
        items: [
          {
            name: 'run-ordering-api',
            networkEndpointType: 'SERVERLESS',
            cloudRun: { service: 'ordering-api' },
          },
        ],
      },
    }));
    jest
      .spyOn(context.service(GoogleApisService), 'getClient')
      .mockImplementation(
        async (api) =>
          (api === 'monitoring'
            ? { projects: { alerts: { list: listAlerts } } }
            : { regionNetworkEndpointGroups: { list: listGroups } }) as never,
      );
  });

  it('should attach the open alerts to the nodes of their resources', async () => {
    alerts = [
      alert('errors-2', 'Cloud Run - Error count', '2026-10-01T11:50:00Z', {
        resource: {
          type: 'cloud_run_revision',
          labels: {
            monitored_resource: 'cloud_run_revision',
            project_id: 'my-project',
            location: 'europe-west1',
            service_name: 'ordering-api',
          },
        },
        metric: { labels: { value: '10' } },
      }),
      alert('latency', 'API - Response time', '2026-10-01T11:40:00Z', {
        policy: { displayName: 'API - Response time', severity: 'WARNING' },
        resource: {
          type: 'https_lb_rule',
          labels: {
            project_id: 'my-project',
            url_map_name: 'api',
            backend_scope: 'europe-west1',
            backend_name: 'run-ordering-api',
          },
        },
      }),
      alert('errors-1', 'Cloud Run - Error count', '2026-10-01T11:30:00Z', {
        resource: { type: 'prometheus_target' },
        metric: {
          labels: {
            monitored_resource: 'cloud_run_revision',
            project_id: 'my-project',
            location: 'europe-west1',
            service_name: 'ordering-api',
          },
        },
      }),
      alert('job', 'Cloud Scheduler - Error count', '2026-10-01T11:00:00Z', {
        policy: { displayName: 'Cloud Scheduler - Error count' },
        resource: {
          type: 'cloud_scheduler_job',
          labels: {
            project_id: 'my-project',
            location: 'europe-west1',
            job_id: 'run-ordering-events-expireOrders',
          },
        },
      }),
    ];

    const actualOutput = await googleCloudMonitoringAlerts.fetch(
      await makeEnvironment(context),
    );

    expect(actualOutput).toEqual({
      nodes: {
        'service:domains/ordering/api#ordering-api': {
          alerts: [
            {
              title: 'Cloud Run - Error count',
              severity: GraphAlertSeverity.Error,
              openedAt: new Date('2026-10-01T11:50:00Z'),
              url: url('errors-2'),
            },
            {
              title: 'API - Response time',
              severity: GraphAlertSeverity.Warning,
              openedAt: new Date('2026-10-01T11:40:00Z'),
              url: url('latency'),
            },
            {
              title: 'Cloud Run - Error count',
              severity: GraphAlertSeverity.Error,
              openedAt: new Date('2026-10-01T11:30:00Z'),
              url: url('errors-1'),
            },
          ],
        },
        'scheduledJob:domains/ordering/api#expireOrders': {
          alerts: [
            {
              title: 'Cloud Scheduler - Error count',
              openedAt: new Date('2026-10-01T11:00:00Z'),
              url: url('job'),
            },
          ],
        },
      },
      warnings: [],
    });
    expect(listAlerts).toHaveBeenCalledExactlyOnceWith({
      parent: 'projects/my-project',
      filter:
        'open_time <= "2026-10-01T12:00:00Z" AND (state = "OPEN" OR close_time >= "2026-10-01T12:00:00Z")',
      pageSize: 1000,
      pageToken: undefined,
    });
  });

  it('should add the alerts that cannot be attached to a node to the environment', async () => {
    alerts = [
      alert('unknown', 'Cloud Run - Error count', '2026-10-01T11:30:00Z', {
        resource: {
          type: 'cloud_run_revision',
          labels: {
            project_id: 'my-project',
            location: 'europe-west1',
            service_name: 'unknown',
          },
        },
        metric: { labels: { value: '10' } },
      }),
      alert('untyped', 'Cloud Run - Error count', '2026-10-01T11:00:00Z', {
        resource: { type: 'prometheus_target' },
        metric: { labels: { value: '10' } },
      }),
    ];

    const actualOutput = await googleCloudMonitoringAlerts.fetch(
      await makeEnvironment(context),
    );

    expect(actualOutput).toEqual({
      nodes: {},
      alerts: [
        {
          title: 'Cloud Run - Error count',
          severity: GraphAlertSeverity.Error,
          openedAt: new Date('2026-10-01T11:30:00Z'),
          url: url('unknown'),
        },
        {
          title: 'Cloud Run - Error count',
          severity: GraphAlertSeverity.Error,
          openedAt: new Date('2026-10-01T11:00:00Z'),
          url: url('untyped'),
        },
      ],
      warnings: [
        {
          message:
            "The alert of policy 'Cloud Run - Error count' on the 'cloud_run_revision' resource (location=europe-west1, project_id=my-project, service_name=unknown) could not be attached to a node, and is added to the environment.",
        },
        {
          message:
            "The alert of policy 'Cloud Run - Error count' on a resource of unknown type could not be attached to a node, and is added to the environment.",
        },
      ],
    });
    expect(listGroups).not.toHaveBeenCalled();
  });

  it('should return nothing when no alert is open', async () => {
    const actualOutput = await googleCloudMonitoringAlerts.fetch(
      await makeEnvironment(context),
    );

    expect(actualOutput).toEqual({ warnings: [] });
    expect(listGroups).not.toHaveBeenCalled();
  });

  it('should warn when alerts cannot be listed', async () => {
    listAlerts.mockRejectedValueOnce(new Error('💥'));

    const actualOutput = await googleCloudMonitoringAlerts.fetch(
      await makeEnvironment(context),
    );

    expect(actualOutput).toEqual({
      warnings: [
        { message: "Failed to list the alerts in project 'my-project': 💥" },
      ],
    });
  });
});

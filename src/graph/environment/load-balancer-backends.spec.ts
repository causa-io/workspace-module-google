import { WorkspaceContext } from '@causa/workspace';
import { GraphOriginKind } from '@causa/workspace-core';
import { GraphFactError } from '@causa/workspace-core/graph';
import { jest } from '@jest/globals';
import 'jest-extended';
import { GoogleApisService } from '../../services/index.js';
import {
  ENVIRONMENT_GRAPH,
  makeContext,
  makeEnvironment,
} from './fixture.test.js';
import {
  LoadBalancerBackendsFact,
  SERVERLESS_NEG_BACKENDS,
} from './load-balancer-backends.js';
import { googleResources, type GoogleResource } from './resources.js';

const neg = (name: string, service: string) => ({
  name,
  networkEndpointType: 'SERVERLESS',
  cloudRun: { service },
});

const backend = (scope: string, name: string, service: string) => ({
  kind: SERVERLESS_NEG_BACKENDS,
  project: 'my-project',
  labels: {
    'resource.label.backend_scope': scope,
    'resource.label.backend_name': name,
  },
  resource: `projects/my-project/locations/${scope}/services/${service}`,
});

describe('load-balancer-backends', () => {
  let context: WorkspaceContext;
  let list: jest.Mock<(request: any) => Promise<any>>;
  let services: GoogleResource[];

  beforeAll(async () => {
    services = googleResources(
      await makeEnvironment(),
      'run.googleapis.com/Service',
      'service',
    );
  });

  beforeEach(() => {
    context = makeContext();
    list = jest.fn(async () => ({
      data: {
        items: [
          neg('run-ordering-api', 'ordering-api'),
          neg('run-other', 'other'),
        ],
      },
    }));
    jest
      .spyOn(context.service(GoogleApisService), 'getClient')
      .mockImplementation(
        async () => ({ regionNetworkEndpointGroups: { list } }) as never,
      );
  });

  describe('SERVERLESS_NEG_BACKENDS', () => {
    it('should list the serverless network endpoint groups routing to Cloud Run services once per location', async () => {
      list
        .mockResolvedValueOnce({
          data: {
            items: [
              neg('run-ordering-api', 'ordering-api'),
              {
                name: 'run-function',
                networkEndpointType: 'SERVERLESS',
                cloudFunction: { function: 'my-function' },
              },
              { name: 'internet', networkEndpointType: 'INTERNET_FQDN_PORT' },
            ],
            nextPageToken: '📄',
          },
        })
        .mockResolvedValueOnce({
          data: { items: [neg('run-ordering-events', 'ordering-events')] },
        });

      const actualResult = await SERVERLESS_NEG_BACKENDS.list(
        context,
        ['my-project'],
        services,
      );

      expect(actualResult).toEqual([
        backend('europe-west1', 'run-ordering-api', 'ordering-api'),
        backend('europe-west1', 'run-ordering-events', 'ordering-events'),
      ]);
      expect(list).toHaveBeenCalledTimes(2);
      expect(list).toHaveBeenNthCalledWith(1, {
        project: 'my-project',
        region: 'europe-west1',
        pageToken: undefined,
      });
      expect(list).toHaveBeenNthCalledWith(2, {
        project: 'my-project',
        region: 'europe-west1',
        pageToken: '📄',
      });
    });

    it('should not list network endpoint groups outside of the given projects', async () => {
      const actualResult = await SERVERLESS_NEG_BACKENDS.list(
        context,
        ['other-project'],
        services,
      );

      expect(actualResult).toBeEmpty();
      expect(list).not.toHaveBeenCalled();
    });

    it('should throw when network endpoint groups cannot be listed', async () => {
      list.mockRejectedValueOnce(new Error('💥'));

      const actualPromise = SERVERLESS_NEG_BACKENDS.list(
        context,
        ['my-project'],
        services,
      );

      await expect(actualPromise).rejects.toThrow(
        "Failed to list the network endpoint groups in project 'my-project' and region 'europe-west1': 💥",
      );
    });
  });

  describe('LoadBalancerBackendsFact', () => {
    it('should not list backends when the graph has no URL map', async () => {
      const graph = {
        ...ENVIRONMENT_GRAPH,
        nodes: {
          infrastructure: {
            ...ENVIRONMENT_GRAPH.nodes?.infrastructure,
            apiRouter: {},
          },
        },
      };
      const environment = await makeEnvironment(context, graph);

      const actualBackends = await environment.get(LoadBalancerBackendsFact);

      expect(actualBackends).toEqual([]);
      expect(
        context.service(GoogleApisService).getClient,
      ).not.toHaveBeenCalled();
    });

    it('should only list the backends of nodes in the projects of the URL maps', async () => {
      const origin = {
        kind: GraphOriginKind.Declared,
        rule: 'test',
        sources: [{ path: 'causa.yaml' }],
      };
      const node = (name: string, type: string, id: string) => ({
        name,
        origin,
        data: { resource: { type, id } },
      });
      const environment = await makeEnvironment(context, {
        name: 'shop',
        nodes: {
          infrastructure: {
            apiRouter: {
              api: node(
                'api',
                'compute.googleapis.com/UrlMap',
                'projects/p1/global/urlMaps/api',
              ),
            },
            service: {
              a: node(
                'a',
                'run.googleapis.com/Service',
                'projects/p1/locations/r1/services/a',
              ),
              b: node(
                'b',
                'run.googleapis.com/Service',
                'projects/p2/locations/r2/services/b',
              ),
            },
          },
        },
      });

      await environment.get(LoadBalancerBackendsFact);

      expect(list).toHaveBeenCalledExactlyOnceWith({
        project: 'p1',
        region: 'r1',
        pageToken: undefined,
      });
    });

    it('should list the backends of the load balancers of the graph', async () => {
      const environment = await makeEnvironment(context);

      const actualBackends = await environment.get(LoadBalancerBackendsFact);

      expect(actualBackends).toEqual([
        backend('europe-west1', 'run-ordering-api', 'ordering-api'),
        backend('europe-west1', 'run-other', 'other'),
      ]);
      expect(environment.facts).toContainEqual({
        name: 'LoadBalancerBackendsFact',
        warnings: [],
      });
    });

    it('should fail when some backends cannot be listed', async () => {
      list.mockRejectedValueOnce(new Error('💥'));
      const environment = await makeEnvironment(context);

      const actualPromise = environment.get(LoadBalancerBackendsFact);

      await expect(actualPromise).rejects.toThrow(GraphFactError);
      expect(environment.failures).toEqual([
        {
          name: 'LoadBalancerBackendsFact',
          message:
            "Failed to list the network endpoint groups in project 'my-project' and region 'europe-west1': 💥",
        },
      ]);
    });
  });
});

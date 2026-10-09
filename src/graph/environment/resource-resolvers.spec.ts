import { WorkspaceContext } from '@causa/workspace';
import type { Graph } from '@causa/workspace-core';
import { GraphEnvironmentContext } from '@causa/workspace-core/graph';
import { jest } from '@jest/globals';
import 'jest-extended';
import { GoogleApisService } from '../../services/index.js';
import { ENVIRONMENT_NODES, makeContext } from './fixture.test.js';
import { CLOUD_TASKS_QUEUE_RESOLVER } from './resource-resolvers.js';

const prefix = (node: string, prefix: string) => ({
  node,
  type: 'cloudtasks.googleapis.com/Queue',
  prefix,
});

const PREFIXES = [
  prefix(
    'queue:order-expiration',
    'projects/my-project/locations/europe-west1/queues/order-expiration-',
  ),
  prefix(
    'queue:order-expiration-late',
    'projects/my-project/locations/europe-west1/queues/order-expiration-late-',
  ),
];

describe('CLOUD_TASKS_QUEUE_RESOLVER', () => {
  let context: WorkspaceContext;
  let list: jest.Mock<(request: any) => Promise<any>>;

  beforeEach(() => {
    context = makeContext();
    list = jest.fn(async (request: any) =>
      request.pageToken
        ? {
            data: {
              queues: [
                {
                  name: 'projects/my-project/locations/europe-west1/queues/order-expiration-late-1',
                },
                {
                  name: 'projects/my-project/locations/europe-west1/queues/order-expiration-late-2',
                },
              ],
            },
          }
        : {
            data: {
              queues: [
                {
                  name: 'projects/my-project/locations/europe-west1/queues/order-expiration-abc',
                },
              ],
              nextPageToken: '📄',
            },
          },
    );
    jest
      .spyOn(context.service(GoogleApisService), 'getClient')
      .mockImplementation(
        async () =>
          ({ projects: { locations: { queues: { list } } } }) as never,
      );
  });

  it('should resolve the names of queues matching their longest prefix', async () => {
    const actualResult = await CLOUD_TASKS_QUEUE_RESOLVER.resolve(
      context,
      PREFIXES,
    );

    expect(actualResult).toEqual({
      ids: new Map([
        [
          'queue:order-expiration',
          'projects/my-project/locations/europe-west1/queues/order-expiration-abc',
        ],
      ]),
      warnings: [
        {
          message:
            "Found 2 Cloud Tasks queues starting with 'projects/my-project/locations/europe-west1/queues/order-expiration-late-' for 'queue:order-expiration-late', instead of one.",
        },
      ],
    });
    expect(list).toHaveBeenCalledTimes(2);
    expect(list).toHaveBeenCalledWith({
      parent: 'projects/my-project/locations/europe-west1',
      pageSize: 1000,
      pageToken: '📄',
    });
  });

  it('should warn when queues cannot be listed', async () => {
    list.mockRejectedValueOnce(new Error('💥'));

    const actualResult = await CLOUD_TASKS_QUEUE_RESOLVER.resolve(
      context,
      PREFIXES,
    );

    expect(actualResult).toEqual({
      ids: new Map(),
      warnings: [
        {
          message:
            "Failed to list the Cloud Tasks queues in 'projects/my-project/locations/europe-west1': 💥",
        },
      ],
    });
  });

  it('should resolve the resources of a graph when its environment context is created', async () => {
    const origin = ENVIRONMENT_NODES[0].node.origin;
    const graph: Graph = {
      nodes: {
        infrastructure: {
          queue: {
            'order-expiration': {
              name: 'order-expiration',
              origin,
              data: {
                resource: {
                  type: 'cloudtasks.googleapis.com/Queue',
                  idPrefix:
                    "projects/${ configuration('google.project') }/locations/europe-west1/queues/order-expiration-",
                },
              },
            },
          },
        },
      },
    };

    list.mockResolvedValueOnce({
      data: {
        queues: [
          {
            name: 'projects/my-project/locations/europe-west1/queues/order-expiration-abc',
          },
        ],
      },
    });

    const environment = await GraphEnvironmentContext.create(context, graph, {
      prefixResolvers: [CLOUD_TASKS_QUEUE_RESOLVER],
    });

    expect(environment.resource('queue:order-expiration')).toEqual({
      type: 'cloudtasks.googleapis.com/Queue',
      id: 'projects/my-project/locations/europe-west1/queues/order-expiration-abc',
    });
    expect(environment.resolution).toEqual({
      resolved: 1,
      removed: 0,
      warnings: [],
    });
  });
});

import type { Graph } from '@causa/workspace-core';
import type { GraphEnvironmentContext } from '@causa/workspace-core/graph';
import 'jest-extended';
import { ENVIRONMENT_NODES, makeEnvironment } from './fixture.test.js';
import { googleResources, parseResourceName } from './resources.js';

describe('resources', () => {
  describe('parseResourceName', () => {
    it('should return the segments of a resource name', () => {
      const actualSegments = parseResourceName(
        'projects/my-project/locations/europe-west1/services/my-service',
      );

      expect(actualSegments).toEqual({
        projects: 'my-project',
        locations: 'europe-west1',
        services: 'my-service',
      });
    });

    it('should skip the global segment', () => {
      const actualSegments = parseResourceName(
        'projects/my-project/global/urlMaps/api',
      );

      expect(actualSegments).toEqual({
        projects: 'my-project',
        urlMaps: 'api',
      });
    });
  });

  describe('googleResources', () => {
    let environment: GraphEnvironmentContext;

    beforeEach(async () => {
      environment = await makeEnvironment();
    });

    it('should list the resources of a type, with the segments of their names', () => {
      const actualServices = googleResources(
        environment,
        'run.googleapis.com/Service',
        'service',
      );
      const actualQueues = googleResources(
        environment,
        'cloudtasks.googleapis.com/Queue',
      );

      expect(
        actualServices.map(({ node, ...rest }) => ({ id: node.id, ...rest })),
      ).toEqual([
        {
          id: 'service:domains/ordering/api#ordering-api',
          type: 'run.googleapis.com/Service',
          name: 'projects/my-project/locations/europe-west1/services/ordering-api',
          segments: {
            projects: 'my-project',
            locations: 'europe-west1',
            services: 'ordering-api',
          },
        },
        {
          id: 'service:domains/ordering/api#ordering-events',
          type: 'run.googleapis.com/Service',
          name: 'projects/my-project/locations/europe-west1/services/ordering-events',
          segments: {
            projects: 'my-project',
            locations: 'europe-west1',
            services: 'ordering-events',
          },
        },
      ]);
      expect(actualQueues.map(({ node, name }) => [node.id, name])).toEqual([
        [
          'queue:order-expiration',
          'projects/my-project/locations/europe-west1/queues/order-expiration-abc',
        ],
      ]);
      expect(
        googleResources(environment, 'run.googleapis.com/Service', 'apiRouter'),
      ).toBeEmpty();
    });

    it('should only list Google Cloud resources', async () => {
      const graph: Graph = {
        nodes: {
          infrastructure: {
            brokerTopic: {
              google: {
                name: 'google',
                origin: ENVIRONMENT_NODES[0].node.origin,
                data: {
                  resource: {
                    type: 'pubsub.googleapis.com/Topic',
                    id: 'projects/my-project/topics/google',
                  },
                },
              },
              other: {
                name: 'other',
                origin: ENVIRONMENT_NODES[0].node.origin,
                data: { resource: { type: 'sns.aws/Topic', id: 'other' } },
              },
            },
          },
        },
      };
      const otherEnvironment = await makeEnvironment(undefined, graph);

      const actualResources = googleResources(otherEnvironment);

      expect(actualResources.map(({ node }) => node.id)).toEqual([
        'brokerTopic:google',
      ]);
    });
  });
});

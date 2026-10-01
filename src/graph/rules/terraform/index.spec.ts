import { WorkspaceContext } from '@causa/workspace';
import {
  buildGraph,
  GraphContext,
  ProjectsFact,
  runGraphRules,
  type WorkspaceProject,
} from '@causa/workspace-core/graph';
import {
  TerraformProjectsFact,
  type TerraformModule,
  type TerraformModuleBlock,
  type TerraformProject,
} from '@causa/workspace-terraform';
import { rm } from 'fs/promises';
import 'jest-extended';
import { CLOUD_RUN_MODULE_SOURCE } from '../../cloud-run.js';
import { setUpGraphFixture, summarize } from '../../fixture.test.js';
import { API_ROUTER_MODULE_SOURCE } from './api-router.js';
import { EVENT_TOPICS_MODULE_SOURCE } from './event-topics.js';
import { GOOGLE_TERRAFORM_GRAPH_RULES } from './index.js';
import { SPANNER_DATABASES_MODULE_SOURCE } from './spanner-databases.js';

const CONFIGURATIONS =
  'infrastructure/backend/../../.causa/project-configurations';

function backendConfiguration(project: WorkspaceProject): TerraformProject {
  const module: TerraformModule = {
    project,
    directory: 'infrastructure/backend',
    domain: undefined,
    address: '',
    via: [],
  };
  const block = (
    name: string,
    source: string,
    args: TerraformModuleBlock['arguments'],
    line: number,
  ): TerraformModuleBlock => ({
    name,
    address: `module.${name}`,
    declaration: {
      path: 'infrastructure/backend/main.tf',
      pointer: `module.${name}`,
      location: { start: { line } },
    },
    source,
    version: '1.0.0',
    module,
    arguments: args,
  });

  return {
    project,
    modules: [module],
    moduleBlocks: [
      block(
        'ordering_api',
        CLOUD_RUN_MODULE_SOURCE,
        {
          configuration_file: { value: `${CONFIGURATIONS}/ordering-api.json` },
          enable_triggers: { value: true },
          enable_public_http_endpoints: { value: true },
          gcp_project_id: { expression: '${var.services_project}' },
        },
        1,
      ),
      block(
        'topics',
        EVENT_TOPICS_MODULE_SOURCE,
        {
          infrastructure_configuration_file: {
            value: `${CONFIGURATIONS}/backend.json`,
          },
        },
        10,
      ),
      block(
        'other_topics',
        EVENT_TOPICS_MODULE_SOURCE,
        { bigquery_raw_events_dataset: { value: 'other_raw_events' } },
        15,
      ),
      block(
        'spanner',
        SPANNER_DATABASES_MODULE_SOURCE,
        {
          infrastructure_configuration_file: {
            value: `${CONFIGURATIONS}/backend.json`,
          },
        },
        20,
      ),
      block('api_router', API_ROUTER_MODULE_SOURCE, {}, 30),
      block('other', 'causa-io/other/google', {}, 50),
    ],
    resourceBlocks: [],
    missingModules: [],
  };
}

describe('GOOGLE_TERRAFORM_GRAPH_RULES', () => {
  let rootPath: string;
  let context: WorkspaceContext;

  beforeEach(async () => {
    ({ rootPath, context } = await setUpGraphFixture());
  });

  afterEach(async () => {
    await rm(rootPath, { recursive: true, force: true });
  });

  it('should mirror the resources created by the Causa Terraform modules', async () => {
    const projects = await new GraphContext(context).get(ProjectsFact);
    const backend = projects.find(
      (p) => p.directory === 'infrastructure/backend',
    )!;
    const graphContext = new GraphContext(context, [
      [TerraformProjectsFact, [backendConfiguration(backend)]],
    ]);

    const results = await runGraphRules(
      GOOGLE_TERRAFORM_GRAPH_RULES,
      graphContext,
    );

    const { graph, rules } = buildGraph(results);
    const { failures } = graphContext;
    expect(rules.map((r) => r.name)).toEqual([
      'cloudRunModule',
      'apiRouterModule',
      'eventTopicsModule',
      'spannerDatabasesModule',
    ]);
    const { nodes, edges } = summarize(graph);
    expect(nodes).toEqual([
      'infrastructure apiRouter:api',
      'infrastructure brokerSubscription:domains/ordering/api#onOrder',
      'infrastructure brokerSubscription:domains/ordering/api#onPartnerOrder',
      'infrastructure brokerSubscription:rawEvents/ordering.order.v1',
      'infrastructure brokerTopic:ordering.order.v1',
      'infrastructure database:google.bigquery/raw_events',
      'infrastructure database:google.spanner/main.ordering',
      'infrastructure google.spanner.instance:main',
      'infrastructure queue:process-order',
      'infrastructure scheduledJob:domains/ordering/api#nightly',
      'infrastructure service:domains/ordering/api#ordering-api',
      'infrastructure table:google.bigquery/raw_events#ordering_order_v1',
      'infrastructure table:google.spanner/main.ordering#Order',
    ]);
    expect(edges).toEqual([
      'accesses service:domains/ordering/api#ordering-api -> database:google.spanner/main.ordering',
      'accesses service:domains/ordering/api#ordering-api -> table:google.firestore/(default)#carts',
      'delivers brokerTopic:ordering.order.v1 -> brokerSubscription:domains/ordering/api#onOrder',
      'delivers brokerTopic:ordering.order.v1 -> brokerSubscription:domains/ordering/api#onPartnerOrder',
      'delivers brokerTopic:ordering.order.v1 -> brokerSubscription:rawEvents/ordering.order.v1',
      'deploys project:infrastructure/backend -> apiRouter:api',
      'deploys project:infrastructure/backend -> brokerSubscription:domains/ordering/api#onOrder',
      'deploys project:infrastructure/backend -> brokerSubscription:domains/ordering/api#onPartnerOrder',
      'deploys project:infrastructure/backend -> brokerSubscription:rawEvents/ordering.order.v1',
      'deploys project:infrastructure/backend -> brokerTopic:ordering.order.v1',
      'deploys project:infrastructure/backend -> database:google.bigquery/raw_events',
      'deploys project:infrastructure/backend -> database:google.spanner/main.ordering',
      'deploys project:infrastructure/backend -> google.spanner.instance:main',
      'deploys project:infrastructure/backend -> queue:process-order',
      'deploys project:infrastructure/backend -> scheduledJob:domains/ordering/api#nightly',
      'deploys project:infrastructure/backend -> service:domains/ordering/api#ordering-api',
      'deploys project:infrastructure/backend -> table:google.bigquery/raw_events#ordering_order_v1',
      'deploys project:infrastructure/backend -> table:google.spanner/main.ordering#Order',
      'enqueues service:domains/ordering/api#ordering-api -> queue:process-order',
      'publishes service:domains/ordering/api#ordering-api -> brokerTopic:ordering.order.v1',
      'realizes brokerSubscription:domains/ordering/api#onOrder -> trigger:domains/ordering/api#onOrder',
      'realizes brokerSubscription:domains/ordering/api#onPartnerOrder -> trigger:domains/ordering/api#onPartnerOrder',
      'realizes brokerTopic:ordering.order.v1 -> topic:ordering.order.v1',
      'realizes queue:process-order -> trigger:domains/ordering/api#processOrder',
      'realizes scheduledJob:domains/ordering/api#nightly -> trigger:domains/ordering/api#nightly',
      'realizes service:domains/ordering/api#ordering-api -> project:domains/ordering/api',
      'realizes table:google.spanner/main.ordering#Order -> entity:domains/ordering/entities/order.yaml',
      'routes apiRouter:api -> service:domains/ordering/api#ordering-api',
      'targets brokerSubscription:domains/ordering/api#onOrder -> service:domains/ordering/api#ordering-api',
      'targets brokerSubscription:domains/ordering/api#onPartnerOrder -> service:domains/ordering/api#ordering-api',
      'targets brokerSubscription:rawEvents/ordering.order.v1 -> table:google.bigquery/raw_events#ordering_order_v1',
      'targets queue:process-order -> service:domains/ordering/api#ordering-api',
      'targets scheduledJob:domains/ordering/api#nightly -> service:domains/ordering/api#ordering-api',
    ]);
    const infrastructure = graph.nodes?.infrastructure as any;
    expect(
      infrastructure.service['domains/ordering/api#ordering-api'].data,
    ).toMatchObject({
      resource: {
        type: 'run.googleapis.com/Service',
        id: "projects/${ configuration('google.project') }/locations/${ configuration('google.cloudRun.location') }/services/ordering-api",
        scope: 'project:domains/ordering/api',
      },
    });
    expect(infrastructure.brokerTopic['ordering.order.v1'].data).toEqual({
      resource: {
        type: 'pubsub.googleapis.com/Topic',
        id: "projects/${ configuration('google.project') }/topics/ordering.order.v1",
        scope: 'project:infrastructure/backend',
      },
    });
    expect(infrastructure.queue['process-order'].data.resource).toEqual({
      type: 'cloudtasks.googleapis.com/Queue',
      idPrefix:
        "projects/${ configuration('google.project') }/locations/${ configuration('google.cloudRun.location') }/queues/process-order-",
      scope: 'project:domains/ordering/api',
    });
    expect(graph.edges?.routes?.[0].data).toEqual({ paths: ['/orders'] });
    expect(
      graph.edges?.deploys?.find(
        (e) => e.to === 'service:domains/ordering/api#ordering-api',
      )?.origin,
    ).toEqual({
      kind: 'declared',
      rule: 'cloudRunModule',
      sources: [
        {
          path: 'infrastructure/backend/main.tf',
          pointer: 'module.ordering_api',
          location: { start: { line: 1 } },
        },
      ],
    });
    expect(rules.flatMap((r) => r.warnings)).toEqual([
      {
        message:
          'The event topics module block is skipped: only the first one is processed, as several blocks would create resources with the same IDs.',
        sources: [
          {
            path: 'infrastructure/backend/main.tf',
            pointer: 'module.other_topics',
            location: { start: { line: 15 } },
          },
        ],
      },
    ]);
    expect(graphContext.facts).toContainEqual(
      expect.objectContaining({
        name: 'CloudRunFact',
        warnings: [
          {
            message:
              "The argument 'gcp_project_id' is computed (${var.services_project}). Assuming the 'google.project' configuration.",
            sources: [
              {
                path: 'infrastructure/backend/main.tf',
                pointer: 'module.ordering_api',
                location: { start: { line: 1 } },
              },
            ],
          },
        ],
      }),
    );
    expect(failures).toEqual([]);
  });
});

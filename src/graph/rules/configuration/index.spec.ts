import { WorkspaceContext } from '@causa/workspace';
import {
  buildGraph,
  GraphContext,
  runGraphRules,
} from '@causa/workspace-core/graph';
import { rm } from 'fs/promises';
import 'jest-extended';
import { setUpGraphFixture, summarize } from '../../fixture.test.js';
import { GOOGLE_GRAPH_RULES } from './index.js';

describe('GOOGLE_GRAPH_RULES', () => {
  let rootPath: string;
  let context: WorkspaceContext;

  beforeEach(async () => {
    ({ rootPath, context } = await setUpGraphFixture());
  });

  afterEach(async () => {
    await rm(rootPath, { recursive: true, force: true });
  });

  it('should extract the Google elements declared by the configuration and the model', async () => {
    const graphContext = new GraphContext(context);

    const results = await runGraphRules(GOOGLE_GRAPH_RULES, graphContext);

    const { graph, rules } = buildGraph(results);
    const { failures } = graphContext;
    const { nodes, edges } = summarize(graph);
    expect(nodes).toEqual([
      'infrastructure database:google.firestore/(default)',
      'infrastructure table:google.firestore/(default)#carts',
    ]);
    expect(edges).toEqual([
      'accesses project:domains/ordering/api -> entity:domains/ordering/entities/cart.yaml',
      'accesses project:domains/ordering/api -> entity:domains/ordering/entities/order.yaml',
      'delivers topic:ordering.order.v1 -> trigger:domains/ordering/api#onPartnerOrder',
      'enqueues project:domains/ordering/api -> trigger:domains/ordering/api#processOrder',
      'realizes table:google.firestore/(default)#carts -> entity:domains/ordering/entities/cart.yaml',
    ]);
    const infrastructure = graph.nodes?.infrastructure as any;
    expect(infrastructure.database['google.firestore/(default)'].data).toEqual({
      engine: 'google.firestore',
      resource: {
        type: 'firestore.googleapis.com/Database',
        id: "projects/${ configuration('google.project') }/databases/${ configuration('google.firestore.database') }",
      },
    });
    expect(infrastructure.table['google.firestore/(default)#carts']).toEqual(
      expect.objectContaining({
        parent: 'database:google.firestore/(default)',
        name: 'carts',
      }),
    );
    expect(graph.edges?.accesses?.[1].origin.sources).toContainEqual({
      path: 'domains/ordering/spanner/orders.sql',
      pointer: 'CREATE TABLE Order',
      location: { start: { line: 2 } },
    });
    expect(graph.edges?.enqueues?.[0].origin.kind).toEqual('inferred');
    expect(rules.map((r) => r.name)).toEqual([
      'firestoreFromConfiguration',
      'googleServiceContainerFromConfiguration',
      'enqueuesAssumedFromGoogleTaskTrigger',
    ]);
    expect(rules.flatMap((r) => r.warnings)).toEqual([]);
    expect(failures).toEqual([]);
  });
});

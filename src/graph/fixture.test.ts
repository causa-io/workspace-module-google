import { loadWorkspaceConfiguration, WorkspaceContext } from '@causa/workspace';
import {
  EventTopicList,
  ModelSchemaExtractDatabase,
  ModelSchemaParse,
  type Graph,
} from '@causa/workspace-core';
import { loadSchemas } from '@causa/workspace-core/jsonschema';
import { createContext, registerMockFunction } from '@causa/workspace/testing';
import { mkdir, mkdtemp, readFile, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { dirname, join, resolve } from 'path';
import { pino } from 'pino';
import { ModelSchemaExtractDatabaseForGoogleFirestore } from '../functions/google-firestore/index.js';
import {
  GoogleSpannerListDatabases,
  ModelSchemaExtractDatabaseForGoogleSpanner,
} from '../functions/google-spanner/index.js';

const FIXTURE: Record<string, string> = {
  'causa.yaml': `
workspace:
  name: shop
model:
  schema: jsonschema
  globs:
    - domains/*/entities/*.yaml
    - domains/*/events/**/*.yaml
events:
  topics:
    globs: [domains/*/events/*/v*.yaml]
infrastructure:
  environmentProject: infrastructure/backend
google:
  project: shop-dev
  firestore:
    database: (default)
  spanner:
    instance:
      name: main
  pubSub:
    bigQueryStorage:
      rawEventsDatasetId: raw_events
  cloudRun:
    location: europe-west1
`,
  'domains/ordering/causa.yaml': `
domain:
  name: Ordering
`,
  'domains/ordering/api/causa.yaml': `
project:
  name: ordering-api
  type: serviceContainer
  language: typescript
serviceContainer:
  endpoints:
    http: [/orders]
  triggers:
    onOrder:
      type: event
      topic: ordering.order.v1
      endpoint: { type: http, path: /events/order }
    onPartnerOrder:
      type: google.pubSub
      topic: ordering.order.v1
      endpoint: { type: http, path: /events/partner }
    processOrder:
      type: google.task
      queue: process-order
      endpoint: { type: http, path: /tasks/order }
    nightly:
      type: cron
      schedule: 0 0 * * *
      endpoint: { type: http, path: /cron/nightly }
  outputs:
    eventTopics: [ordering.order.v1]
    google.spanner: [main.ordering]
    google.firestore: [carts]
`,
  'domains/ordering/spanner/orders.sql': `-- The orders.
CREATE TABLE Order (
  id STRING(36) NOT NULL,
) PRIMARY KEY (id);
`,
  'domains/ordering/entities/order.yaml': `
title: Order
type: object
causa:
  googleSpannerTable:
    primaryKey: [id]
properties:
  id:
    type: string
`,
  'domains/ordering/entities/cart.yaml': `
title: Cart
type: object
causa:
  googleFirestoreCollection:
    name: carts
    path: [{ property: id }]
properties:
  id:
    type: string
`,
  'domains/ordering/events/order/v1.yaml': `
title: OrderEvent
type: object
properties:
  data:
    $ref: ../../entities/order.yaml
`,
  'infrastructure/backend/causa.yaml': `
project:
  name: backend
  type: infrastructure
  language: terraform
google:
  project: shop-backend
`,
};

export const FIXTURE_TOPIC = 'ordering.order.v1';

export async function setUpGraphFixture(): Promise<{
  rootPath: string;
  context: WorkspaceContext;
}> {
  const rootPath = resolve(await mkdtemp(join(tmpdir(), 'causa-tests-')));
  for (const [file, content] of Object.entries(FIXTURE)) {
    await mkdir(dirname(join(rootPath, file)), { recursive: true });
    await writeFile(join(rootPath, file), content);
  }

  const logger = pino({ level: 'silent' });
  const { configuration } = await loadWorkspaceConfiguration(
    rootPath,
    null,
    logger,
  );
  const { context, functionRegistry } = createContext({
    workingDirectory: rootPath,
    rootPath,
    projectPath: null,
    configuration,
    logger,
    functions: [
      GoogleSpannerListDatabases,
      ModelSchemaExtractDatabaseForGoogleFirestore,
      ModelSchemaExtractDatabaseForGoogleSpanner,
    ],
  });
  registerMockFunction(functionRegistry, EventTopicList, async () => [
    {
      id: FIXTURE_TOPIC,
      formatParts: {},
      schemaFilePath: join(rootPath, 'domains/ordering/events/order/v1.yaml'),
    },
  ]);
  registerMockFunction(
    functionRegistry,
    ModelSchemaParse,
    async (context, { paths }) => {
      const result = await loadSchemas(paths, {
        fileReader: (path) => readFile(path, 'utf-8'),
      });
      for (const schema of Object.values(result.schemas)) {
        if (schema.kind === 'object') {
          schema.databases = context
            .callAll(ModelSchemaExtractDatabase, { schema })
            .filter((db) => db);
        }
      }

      return result;
    },
  );

  return { rootPath, context };
}

export function summarize(graph: Graph) {
  const nodes = Object.entries(graph.nodes ?? {}).flatMap(([layer, byType]) =>
    Object.entries(byType ?? {}).flatMap(([type, byLocator]) =>
      Object.keys(byLocator as object).map((l) => `${layer} ${type}:${l}`),
    ),
  );
  const edges = Object.entries(graph.edges ?? {}).flatMap(([type, list]) =>
    (list as any[]).map((e) => `${type} ${e.from} -> ${e.to}`),
  );
  return { nodes, edges };
}

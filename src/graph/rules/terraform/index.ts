import type { GraphRule } from '@causa/workspace-core';
import { apiRouterModule } from './api-router.js';
import { cloudRunModule } from './cloud-run-module.js';
import { eventTopicsModule } from './event-topics.js';
import { spannerDatabasesModule } from './spanner-databases.js';

/**
 * The Google rules mirroring the Causa Terraform modules, grouped by module.
 */
export const GOOGLE_TERRAFORM_GRAPH_RULES: readonly GraphRule[] = [
  cloudRunModule,
  apiRouterModule,
  eventTopicsModule,
  spannerDatabasesModule,
];

import type { GraphRule } from '@causa/workspace-core';
import { apiRouterModule } from './api-router.js';
import { spannerDatabasesModule } from './spanner-databases.js';

/**
 * The Google rules mirroring the Causa Terraform modules, grouped by module.
 */
export const GOOGLE_TERRAFORM_GRAPH_RULES: readonly GraphRule[] = [
  apiRouterModule,
  spannerDatabasesModule,
];

import type { GraphRule } from '@causa/workspace-core';
import { enqueuesAssumedFromGoogleTaskTrigger } from './enqueues-assumed-from-google-task-trigger.js';
import { firestoreFromConfiguration } from './firestore.js';
import { googleServiceContainerFromConfiguration } from './service-container.js';

/**
 * The Google rules reading the workspace configuration and model, independently of the infrastructure code.
 */
export const GOOGLE_GRAPH_RULES: readonly GraphRule[] = [
  firestoreFromConfiguration,
  googleServiceContainerFromConfiguration,
  enqueuesAssumedFromGoogleTaskTrigger,
];

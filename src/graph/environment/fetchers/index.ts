import type { GraphEnvironmentFetcher } from '@causa/workspace-core';
import { googleConsoleLinks } from './console-links.js';

/**
 * The fetchers of environment data and metrics for Google Cloud.
 */
export const GOOGLE_GRAPH_ENVIRONMENT_FETCHERS: GraphEnvironmentFetcher[] = [
  googleConsoleLinks,
];

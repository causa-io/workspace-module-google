import { GraphListRules, type GraphRule } from '@causa/workspace-core';
import {
  GOOGLE_GRAPH_RULES,
  GOOGLE_TERRAFORM_GRAPH_RULES,
} from '../../graph/index.js';

/**
 * Implements {@link GraphListRules} for Google Cloud.
 * The rules read the Google-specific parts of the workspace configuration and model (Firestore collections, the
 * entities projects access through their `google.*` outputs, triggers of Google-specific types), and mirror the
 * resources created by the Causa Terraform modules for Google Cloud.
 */
export class GraphListRulesForGoogle extends GraphListRules {
  _call(): GraphRule[] {
    return [...GOOGLE_GRAPH_RULES, ...GOOGLE_TERRAFORM_GRAPH_RULES];
  }

  _supports(): boolean {
    return true;
  }
}

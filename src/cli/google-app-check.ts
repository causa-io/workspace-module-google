import type { ParentCliCommandDefinition } from '@causa/cli';
import { googleCommandDefinition } from './google.js';

/**
 * The parent `google appCheck` command.
 */
export const appCheckCommandDefinition: ParentCliCommandDefinition = {
  parent: googleCommandDefinition,
  name: 'appCheck',
  description: 'Performs AppCheck-related operations.',
};

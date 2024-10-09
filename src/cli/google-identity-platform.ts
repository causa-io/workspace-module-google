import type { ParentCliCommandDefinition } from '@causa/cli';
import { googleCommandDefinition } from './google.js';

/**
 * The parent `google identityPlatform` command.
 */
export const identityPlatformCommandDefinition: ParentCliCommandDefinition = {
  parent: googleCommandDefinition,
  name: 'identityPlatform',
  description: 'Performs Identity Platform-related operations.',
};

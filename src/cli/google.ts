import type { ParentCliCommandDefinition } from '@causa/cli';

/**
 * The parent `google` command.
 */
export const googleCommandDefinition: ParentCliCommandDefinition = {
  name: 'google',
  description: 'Performs GCP-specific operations.',
};

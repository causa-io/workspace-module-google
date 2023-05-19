import { ParentCliCommandDefinition } from '@causa/cli';
import { googleCommandDefinition } from './google.js';

/**
 * The parent `google firebaseStorage` command.
 */
export const firebaseStorageCommandDefinition: ParentCliCommandDefinition = {
  parent: googleCommandDefinition,
  name: 'firebaseStorage',
  description: 'Performs Firebase Storage-related operations.',
};

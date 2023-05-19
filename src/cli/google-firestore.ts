import { ParentCliCommandDefinition } from '@causa/cli';
import { googleCommandDefinition } from './google.js';

/**
 * The parent `google firestore` command.
 */
export const firestoreCommandDefinition: ParentCliCommandDefinition = {
  parent: googleCommandDefinition,
  name: 'firestore',
  description: 'Performs Firestore database-related operations.',
};

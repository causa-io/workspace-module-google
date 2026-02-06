import type { ModuleRegistrationFunction } from '@causa/workspace';
import { registerFunctions } from './functions/index.js';

const registerModule: ModuleRegistrationFunction = async (context) => {
  registerFunctions(context);
};

export * from './configurations/index.js';
export default registerModule;

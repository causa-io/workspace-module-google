import { CausaListConfigurationSchemas } from '@causa/workspace-core';
import { globby } from 'globby';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

/**
 * The directory containing the configuration schemas provided by this module.
 */
const SCHEMAS_DIRECTORY = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../configurations/schemas',
);

/**
 * Implements {@link CausaListConfigurationSchemas} for the Google module.
 * Returns the paths to the configuration schemas bundled with this package.
 */
export class CausaListConfigurationSchemasForGoogle extends CausaListConfigurationSchemas {
  async _call(): Promise<string[]> {
    return await globby('*.yaml', {
      cwd: SCHEMAS_DIRECTORY,
      absolute: true,
    });
  }

  _supports(): boolean {
    return true;
  }
}

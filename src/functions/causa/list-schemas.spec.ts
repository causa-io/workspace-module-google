import { CausaListConfigurationSchemas } from '@causa/workspace-core';
import { createContext } from '@causa/workspace/testing';
import 'jest-extended';
import { basename } from 'path';
import { CausaListConfigurationSchemasForGoogle } from './list-schemas.js';

describe('CausaListConfigurationSchemasForGoogle', () => {
  it('should return the configuration schemas for the Google module', async () => {
    const { context } = createContext({
      configuration: { workspace: { name: 'test' } },
      functions: [CausaListConfigurationSchemasForGoogle],
    });

    const actualSchemas = await context.call(CausaListConfigurationSchemas, {});

    const actualBaseNames = actualSchemas.map((s) => basename(s));
    expect(actualBaseNames).toIncludeSameMembers([
      'events.yaml',
      'google.yaml',
      'infrastructure.yaml',
      'secrets.yaml',
      'serverless-functions.yaml',
      'service-container.yaml',
    ]);
  });
});

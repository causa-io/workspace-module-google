import type {
  TerraformModule,
  TerraformModuleBlock,
} from '@causa/workspace-terraform';
import {
  GraphContext,
  type GraphWarning,
  type WorkspaceProject,
} from '@causa/workspace-core/graph';
import { createContext } from '@causa/workspace/testing';
import { pino } from 'pino';
import { argumentOrConfiguration, blockResource } from './terraform-modules.js';

describe('terraform-modules', () => {
  const block = (
    args: TerraformModuleBlock['arguments'],
  ): TerraformModuleBlock => ({
    name: 'service',
    address: 'module.service',
    declaration: { path: 'main.tf', pointer: 'module.service' },
    module: {} as TerraformModule,
    arguments: args,
  });

  describe('argumentOrConfiguration', () => {
    it('should reference the configuration when the argument is not set', () => {
      const warnings: GraphWarning[] = [];

      const actualPart = argumentOrConfiguration(
        block({}),
        'location',
        'google.location',
        warnings,
      );

      expect(actualPart).toEqual({ configuration: 'google.location' });
      expect(warnings).toEqual([]);
    });

    it.each([null, ''])(
      'should reference the configuration when the argument is %j',
      (value) => {
        const warnings: GraphWarning[] = [];

        const actualPart = argumentOrConfiguration(
          block({ location: { value } }),
          'location',
          'google.location',
          warnings,
        );

        expect(actualPart).toEqual({ configuration: 'google.location' });
        expect(warnings).toEqual([]);
      },
    );

    it('should inline a literal argument', () => {
      const warnings: GraphWarning[] = [];

      const actualPart = argumentOrConfiguration(
        block({ location: { value: 'europe-west1' } }),
        'location',
        'google.location',
        warnings,
      );

      expect(actualPart).toEqual('europe-west1');
      expect(warnings).toEqual([]);
    });

    it('should fall back to the configuration for a computed argument, and warn about it', () => {
      const warnings: GraphWarning[] = [];

      const actualPart = argumentOrConfiguration(
        block({ location: { expression: '${var.location}' } }),
        'location',
        'google.location',
        warnings,
      );

      expect(actualPart).toEqual({ configuration: 'google.location' });
      expect(warnings).toEqual([
        {
          message:
            "The argument 'location' is computed (${var.location}). Assuming the 'google.location' configuration.",
          sources: [{ path: 'main.tf', pointer: 'module.service' }],
        },
      ]);
    });

    it('should fall back to the configuration for a literal argument that is not a string, and warn about it', () => {
      const warnings: GraphWarning[] = [];

      const actualPart = argumentOrConfiguration(
        block({ location: { value: ['europe-west1'] } }),
        'location',
        'google.location',
        warnings,
      );

      expect(actualPart).toEqual({ configuration: 'google.location' });
      expect(warnings).toEqual([
        {
          message:
            "The argument 'location' is computed ([\"europe-west1\"]). Assuming the 'google.location' configuration.",
          sources: [{ path: 'main.tf', pointer: 'module.service' }],
        },
      ]);
    });
  });

  describe('blockResource', () => {
    const { context } = createContext({
      configuration: {
        workspace: { name: 'shop' },
        google: { project: 'shop-common' },
      },
      logger: pino({ level: 'silent' }),
    });
    const graph = new GraphContext(context);
    const scope = {
      directory: 'infrastructure/common',
      context,
    } as WorkspaceProject;
    const appliedBy = (environment: boolean): TerraformModuleBlock => ({
      ...block({}),
      module: { project: { environment } } as TerraformModule,
    });
    const id = ['projects/', { configuration: 'google.project' }, '/topics/t'];

    it('should reference the configuration when the block is applied by the environment project', async () => {
      const warnings: GraphWarning[] = [];

      const actualResource = await blockResource(
        graph,
        appliedBy(true),
        { type: 'pubsub.googleapis.com/Topic', scope, id },
        warnings,
      );

      expect(actualResource).toEqual({
        type: 'pubsub.googleapis.com/Topic',
        id: "projects/${ configuration('google.project') }/topics/t",
        scope: 'project:infrastructure/common',
      });
      expect(warnings).toEqual([]);
    });

    it('should render the identifier when the block is not applied by the environment project', async () => {
      const warnings: GraphWarning[] = [];

      const actualResources = await Promise.all([
        blockResource(
          graph,
          appliedBy(false),
          { type: 'pubsub.googleapis.com/Topic', scope, id },
          warnings,
        ),
        blockResource(
          graph,
          appliedBy(false),
          { type: 'cloudtasks.googleapis.com/Queue', id, prefix: true },
          warnings,
        ),
      ]);

      expect(actualResources).toEqual([
        {
          type: 'pubsub.googleapis.com/Topic',
          id: 'projects/shop-common/topics/t',
        },
        {
          type: 'cloudtasks.googleapis.com/Queue',
          idPrefix: 'projects/shop-common/topics/t',
        },
      ]);
      expect(warnings).toEqual([]);
    });

    it('should reference the configuration and warn when the identifier cannot be rendered', async () => {
      const warnings: GraphWarning[] = [];

      const actualResource = await blockResource(
        graph,
        appliedBy(false),
        {
          type: 'pubsub.googleapis.com/Topic',
          scope,
          id: [{ configuration: 'google.missing' }],
        },
        warnings,
      );

      expect(actualResource).toEqual({
        type: 'pubsub.googleapis.com/Topic',
        id: "${ configuration('google.missing') }",
        scope: 'project:infrastructure/common',
      });
      expect(warnings).toEqual([
        {
          message:
            "The identifier of the 'pubsub.googleapis.com/Topic' resource cannot be rendered, although the block is not applied by the environment project: An error occurred while rendering template '${ configuration('google.missing') }': 'An error occurred while evaluating 'configuration(google.missing)'.'.",
          sources: [{ path: 'main.tf', pointer: 'module.service' }],
        },
      ]);
    });
  });
});

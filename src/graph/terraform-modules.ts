import type { WorkspaceContext } from '@causa/workspace';
import {
  graphTemplate,
  projectId,
  ProjectsFact,
  renderGraphTemplate,
  type GraphContext,
  type GraphResource,
  type GraphTemplatePart,
  type GraphWarning,
  type WorkspaceProject,
} from '@causa/workspace-core/graph';
import {
  modulesWithSource,
  TerraformProjectsFact,
  type TerraformArgument,
  type TerraformBlock,
  type TerraformModuleBlock,
} from '@causa/workspace-terraform';
import { basename } from 'path';

/**
 * Finds the project whose configuration file a block reads. The argument is a path ending with `<project name>.json`,
 * the file written by `ProjectWriteConfigurations`.
 *
 * @param argument The argument of the module block referencing the configuration file.
 * @param projects The projects of the workspace.
 * @returns The project, or `undefined` if the argument does not name a project of the workspace.
 */
export function projectOfConfigurationFile(
  argument: TerraformArgument | undefined,
  projects: readonly WorkspaceProject[],
): WorkspaceProject | undefined {
  if (argument === undefined) {
    return undefined;
  }

  const path = 'value' in argument ? argument.value : argument.expression;
  if (typeof path !== 'string') {
    return undefined;
  }

  const file = basename(path);
  if (!/^[^${}]+\.json$/.test(file)) {
    return undefined;
  }

  const name = file.slice(0, -'.json'.length);
  return projects.find((p) => p.name === name);
}

/**
 * A block of a workspace-level module, which reads the configuration of an infrastructure project
 * (`infrastructure_configuration_file`).
 */
export type InfrastructureModule = {
  /**
   * The module block.
   */
  readonly block: TerraformModuleBlock;

  /**
   * The infrastructure project whose configuration the module reads.
   */
  readonly project: WorkspaceProject | undefined;

  /**
   * The context whose configuration the module reads: the project's if it is found, otherwise the workspace's.
   */
  readonly context: WorkspaceContext;
};

/**
 * Returns the blocks of a workspace-level module, along with the context whose configuration each reads. The workspace
 * context is used when the infrastructure project cannot be found.
 *
 * @param graph The context of the extraction.
 * @param source The source of the module, e.g. `causa-io/event-topics-pubsub/google`.
 * @returns The blocks of the module.
 */
export async function infrastructureModules(
  graph: GraphContext,
  source: string,
): Promise<InfrastructureModule[]> {
  const [terraformProjects, projects] = await Promise.all([
    graph.get(TerraformProjectsFact),
    graph.get(ProjectsFact),
  ]);
  return modulesWithSource(terraformProjects, source).map((block) => {
    const project = projectOfConfigurationFile(
      block.arguments['infrastructure_configuration_file'],
      projects,
    );
    return { block, project, context: project?.context ?? graph.context };
  });
}

/**
 * Returns a string argument of a module block, or a reference to the configuration the module falls back to, mirroring
 * the `coalesce(var.<argument>, <configuration>)` logic of the Causa Terraform modules. When the block passes the
 * argument but it cannot be evaluated as a string, the configuration is assumed, and a warning is raised.
 *
 * @param block The module block.
 * @param argument The name of the module variable.
 * @param configuration The path to the configuration value the module falls back to.
 * @param warnings The warnings to which the one about a computed argument is added.
 * @returns The literal value of the argument, or a reference to the configuration.
 */
export function argumentOrConfiguration(
  block: TerraformModuleBlock,
  argument: string,
  configuration: string,
  warnings: GraphWarning[],
): GraphTemplatePart {
  const value = block.arguments[argument];
  if (
    value === undefined ||
    ('value' in value && (value.value === null || value.value === ''))
  ) {
    return { configuration };
  }

  if ('value' in value && typeof value.value === 'string') {
    return value.value;
  }

  const expression =
    'expression' in value ? value.expression : JSON.stringify(value.value);
  warnings.push({
    message: `The argument '${argument}' is computed (${expression}). Assuming the '${configuration}' configuration.`,
    sources: [block.declaration],
  });
  return { configuration };
}

/**
 * The infrastructure resource created by a Terraform block, before its identifier is built.
 */
export type BlockResource = {
  /**
   * The type of the resource, e.g. `pubsub.googleapis.com/Topic`.
   */
  readonly type: string;

  /**
   * The project whose configuration the block reads, if any. Otherwise, the workspace configuration is used.
   */
  readonly scope?: WorkspaceProject;

  /**
   * The parts of the identifier of the resource.
   */
  readonly id: GraphTemplatePart[];

  /**
   * Whether {@link BlockResource.id} is only a prefix of the identifier, when the full identifier cannot be known from
   * the workspace.
   */
  readonly prefix?: boolean;
};

/**
 * Returns the infrastructure resource a Terraform block creates.
 * A block applied by the environment project creates the resource once per environment: its identifier references
 * the configuration, to be rendered for a given environment, using the configuration of the scope. Other
 * infrastructure projects do not depend on the environment: the identifier is rendered, and the resource has no
 * scope. If it cannot be rendered, a warning is raised and the identifier references the configuration.
 *
 * @param graph The context of the extraction.
 * @param block The block creating the resource.
 * @param resource The resource.
 * @param warnings The warnings to which the one about an identifier that cannot be rendered is added.
 * @returns The {@link GraphResource}.
 */
export async function blockResource(
  graph: GraphContext,
  block: TerraformBlock,
  resource: BlockResource,
  warnings: GraphWarning[],
): Promise<GraphResource> {
  const { type, scope, id, prefix } = resource;
  const build = (id: string, scope?: string): GraphResource => ({
    type,
    ...(prefix ? { idPrefix: id } : { id }),
    ...(scope ? { scope } : {}),
  });
  const templated = build(
    graphTemplate(...id),
    scope && projectId(scope.directory),
  );
  if (block.module.project.environment) {
    return templated;
  }

  try {
    const context = scope?.context ?? graph.context;
    return build(await renderGraphTemplate(context, ...id));
  } catch (error: any) {
    warnings.push({
      message: `The identifier of the '${type}' resource cannot be rendered, although the block is not applied by the environment project: ${error.message}`,
      sources: [block.declaration],
    });
    return templated;
  }
}

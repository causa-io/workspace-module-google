import type { ServiceContainerConfiguration } from '@causa/workspace-core';
import {
  GraphFact,
  ProjectsFact,
  serviceId,
  type GraphContext,
  type GraphFactOutput,
  type GraphTemplatePart,
  type GraphWarning,
  type WorkspaceProject,
} from '@causa/workspace-core/graph';
import {
  modulesWithSource,
  TerraformProjectsFact,
  type TerraformModuleBlock,
} from '@causa/workspace-terraform';
import {
  argumentOrConfiguration,
  projectOfConfigurationFile,
} from './terraform-modules.js';

/**
 * A trigger defined in the `serviceContainer.triggers` configuration.
 */
type ServiceContainerTrigger = NonNullable<
  NonNullable<ServiceContainerConfiguration['serviceContainer']>['triggers']
>[string];

/**
 * The source of the Causa Terraform module deploying a service container to Cloud Run.
 */
export const CLOUD_RUN_MODULE_SOURCE =
  'causa-io/service-container-cloud-run/google';

/**
 * The major version of the Cloud Run module whose behavior is mirrored (trigger filters, IAM grants, resource names).
 */
const MIRRORED_CLOUD_RUN_MAJOR = 1;

/**
 * A block of the Cloud Run module, i.e. a deployed service, with the module's logic evaluated from the block's
 * arguments and the project's configuration.
 */
export type CloudRunService = {
  /**
   * The Terraform module block defining the Cloud Run service.
   */
  readonly block: TerraformModuleBlock;

  /**
   * The project whose configuration file the block reads.
   */
  readonly project: WorkspaceProject;

  /**
   * The name of the service, `coalesce(var.name, project.name)`.
   */
  readonly name: string;

  /**
   * The ID of the `service` node.
   */
  readonly id: string;

  /**
   * Whether the service's HTTP endpoints are exposed through the API router (`enable_public_http_endpoints`, `false` by
   * default).
   */
  readonly enablePublicHttpEndpoints: boolean;

  /**
   * Whether the block grants the publisher role on the project's `outputs.eventTopics` (`set_pubsub_permissions`,
   * defaulting to `set_iam_permissions`).
   */
  readonly setPubsubPermissions: boolean;

  /**
   * Whether the block grants access to the Spanner databases of the project's outputs (`set_spanner_permissions`,
   * defaulting to `set_iam_permissions`).
   */
  readonly setSpannerPermissions: boolean;

  /**
   * Whether the block grants access to the Firestore database for the collections of the project's outputs
   * (`set_firestore_permissions`, defaulting to `set_iam_permissions`).
   */
  readonly setFirestorePermissions: boolean;

  /**
   * Whether the block grants the enqueuer role on the queues of the project's task triggers (`set_tasks_permissions`,
   * defaulting to `set_iam_permissions`).
   */
  readonly setTasksPermissions: boolean;

  /**
   * The triggers the module turns into Pub/Sub push subscriptions, keyed by name: `event` or `google.pubSub` triggers
   * with an HTTP endpoint, not disabled.
   */
  readonly pubsubTriggers: ReadonlyMap<string, ServiceContainerTrigger>;

  /**
   * The triggers the module turns into Cloud Tasks queues, keyed by name. A disabled trigger still has its * queue,
   * paused.
   */
  readonly tasksTriggers: ReadonlyMap<string, ServiceContainerTrigger>;

  /**
   * The triggers the module turns into Cloud Scheduler jobs, keyed by name. A disabled trigger still has its job,
   * paused.
   */
  readonly cronTriggers: ReadonlyMap<string, ServiceContainerTrigger>;

  /**
   * The GCP project part of resource names.
   */
  readonly projectPart: GraphTemplatePart;

  /**
   * The location part of resource names, shared by the service, its queues, and its jobs.
   */
  readonly locationPart: GraphTemplatePart;
};

/**
 * The blocks of the Cloud Run module, evaluated against the configuration of the projects they deploy.
 * Blocks whose `configuration_file` does not name a project of the workspace cannot be mirrored, and are reported.
 */
export class CloudRunFact extends GraphFact<CloudRunService[]> {
  async compute(
    graph: GraphContext,
  ): Promise<GraphFactOutput<CloudRunService[]>> {
    const [terraformProjects, projects] = await Promise.all([
      graph.get(TerraformProjectsFact),
      graph.get(ProjectsFact),
    ]);
    const services: CloudRunService[] = [];
    const warnings: GraphWarning[] = [];

    for (const block of modulesWithSource(
      terraformProjects,
      CLOUD_RUN_MODULE_SOURCE,
    )) {
      const project = projectOfConfigurationFile(
        block.arguments['configuration_file'],
        projects,
      );
      if (!project) {
        warnings.push({
          message:
            "The Cloud Run module block is skipped, as its 'configuration_file' does not name a project of the workspace.",
          sources: [block.declaration],
        });
        continue;
      }

      services.push(this.evaluate(block, project, warnings));
    }

    return { value: services, warnings };
  }

  /**
   * Evaluates a Cloud Run module block, mirroring the defaults of the module.
   *
   * @param block The module block.
   * @param project The project whose configuration file the block reads.
   * @param warnings The warnings of the fact, to which the ones about the block are added.
   * @returns The {@link CloudRunService}.
   */
  private evaluate(
    block: TerraformModuleBlock,
    project: WorkspaceProject,
    warnings: GraphWarning[],
  ): CloudRunService {
    const sources = [block.declaration];
    const major = Number(block.version?.split('.')[0]);
    if (major !== MIRRORED_CLOUD_RUN_MAJOR) {
      warnings.push({
        message: `The Cloud Run module version '${block.version ?? 'unset'}' is not the one being mirrored (${MIRRORED_CLOUD_RUN_MAJOR}.x). Resources are extracted as for that version.`,
        sources,
      });
    }

    const argument = <T>(name: string, fallback: T): T => {
      const value = block.arguments[name];
      if (value === undefined) {
        return fallback;
      }

      if (!('value' in value)) {
        const assumed =
          typeof fallback === 'string' ? fallback : JSON.stringify(fallback);
        warnings.push({
          message: `The argument '${name}' is computed (${value.expression}). Assuming ${assumed}.`,
          sources,
        });
        return fallback;
      }

      return (value.value ?? fallback) as T;
    };

    const name = argument('name', project.name) || project.name;
    const enableTriggers = argument('enable_triggers', false);
    const triggers = Object.entries({
      ...(project.context
        .asConfiguration<ServiceContainerConfiguration>()
        .get('serviceContainer.triggers', { unsafe: true }) ?? {}),
      ...argument<Record<string, ServiceContainerTrigger>>('triggers', {}),
    }).filter(([, t]) => t.endpoint?.type === 'http');
    const ofTypes = (
      enabled: boolean,
      types: string[],
      excludeDisabled = false,
    ) =>
      new Map(
        enabled
          ? triggers.filter(
              ([, t]) =>
                types.includes(t.type ?? '') &&
                !(excludeDisabled && t.enabled === false),
            )
          : [],
      );
    const setIamPermissions = argument('set_iam_permissions', true);

    return {
      block,
      project,
      name,
      id: serviceId(project.directory, name),
      enablePublicHttpEndpoints: argument(
        'enable_public_http_endpoints',
        false,
      ),
      setPubsubPermissions: argument(
        'set_pubsub_permissions',
        setIamPermissions,
      ),
      setSpannerPermissions: argument(
        'set_spanner_permissions',
        setIamPermissions,
      ),
      setFirestorePermissions: argument(
        'set_firestore_permissions',
        setIamPermissions,
      ),
      setTasksPermissions: argument('set_tasks_permissions', setIamPermissions),
      pubsubTriggers: ofTypes(
        argument('enable_pubsub_triggers', enableTriggers),
        ['event', 'google.pubSub'],
        true,
      ),
      tasksTriggers: ofTypes(
        argument('enable_tasks_triggers', enableTriggers),
        ['task', 'google.task', 'google.tasks'],
      ),
      cronTriggers: ofTypes(argument('enable_cron_triggers', enableTriggers), [
        'cron',
        'google.scheduler',
      ]),
      projectPart: argumentOrConfiguration(
        block,
        'gcp_project_id',
        'google.project',
        warnings,
      ),
      locationPart: argumentOrConfiguration(
        block,
        'location',
        'google.cloudRun.location',
        warnings,
      ),
    };
  }
}

import {
  GraphOriginKind,
  type GraphRule,
  type GraphRuleEdge,
  type ServiceContainerConfiguration,
} from '@causa/workspace-core';
import {
  projectId,
  triggerId,
  ProjectsFact,
} from '@causa/workspace-core/graph';

/**
 * An `enqueues` edge from a service container project to each of its own `google.task` or `google.tasks` triggers,
 * assuming the owning project is the producer.
 */
export const enqueuesAssumedFromGoogleTaskTrigger: GraphRule = {
  name: 'enqueuesAssumedFromGoogleTaskTrigger',
  kind: GraphOriginKind.Inferred,
  description:
    'One `enqueues` edge from a service container project to each of its own `google.task` or `google.tasks` triggers, assuming the owning project is the producer.',
  async run(graph) {
    const { locator } = graph;
    const projects = await graph.get(ProjectsFact);
    const edges: GraphRuleEdge[] = [];

    for (const project of projects.filter(
      (p) => p.type === 'serviceContainer',
    )) {
      const triggers =
        project.context
          .asConfiguration<ServiceContainerConfiguration>()
          .get('serviceContainer.triggers', { unsafe: true }) ?? {};
      for (const [name, trigger] of Object.entries(triggers)) {
        if (!['google.task', 'google.tasks'].includes(trigger.type ?? '')) {
          continue;
        }

        edges.push({
          type: 'enqueues',
          from: projectId(project.directory),
          to: triggerId(project.directory, name),
          sources: [
            await locator.configurationSource(project.context, [
              'serviceContainer',
              'triggers',
              name,
            ]),
          ],
        });
      }
    }

    return { edges };
  },
};

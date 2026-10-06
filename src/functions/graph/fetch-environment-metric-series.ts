import { callDeferred } from '@causa/workspace';
import {
  GraphFetchEnvironmentMetricSeries,
  type GraphMetricSeries,
} from '@causa/workspace-core';
import {
  listGraphNodes,
  type GraphNodeEntry,
  type GraphResource,
} from '@causa/workspace-core/graph';
import {
  MONITORING_METRICS,
  type MonitoringMetric,
} from '../../graph/environment/monitoring-catalog.js';

/**
 * Implements {@link GraphFetchEnvironmentMetricSeries} for the metrics read from Cloud Monitoring.
 */
export class GraphFetchEnvironmentMetricSeriesForGoogle extends GraphFetchEnvironmentMetricSeries {
  async _call(): Promise<GraphMetricSeries> {
    return await callDeferred(this, import.meta.url);
  }

  /**
   * Returns the requested node, from the graph.
   *
   * @returns The node, or `undefined` if it does not exist.
   */
  findNode(): GraphNodeEntry | undefined {
    return listGraphNodes(this.graph).find((n) => n.id === this.node);
  }

  /**
   * Returns the Cloud Monitoring metric providing the requested metric of the node.
   *
   * @returns The metric, or `undefined` if the node does not exist, has no resource, or the metric is not read from
   *   Cloud Monitoring for it.
   */
  findMetric(): MonitoringMetric | undefined {
    const node = this.findNode();
    const resource = node?.node.data?.resource as GraphResource | undefined;
    if (!node || typeof resource?.id !== 'string') {
      return undefined;
    }

    return MONITORING_METRICS.find(
      (m) =>
        m.metric === this.metric &&
        m.mapping.nodeType === node.type &&
        m.mapping.resourceType === resource.type &&
        (!m.measures || m.measures(node, this.graph)),
    );
  }

  _supports(): boolean {
    return !!this.findMetric();
  }
}

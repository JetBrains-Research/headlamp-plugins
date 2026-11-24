import {
  registerOverviewChartsProcessor,
  registerResourceTableColumnsProcessor,
  registerRoute,
  registerSidebarEntry,
} from '@kinvolk/headlamp-plugin/lib';
import { ResourceTableColumn } from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import Node from '@kinvolk/headlamp-plugin/lib/K8s/node';
import Pod from '@kinvolk/headlamp-plugin/lib/K8s/pod';
import { AbbreviatedValue, NodeGpuCell, PodGpuCell } from './components/GpuColumn';
import { GpuOverviewChart } from './components/GpuOverview';
import GpuTopology from './components/Topology';
import {
  nodeAllocatableGpus,
  nodeGpuAccelerator,
  nodeGpuBlock,
  nodeGpuDriverVersion,
  nodeGpuSubBlock,
  podGpuLimits,
  shortTopology,
} from './gpu';

registerSidebarEntry({
  parent: 'map',
  name: 'gpu',
  label: 'GPU Topology',
  url: '/gpu',
});

registerRoute({
  path: '/gpu',
  sidebar: 'gpu',
  name: 'gpu',
  exact: true,
  component: () => <GpuTopology />,
});

registerOverviewChartsProcessor({
  id: 'gpu',
  processor: charts => [
    ...charts,
    {
      id: 'gpu',
      component: () => <GpuOverviewChart />,
    },
  ],
});

/**
 * Append a column to a built-in table, idempotently: re-running the processor on
 * every render is a no-op once the column is present, which is what prevents the
 * column from being duplicated on re-draws.
 */
function registerColumn<T>(tableId: string, column: ResourceTableColumn<T>) {
  registerResourceTableColumnsProcessor(({ id, columns }) => {
    if (id !== tableId) return columns;
    // Built-in columns are plain strings; only custom ones carry an id.
    if (columns.some(existing => typeof existing !== 'string' && existing.id === column.id)) {
      return columns;
    }
    // The table id fixes the row type, which the processor's generic signature can't express.
    return [...columns, column as unknown as (typeof columns)[number]];
  });
}

/**
 * A GKE topology column, hidden by default (opt-in via the column chooser).
 * The cell shows the short topology id with the full value on hover.
 */
function topologyColumn(
  id: string,
  label: string,
  accessor: (node: Node) => string | null
): ResourceTableColumn<Node> {
  return {
    id,
    label,
    show: false,
    getValue: (node: Node) => accessor(node),
    render: (node: Node) => {
      const value = accessor(node);
      if (!value) return null;
      return <AbbreviatedValue value={value} transformFunc={shortTopology} />;
    },
  };
}

registerColumn<Node>('headlamp-nodes', {
  id: 'gpu',
  label: 'GPU',
  disableFiltering: true,
  getValue: (node: Node) => nodeAllocatableGpus(node),
  render: (node: Node) => <NodeGpuCell node={node} />,
});

registerColumn<Node>('headlamp-nodes', {
  id: 'gpu-accelerator',
  label: 'GPU Accelerator',
  getValue: (node: Node) => nodeGpuAccelerator(node),
});

registerColumn<Node>('headlamp-nodes', {
  id: 'gpu-driver',
  label: 'GPU Driver Version',
  getValue: (node: Node) => nodeGpuDriverVersion(node),
});

registerColumn<Node>('headlamp-nodes', topologyColumn('gpu-block', 'GPU Block', nodeGpuBlock));

registerColumn<Node>(
  'headlamp-nodes',
  topologyColumn('gpu-sub-block', 'GPU Sub-block', nodeGpuSubBlock)
);

registerColumn<Pod>('headlamp-pods', {
  id: 'gpu',
  label: 'GPU',
  gridTemplate: 'min-content',
  disableFiltering: true,
  getValue: (pod: Pod) => podGpuLimits(pod),
  render: (pod: Pod) => <PodGpuCell pod={pod} />,
});

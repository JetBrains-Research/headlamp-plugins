import { K8s } from '@kinvolk/headlamp-plugin/lib';
import { TileChart } from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import { useMemo } from 'react';
import { buildGpuNodes, gpuTotals } from '../gpu';

/**
 * Cluster Overview donut card for GPU allocation, matching the built-in
 * CPU/Memory/Pods usage cards. Registered via `registerOverviewChartsProcessor`.
 *
 * Renders nothing on clusters with no `nvidia.com/gpu` nodes (and while the node/pod
 * lists are still loading), so the Overview is untouched where GPUs are absent.
 */
export function GpuOverviewChart() {
  const [nodes] = K8s.ResourceClasses.Node.useList();
  const [pods] = K8s.ResourceClasses.Pod.useList();

  const gpuNodes = useMemo(() => (nodes && pods ? buildGpuNodes(nodes, pods) : []), [nodes, pods]);
  const { allocatable, allocated } = gpuTotals(gpuNodes);

  if (allocatable === 0) {
    return null;
  }

  function getLabel() {
    return `${((allocated / allocatable) * 100).toFixed(1)} %`;
  }

  function getLegend() {
    return `${allocated} / ${allocatable} Allocated`;
  }

  return (
    <TileChart
      title="GPUs"
      data={[{ name: 'used', value: allocated }]}
      label={getLabel()}
      legend={getLegend()}
      total={allocatable}
    />
  );
}

import { KubeObject } from '@kinvolk/headlamp-plugin/lib/K8s/KubeObject';
import Node, { KubeNode } from '@kinvolk/headlamp-plugin/lib/K8s/node';
import Pod, { KubePod } from '@kinvolk/headlamp-plugin/lib/K8s/pod';

/** Extended resource exposed by the NVIDIA device plugin. */
export const GPU_RESOURCE = 'nvidia.com/gpu';

/**
 * GKE GPU node labels.
 *
 * Nodes that share a `block` sit in the same NVLink/network domain;
 * nodes that also share a `subblock` are even closer.
 * We group the topology view by these.
 *
 * `gke-accelerator` carries the accelerator type (e.g. `nvidia-h200-141gb`);
 * `gke-gpu-driver-version` carries the installed NVIDIA driver version.
 */
export const BLOCK_LABEL = 'cloud.google.com/gce-topology-block';
export const SUBBLOCK_LABEL = 'cloud.google.com/gce-topology-subblock';
export const ACCELERATOR_LABEL = 'cloud.google.com/gke-accelerator';
export const DRIVER_VERSION_LABEL = 'cloud.google.com/gke-gpu-driver-version';

function toInt(value: unknown): number {
  const parsed = parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** `nvidia.com/gpu` count in a resource list; headlamp types only declare the built-in resources. */
function gpuCount(resources?: Record<string, unknown>): number {
  return toInt(resources?.[GPU_RESOURCE]);
}

/** Allocatable `nvidia.com/gpu` reported by a node (0 for non-GPU nodes). */
export function nodeAllocatableGpus(node: KubeNode): number {
  return gpuCount(node.status.allocatable);
}

/** Read a node label, returning null when it is absent. */
function nodeLabel(node: KubeNode, key: string): string | null {
  return node.metadata.labels?.[key] ?? null;
}

/** GKE topology block this node belongs to (null when unlabeled). */
export function nodeGpuBlock(node: KubeNode): string | null {
  return nodeLabel(node, BLOCK_LABEL);
}

/** GKE topology subblock this node belongs to (null when unlabeled). */
export function nodeGpuSubBlock(node: KubeNode): string | null {
  return nodeLabel(node, SUBBLOCK_LABEL);
}

/** Accelerator type reported by GKE (e.g. `nvidia-h200-141gb`), or null. */
export function nodeGpuAccelerator(node: KubeNode): string | null {
  return nodeLabel(node, ACCELERATOR_LABEL);
}

/** Installed NVIDIA driver version reported by GKE, or null. */
export function nodeGpuDriverVersion(node: KubeNode): string | null {
  return nodeLabel(node, DRIVER_VERSION_LABEL);
}

export function podGpuRequest(pod: KubePod): number {
  return pod.spec.containers
    .map(container => gpuCount(container.resources?.requests))
    .reduce((total, value) => total + value, 0);
}

export function podGpuLimits(pod: KubePod): number {
  return pod.spec.containers
    .map(container => gpuCount(container.resources?.limits))
    .reduce((total, value) => total + value, 0);
}

/**
 * Map of node name -> GPUs currently allocated, summed from the GPU requests of
 * every scheduled (Running/Pending) pod. Mirrors the accounting in
 * jbr-cluster-info's backend: a GPU is "allocated" as soon as a pod requesting
 * it lands on a node, regardless of whether the workload is actually busy.
 */
export function allocatedGpusByNode(pods: KubePod[]): Map<string, number> {
  const used = new Map<string, number>();
  for (const pod of pods) {
    const nodeName = pod.spec.nodeName;
    const phase = pod.status.phase;
    if (!nodeName || (phase !== 'Running' && phase !== 'Pending')) continue;
    const gpus = podGpuRequest(pod) || podGpuLimits(pod);
    if (gpus > 0) used.set(nodeName, (used.get(nodeName) ?? 0) + gpus);
  }
  return used;
}

/** Per-node GPU accounting used by the topology view. */
export interface GpuNode {
  node: KubeObject;
  name: string;
  block: string | null;
  subblock: string | null;
  allocatable: number;
  allocated: number;
  free: number;
  ready: boolean;
}

/**
 * Build GPU accounting for every node that exposes `nvidia.com/gpu`,
 * combining node-allocatable counts with pod GPU requests.
 */
export function buildGpuNodes(nodes: Node[], pods: Pod[]): GpuNode[] {
  const allocatedByNode = allocatedGpusByNode(pods);
  const gpuNodes: GpuNode[] = [];
  for (const node of nodes) {
    const allocatable = nodeAllocatableGpus(node);
    if (allocatable <= 0) continue;
    const name = node.getName();
    const conditions = node.status.conditions ?? [];
    const allocated = allocatedByNode.get(name) ?? 0;
    gpuNodes.push({
      node,
      name,
      block: nodeGpuBlock(node),
      subblock: nodeGpuSubBlock(node),
      allocatable,
      allocated,
      free: Math.max(allocatable - allocated, 0),
      ready: conditions.some(
        (condition: { type?: string; status?: string }) =>
          condition.type === 'Ready' && condition.status === 'True'
      ),
    });
  }
  return gpuNodes;
}

/** Cluster-wide GPU totals summed across GPU nodes. */
export function gpuTotals(gpuNodes: GpuNode[]): {
  allocatable: number;
  allocated: number;
  free: number;
} {
  return gpuNodes.reduce(
    (sum, node) => ({
      allocatable: sum.allocatable + node.allocatable,
      allocated: sum.allocated + node.allocated,
      free: sum.free + node.free,
    }),
    {
      allocatable: 0,
      allocated: 0,
      free: 0,
    }
  );
}

/** Utilization ratio (0..1) used to color GPU blocks and cells. */
export function utilisation(node: { allocated: number; allocatable: number }): number {
  return node.allocatable > 0 ? node.allocated / node.allocatable : 0;
}

/**
 * Short, human-friendly topology id. GKE block/subblock labels are long opaque
 * strings, so the dashboards only ever show the leading six characters
 * (e.g., a block starting with "bfdac5").
 */
export function shortTopology(value: string | null): string {
  return value ? value.slice(0, 6) : '';
}

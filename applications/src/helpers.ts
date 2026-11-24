import { KubeObjectInterface } from '@kinvolk/headlamp-plugin/lib/k8s/cluster';
import { AppStatus } from './types';

export const APP_KUBERNETES_IO = {
  NAME: 'app.kubernetes.io/name',
  INSTANCE: 'app.kubernetes.io/instance',
  VERSION: 'app.kubernetes.io/version',
  COMPONENT: 'app.kubernetes.io/component',
  PART_OF: 'app.kubernetes.io/part-of',
  MANAGED_BY: 'app.kubernetes.io/managed-by',
} as const;

/**
 * Derive the application name used as the grouping key.
 * Only consider the Kubernetes recommended labels, not the legacy `app` label.
 */
export function getAppName(resource: KubeObjectInterface): string | null {
  const labels = resource.metadata?.labels ?? {};
  return labels[APP_KUBERNETES_IO.NAME] || null;
}

/**
 * Derive the instance identifier for a resource.
 */
export function getAppInstance(resource: KubeObjectInterface): string | null {
  const labels = resource.metadata?.labels ?? {};
  return labels[APP_KUBERNETES_IO.INSTANCE] || null;
}

/**
 * Compute a composite status from an array of pod phases.
 */
export function deriveStatus(phases: string[]): AppStatus {
  if (phases.length === 0) return 'Unknown';
  if (phases.some(phase => phase === 'Failed')) return 'Failed';
  if (phases.some(phase => phase === 'Pending')) return 'Pending';
  if (phases.every(phase => phase === 'Running' || phase === 'Succeeded')) return 'Running';
  return 'Unknown';
}

/**
 * Internal URLs from Services belonging to the application.
 */
export function computeInternalURLs(services: KubeObjectInterface[], namespace: string): string[] {
  const urls: string[] = [];
  for (const service of services) {
    for (const port of service.spec?.ports ?? []) {
      urls.push(`${service.metadata.name}.${namespace}.svc.cluster.local:${port.port}`);
    }
  }
  return urls;
}

/**
 * Exposed URLs from Ingresses belonging to the application.
 */
export function computeExposedURLs(ingresses: KubeObjectInterface[]): string[] {
  const urls: string[] = [];
  for (const ingress of ingresses) {
    const hasTLS = (ingress.spec?.tls ?? []).length > 0;
    for (const rule of ingress.spec?.rules ?? []) {
      const host = rule.host;
      if (!host) continue;
      for (const path of rule.http?.paths ?? []) {
        const protocol = hasTLS ? 'https' : 'http';
        const pathStr = path.path || '/';
        urls.push(`${protocol}://${host}${pathStr}`);
      }
    }
  }
  return urls;
}

/**
 * Headlamp route name for a given built-in Kubernetes kind.
 */
export function kindToRouteName(kind: string): string | null {
  switch (kind) {
    case 'Pod':
    case 'Deployment':
    case 'StatefulSet':
    case 'DaemonSet':
    case 'Job':
    case 'JobSet':
    case 'CronJob':
    case 'Service':
    case 'ConfigMap':
    case 'Secret':
    case 'ServiceAccount':
    case 'PersistentVolumeClaim':
    case 'Ingress':
    case 'HorizontalPodAutoscaler':
    case 'PodDisruptionBudget':
    case 'LimitRange':
    case 'ResourceQuota':
    case 'NetworkPolicy':
    case 'ReplicaSet':
    case 'Namespace':
      return kind.toLowerCase();
    default:
      return null;
  }
}

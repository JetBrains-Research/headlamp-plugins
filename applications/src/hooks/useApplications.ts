import { K8s } from '@kinvolk/headlamp-plugin/lib';
import { useMemo } from 'react';
import { APP_KUBERNETES_IO, deriveStatus, getAppInstance, getAppName } from '../helpers';
import { ApplicationInstance } from '../types';

/**
 * Scans all workload resources and pods across all namespaces to build a list
 * of unique applications, grouped by (namespace, app.kubernetes.io/name).
 * Only resources carrying the app.kubernetes.io/name label are fetched.
 */
export function useApplications(): {
  applications: ApplicationInstance[];
  isLoading: boolean;
} {
  const labelSelector = APP_KUBERNETES_IO.NAME;

  const [deployments] = K8s.ResourceClasses.Deployment.useList({ labelSelector });
  const [statefulSets] = K8s.ResourceClasses.StatefulSet.useList({ labelSelector });
  const [daemonSets] = K8s.ResourceClasses.DaemonSet.useList({ labelSelector });
  const [jobs] = K8s.ResourceClasses.Job.useList({ labelSelector });
  const [cronJobs] = K8s.ResourceClasses.CronJob.useList({ labelSelector });
  const [pods] = K8s.ResourceClasses.Pod.useList({ labelSelector });

  const isLoading = !deployments || !statefulSets || !daemonSets || !jobs || !cronJobs || !pods;

  const applications = useMemo(() => {
    if (isLoading) return [];

    const allWorkloads = [
      ...deployments!,
      ...statefulSets!,
      ...daemonSets!,
      ...jobs!,
      ...cronJobs!,
    ];

    const appMap = new Map<string, ApplicationInstance>();

    for (const resource of allWorkloads) {
      const data = resource.jsonData;
      const appName = getAppName(data);
      if (!appName) continue;

      const namespace = data.metadata?.namespace ?? '';
      const key = `${namespace}/${appName}`;

      if (appMap.has(key)) {
        const existing = appMap.get(key)!;
        const ts = data.metadata?.creationTimestamp ?? '';
        if (ts && (!existing.creationTimestamp || ts < existing.creationTimestamp)) {
          existing.creationTimestamp = ts;
        }
        continue;
      }

      const labels = data.metadata?.labels ?? {};
      appMap.set(key, {
        instance: getAppInstance(data) ?? appName,
        application: appName,
        namespace,
        version: labels[APP_KUBERNETES_IO.VERSION] ?? '',
        managedBy: labels[APP_KUBERNETES_IO.MANAGED_BY] ?? '',
        partOf: labels[APP_KUBERNETES_IO.PART_OF] ?? '',
        creationTimestamp: data.metadata?.creationTimestamp ?? '',
        status: 'Unknown',
      });
    }

    const podPhases = new Map<string, string[]>();
    for (const pod of pods!) {
      const data = pod.jsonData;
      const appName = getAppName(data);
      if (!appName) continue;

      const namespace = data.metadata?.namespace ?? '';
      const key = `${namespace}/${appName}`;
      if (!appMap.has(key)) continue;

      if (!podPhases.has(key)) podPhases.set(key, []);
      podPhases.get(key)!.push(data.status?.phase ?? 'Unknown');
    }

    for (const [key, app] of appMap) {
      app.status = deriveStatus(podPhases.get(key) ?? []);
    }

    return Array.from(appMap.values());
  }, [deployments, statefulSets, daemonSets, jobs, cronJobs, pods, isLoading]);

  return { applications, isLoading };
}

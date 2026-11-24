import { K8s } from '@kinvolk/headlamp-plugin/lib';
import { useMemo } from 'react';
import {
  APP_KUBERNETES_IO,
  computeExposedURLs,
  computeInternalURLs,
  deriveStatus,
  getAppInstance,
} from '../helpers';
import { ApplicationDetail } from '../types';

/**
 * Fetches all resource types belonging to the given application, filtered
 * server-side by namespace and the app.kubernetes.io/name label selector,
 * grouping into pods / workloads / other.
 */
export function useApplication(
  namespace: string,
  appName: string
): {
  application: ApplicationDetail | null;
  isLoading: boolean;
} {
  const labelSelector = `${APP_KUBERNETES_IO.NAME}=${appName}`;

  const [deployments] = K8s.ResourceClasses.Deployment.useList({
    namespace,
    labelSelector,
  });
  const [statefulSets] = K8s.ResourceClasses.StatefulSet.useList({
    namespace,
    labelSelector,
  });
  const [daemonSets] = K8s.ResourceClasses.DaemonSet.useList({
    namespace,
    labelSelector,
  });
  const [jobs] = K8s.ResourceClasses.Job.useList({
    namespace,
    labelSelector,
  });
  const [jobSets] = K8s.ResourceClasses.JobSet.useList({
    namespace,
    labelSelector,
  });
  const [cronJobs] = K8s.ResourceClasses.CronJob.useList({
    namespace,
    labelSelector,
  });
  const [pods] = K8s.ResourceClasses.Pod.useList({
    namespace,
    labelSelector,
  });
  const [services] = K8s.ResourceClasses.Service.useList({
    namespace,
    labelSelector,
  });
  const [configMaps] = K8s.ResourceClasses.ConfigMap.useList({
    namespace,
    labelSelector,
  });
  const [secrets] = K8s.ResourceClasses.Secret.useList({
    namespace,
    labelSelector,
  });
  const [serviceAccounts] = K8s.ResourceClasses.ServiceAccount.useList({
    namespace,
    labelSelector,
  });
  const [pvcs] = K8s.ResourceClasses.PersistentVolumeClaim.useList({
    namespace,
    labelSelector,
  });
  const [ingresses] = K8s.ResourceClasses.Ingress.useList({
    namespace,
    labelSelector,
  });
  const [hpas] = K8s.ResourceClasses.HorizontalPodAutoscaler.useList({
    namespace,
    labelSelector,
  });
  const [pdbs] = K8s.ResourceClasses.PodDisruptionBudget.useList({
    namespace,
    labelSelector,
  });
  const [limitRanges] = K8s.ResourceClasses.LimitRange.useList({
    namespace,
    labelSelector,
  });
  const [resourceQuotas] = K8s.ResourceClasses.ResourceQuota.useList({
    namespace,
    labelSelector,
  });
  const [networkPolicies] = K8s.ResourceClasses.NetworkPolicy.useList({
    namespace,
    labelSelector,
  });

  const isLoading =
    !deployments ||
    !statefulSets ||
    !daemonSets ||
    !jobs ||
    !jobSets ||
    !cronJobs ||
    !pods ||
    !services ||
    !configMaps ||
    !secrets ||
    !serviceAccounts ||
    !pvcs ||
    !ingresses ||
    !hpas ||
    !pdbs ||
    !limitRanges ||
    !resourceQuotas ||
    !networkPolicies;

  const application = useMemo(() => {
    if (isLoading) return null;

    const workloadResources = [
      ...deployments!,
      ...statefulSets!,
      ...daemonSets!,
      ...jobs!,
      ...jobSets!,
      ...cronJobs!,
    ];

    const otherResources = [
      ...services!,
      ...configMaps!,
      ...secrets!,
      ...serviceAccounts!,
      ...pvcs!,
      ...ingresses!,
      ...hpas!,
      ...pdbs!,
      ...limitRanges!,
      ...resourceQuotas!,
      ...networkPolicies!,
    ];

    const appPods = pods!;

    const firstResource = workloadResources[0] || otherResources[0] || appPods[0];
    if (!firstResource) return null;

    const labels = firstResource.jsonData.metadata?.labels ?? {};

    const allResources = [...workloadResources, ...otherResources, ...appPods];
    const timestamps = allResources
      .map(resource => resource.jsonData.metadata?.creationTimestamp)
      .filter(Boolean) as string[];
    timestamps.sort();

    const podPhases = appPods.map(pod => pod.jsonData.status?.phase ?? 'Unknown');

    return {
      instance: getAppInstance(firstResource.jsonData) ?? appName,
      application: appName,
      namespace,
      version: labels[APP_KUBERNETES_IO.VERSION] ?? '',
      managedBy: labels[APP_KUBERNETES_IO.MANAGED_BY] ?? '',
      partOf: labels[APP_KUBERNETES_IO.PART_OF] ?? '',
      creationTimestamp: timestamps[0] ?? '',
      status: deriveStatus(podPhases),
      internalURLs: computeInternalURLs(
        services!.map(service => service.jsonData),
        namespace
      ),
      exposedURLs: computeExposedURLs(ingresses!.map(ingress => ingress.jsonData)),
      pods: appPods,
      workloadResources,
      otherResources,
    } satisfies ApplicationDetail;
  }, [
    isLoading,
    namespace,
    appName,
    deployments,
    statefulSets,
    daemonSets,
    jobs,
    jobSets,
    cronJobs,
    pods,
    services,
    configMaps,
    secrets,
    serviceAccounts,
    pvcs,
    ingresses,
    hpas,
    pdbs,
    limitRanges,
    resourceQuotas,
    networkPolicies,
  ]);

  return { application, isLoading };
}

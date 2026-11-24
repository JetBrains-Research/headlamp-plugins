import { KubeObject } from '@kinvolk/headlamp-plugin/lib/k8s/cluster';

export interface ApplicationInstance {
  /** Unique instance identifier (app.kubernetes.io/instance or fallback) */
  instance: string;
  /** Application name (app.kubernetes.io/name or fallback) */
  application: string;
  /** Kubernetes namespace */
  namespace: string;
  /** app.kubernetes.io/version */
  version: string;
  /** app.kubernetes.io/managed-by */
  managedBy: string;
  /** app.kubernetes.io/part-of */
  partOf: string;
  /** Earliest creation timestamp among workload resources */
  creationTimestamp: string;
  /** Derived from pod phases */
  status: AppStatus;
}

export type AppStatus = 'Running' | 'Pending' | 'Failed' | 'Unknown';

export interface ApplicationDetail extends ApplicationInstance {
  internalURLs: string[];
  exposedURLs: string[];
  pods: KubeObject[];
  workloadResources: KubeObject[];
  otherResources: KubeObject[];
}

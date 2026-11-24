import { ApiProxy } from '@kinvolk/headlamp-plugin/lib';

/** Name of the container we exec into. */
export const SHELL_CONTAINER = 'shell';

const READY_TIMEOUT_MS = 120_000;
const GONE_TIMEOUT_MS = 60_000;
const POLL_INTERVAL_MS = 1_500;

const APP_NAME = 'headlamp-cloud-shell';
const NAME_LABEL = 'app.kubernetes.io/name';
const INSTANCE_LABEL = 'app.kubernetes.io/instance';
const MANAGED_BY_LABEL = 'app.kubernetes.io/managed-by';

interface KubeJob {
  metadata?: {
    name?: string;
    deletionTimestamp?: string;
  };
  status?: {
    succeeded?: number;
    failed?: number;
    conditions?: {
      type?: string;
      status?: string;
    }[];
  };
}

interface KubePod {
  metadata?: {
    name?: string;
    deletionTimestamp?: string;
  };
  status?: {
    phase?: string;
  };
}

export interface Session {
  /** Cluster identity the session was created for. */
  username: string;
  /** Name of the Job backing the session. */
  jobName: string;
  /** Name of the pod to exec into. */
  podName: string;
}

function jobPath(namespace: string, name?: string): string {
  const base = `/apis/batch/v1/namespaces/${namespace}/jobs`;
  return name ? `${base}/${name}` : base;
}

function isNotFound(error: any): boolean {
  return error?.status === 404 || /(^|\D)404(\D|$)/.test(String(error?.message ?? ''));
}

/** Stable FNV-1a hash, rendered in base36, used to keep session names unique. */
function shortHash(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

/**
 * Build a stable, DNS-safe Job name for a user, e.g. `cloud-shell-jane-doe-1a2b3c`.
 * The hash suffix keeps names unique even when sanitizing or truncation collide.
 */
export function sessionName(username: string): string {
  const prefix = 'cloud-shell-';
  const hash = shortHash(username);
  const slug = username
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/(^-+)|(-+$)/g, '')
    .replace(/-{2,}/g, '-');
  // Keep well under 63 chars so the Job's generated pod suffix stays valid.
  const maxSlug = 52 - prefix.length - hash.length - 1;
  const trimmed = slug.slice(0, Math.max(1, maxSlug)).replace(/-+$/g, '') || 'user';
  return `${prefix}${trimmed}-${hash}`;
}

/**
 * Build the Job manifest for a cloud shell session.
 * `ttlSecondsAfterFinished` garbage-collects the Job once it exits.
 */
export function buildJobManifest(
  name: string,
  namespace: string,
  image: string,
  serviceAccount: string
) {
  const labels = {
    [NAME_LABEL]: APP_NAME,
    [INSTANCE_LABEL]: name,
    [MANAGED_BY_LABEL]: 'headlamp-cloud-shell-plugin',
  };
  return {
    apiVersion: 'batch/v1',
    kind: 'Job',
    metadata: { name, namespace, labels },
    spec: {
      completions: 1,
      parallelism: 1,
      backoffLimit: 0,
      ttlSecondsAfterFinished: 0,
      template: {
        metadata: {
          labels,
        },
        spec: {
          restartPolicy: 'Never',
          terminationGracePeriodSeconds: 5,
          serviceAccountName: serviceAccount || 'default',
          containers: [
            {
              name: SHELL_CONTAINER,
              image,
              resources: {
                requests: {
                  cpu: '50m',
                  memory: '100Mi',
                },
                limits: {
                  cpu: '500m',
                  memory: '1Gi',
                },
              },
            },
          ],
        },
      },
    },
  };
}

async function currentUsername(cluster?: string): Promise<string> {
  try {
    const info = await ApiProxy.getClusterUserInfo(cluster);
    return info?.username || 'unknown';
  } catch {
    return 'unknown';
  }
}

function getJob(name: string, namespace: string): Promise<KubeJob> {
  return ApiProxy.request(jobPath(namespace, name));
}

function createJob(
  name: string,
  namespace: string,
  image: string,
  serviceAccount: string
): Promise<unknown> {
  return ApiProxy.post(
    jobPath(namespace),
    buildJobManifest(name, namespace, image, serviceAccount)
  );
}

/** Delete the session's Job and, via foreground propagation, its pod. */
export function deleteSession(name: string, namespace: string): Promise<unknown> {
  return ApiProxy.remove(`${jobPath(namespace, name)}?propagationPolicy=Foreground`);
}

async function listSessionPods(jobName: string, namespace: string): Promise<KubePod[]> {
  const selector = encodeURIComponent(`${INSTANCE_LABEL}=${jobName}`);
  const list = await ApiProxy.request(
    `/api/v1/namespaces/${namespace}/pods?labelSelector=${selector}`
  );
  return list?.items ?? [];
}

function isJobFinished(job: KubeJob): boolean {
  if ((job.status?.succeeded ?? 0) > 0 || (job.status?.failed ?? 0) > 0) return true;
  return (job.status?.conditions ?? []).some(condition => {
    return (
      (condition.type === 'Complete' || condition.type === 'Failed') && condition.status === 'True'
    );
  });
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort);
  });
}

async function waitForRunningPod(
  jobName: string,
  namespace: string,
  signal?: AbortSignal
): Promise<string> {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  for (;;) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

    const pods = await listSessionPods(jobName, namespace);
    const running = pods.find(
      pod => !pod.metadata?.deletionTimestamp && pod.status?.phase === 'Running'
    );
    if (running?.metadata?.name) return running.metadata.name;

    // Surface a clear error if the Job failed or was removed while we waited.
    let job: KubeJob | undefined;
    try {
      job = await getJob(jobName, namespace);
    } catch (error) {
      if (!isNotFound(error)) throw error;
    }
    if (!job) throw new Error('The cloud shell was removed before it became ready.');
    if (isJobFinished(job)) {
      throw new Error('The cloud shell exited on startup. Its image must keep running by default.');
    }
    if (Date.now() > deadline) throw new Error('Timed out waiting for the cloud shell to start.');

    await delay(POLL_INTERVAL_MS, signal);
  }
}

async function waitForJobGone(
  name: string,
  namespace: string,
  signal?: AbortSignal
): Promise<void> {
  const deadline = Date.now() + GONE_TIMEOUT_MS;
  for (;;) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    try {
      await getJob(name, namespace);
    } catch (error) {
      if (isNotFound(error)) return;
      throw error;
    }
    if (Date.now() > deadline) {
      throw new Error('Timed out cleaning up the previous cloud shell.');
    }
    await delay(POLL_INTERVAL_MS, signal);
  }
}

interface EnsureArgs {
  namespace: string;
  image: string;
  serviceAccount: string;
  cluster?: string;
  signal?: AbortSignal;
  onStatus?: (message: string) => void;
}

/**
 * Ensure a running per-user cloud shell exists: attach to an existing running
 * session, otherwise (re)create it, then wait until its pod is ready to exec into.
 */
export async function ensureRunningSession({
  namespace,
  image,
  serviceAccount,
  cluster,
  signal,
  onStatus,
}: EnsureArgs): Promise<Session> {
  const username = await currentUsername(cluster);
  const jobName = sessionName(username);

  let job: KubeJob | undefined;
  try {
    job = await getJob(jobName, namespace);
  } catch (error) {
    if (!isNotFound(error)) throw error;
  }

  // A finished or terminating Job cannot host a session.
  if (job && (isJobFinished(job) || job.metadata?.deletionTimestamp)) {
    onStatus?.('Recycling the previous cloud shell...');
    await deleteSession(jobName, namespace);
    await waitForJobGone(jobName, namespace, signal);
    job = undefined;
  }

  if (!job) {
    onStatus?.('Creating a new cloud shell...');
    try {
      await createJob(jobName, namespace, image, serviceAccount);
    } catch (error: any) {
      // Tolerate a concurrent creation racing us to the same session.
      if (error?.status !== 409) throw error;
    }
  } else {
    onStatus?.('Attaching to your existing cloud shell...');
  }

  onStatus?.('Waiting for the cloud shell to be ready...');
  const podName = await waitForRunningPod(jobName, namespace, signal);
  return { username, jobName, podName };
}

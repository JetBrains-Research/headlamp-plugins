import { Router } from '@kinvolk/headlamp-plugin/lib';
import { Link } from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import {
  Loader,
  NameValueTable,
  SectionBox,
  StatusLabel,
  Table,
} from '@kinvolk/headlamp-plugin/lib/components/common';
import { KubeObject } from '@kinvolk/headlamp-plugin/lib/k8s/cluster';
import { localeDate } from '@kinvolk/headlamp-plugin/lib/Utils';
import { Link as ExternalLink, Typography } from '@mui/material';
import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { APP_KUBERNETES_IO, kindToRouteName } from '../helpers';
import { useApplication } from '../hooks/useApplication';
import { AppStatus } from '../types';
import MultiObjectEventList from './EventList';

const { createRouteURL } = Router;

const STATUS_LABEL: Record<AppStatus, '' | 'success' | 'warning' | 'error'> = {
  Running: 'success',
  Pending: 'warning',
  Failed: 'error',
  Unknown: '',
};

function ResourceLink({ resource }: { resource: KubeObject }) {
  const data = resource.jsonData;
  const name = data.metadata?.name ?? '';
  const namespace = data.metadata?.namespace;
  const routeName = kindToRouteName(data.kind);

  if (routeName && namespace) {
    return (
      <Link routeName={routeName} params={{ namespace, name }}>
        {name}
      </Link>
    );
  }
  return <>{name}</>;
}

function PodPhaseLabel({ pod }: { pod: KubeObject }) {
  const phase: string = pod.jsonData.status?.phase ?? 'Unknown';
  const status =
    phase === 'Running' || phase === 'Succeeded'
      ? 'success'
      : phase === 'Failed'
      ? 'error'
      : phase === 'Pending'
      ? 'warning'
      : '';
  return <StatusLabel status={status}>{phase}</StatusLabel>;
}

function podReady(pod: KubeObject): string {
  const containers = pod.jsonData.status?.containerStatuses ?? [];
  if (containers.length === 0) return '0/0';
  const ready = containers.filter((c: { ready?: boolean }) => c.ready).length;
  return `${ready}/${containers.length}`;
}

export default function ApplicationDetail() {
  const { namespace, name } = useParams<{ namespace: string; name: string }>();
  const { application, isLoading } = useApplication(namespace, name);

  const eventObjects = useMemo(
    () => [...(application?.workloadResources ?? []), ...(application?.pods ?? [])],
    [application]
  );

  if (isLoading) {
    return <Loader title="Loading application..." />;
  }

  if (!application) {
    return (
      <SectionBox title={`Application: ${name}`} backLink={createRouteURL('applications')}>
        <Typography>No resources found for this application.</Typography>
      </SectionBox>
    );
  }

  const {
    instance,
    application: appName,
    version,
    managedBy,
    partOf,
    creationTimestamp,
    status,
    internalURLs,
    exposedURLs,
    pods,
    workloadResources,
    otherResources,
  } = application;

  return (
    <>
      <SectionBox title={`Application: ${appName}`} backLink={createRouteURL('applications')}>
        <NameValueTable
          rows={[
            {
              name: 'Instance',
              value: instance,
            },
            {
              name: 'Application',
              value: appName,
            },
            {
              name: 'Namespace',
              value: (
                <Link routeName="namespace" params={{ name: namespace }}>
                  {namespace}
                </Link>
              ),
            },
            creationTimestamp
              ? {
                  name: 'Creation',
                  value: localeDate(creationTimestamp),
                }
              : null,
            {
              name: 'Status',
              value: <StatusLabel status={STATUS_LABEL[status]}>{status}</StatusLabel>,
            },
            version
              ? {
                  name: 'Version',
                  value: version,
                }
              : null,
            managedBy
              ? {
                  name: 'Managed By',
                  value: managedBy,
                }
              : null,
            partOf
              ? {
                  name: 'Part Of',
                  value: partOf,
                }
              : null,
            internalURLs.length > 0
              ? {
                  name: 'Internal URLs',
                  value: internalURLs.map(url => (
                    <span key={url} style={{ display: 'block' }}>
                      {url}
                    </span>
                  )),
                }
              : null,
            exposedURLs.length > 0
              ? {
                  name: 'Exposed URLs',
                  value: exposedURLs.map(url => (
                    <ExternalLink
                      key={url}
                      href={url}
                      target="_blank"
                      rel="noopener"
                      sx={{ display: 'block' }}
                    >
                      {url}
                    </ExternalLink>
                  )),
                }
              : null,
          ].filter(row => row !== null)}
        />
      </SectionBox>

      <SectionBox title="Pods">
        <Table
          data={pods}
          columns={[
            {
              header: 'Name',
              accessorFn: (pod: KubeObject) => pod.jsonData.metadata?.name,
              Cell: ({ row }: { row: { original: KubeObject } }) => (
                <ResourceLink resource={row.original} />
              ),
            },
            {
              header: 'Node',
              accessorFn: (pod: KubeObject) => pod.jsonData.spec?.nodeName,
              Cell: ({ row }: { row: { original: KubeObject } }) => {
                const podNode = row.original.jsonData.spec?.nodeName;
                return podNode ? (
                  <Link routeName="node" params={{ name: podNode }}>
                    {podNode}
                  </Link>
                ) : null;
              },
            },
            {
              header: 'Namespace',
              accessorFn: (pod: KubeObject) => pod.jsonData.metadata?.namespace,
              Cell: ({ row }: { row: { original: KubeObject } }) => {
                const podNamespace = row.original.jsonData.metadata?.namespace;
                return podNamespace ? (
                  <Link routeName="namespace" params={{ name: podNamespace }}>
                    {podNamespace}
                  </Link>
                ) : null;
              },
            },
            {
              header: 'Ready',
              accessorFn: (pod: KubeObject) => podReady(pod),
            },
            {
              header: 'Status',
              accessorFn: (pod: KubeObject) => pod.jsonData.status?.phase ?? 'Unknown',
              Cell: ({ row }: { row: { original: KubeObject } }) => (
                <PodPhaseLabel pod={row.original} />
              ),
            },
          ]}
        />
      </SectionBox>

      <SectionBox title="Workload Resources">
        <Table
          data={workloadResources}
          columns={[
            {
              header: 'Name',
              accessorFn: (workload: KubeObject) => workload.jsonData.metadata?.name,
              Cell: ({ row }: { row: { original: KubeObject } }) => (
                <ResourceLink resource={row.original} />
              ),
            },
            {
              header: 'Kind',
              accessorFn: (workload: KubeObject) => workload.jsonData.kind,
            },
            {
              header: 'Component',
              accessorFn: (workload: KubeObject) =>
                workload.jsonData.metadata?.labels?.[APP_KUBERNETES_IO.COMPONENT],
            },
          ]}
        />
      </SectionBox>

      <SectionBox title="Other Resources">
        <Table
          data={otherResources}
          columns={[
            {
              header: 'Name',
              accessorFn: (resource: KubeObject) => resource.jsonData.metadata?.name,
              Cell: ({ row }: { row: { original: KubeObject } }) => (
                <ResourceLink resource={row.original} />
              ),
            },
            {
              header: 'Kind',
              accessorFn: (resource: KubeObject) => resource.jsonData.kind,
            },
            {
              header: 'Component',
              accessorFn: (resource: KubeObject) =>
                resource.jsonData.metadata?.labels?.[APP_KUBERNETES_IO.COMPONENT],
            },
          ]}
        />
      </SectionBox>

      <MultiObjectEventList objects={eventObjects} />
    </>
  );
}

import { Link } from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import {
  DateLabel,
  Loader,
  SectionBox,
  SectionFilterHeader,
  StatusLabel,
  Table,
} from '@kinvolk/headlamp-plugin/lib/components/common';
import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import { useApplications } from '../hooks/useApplications';
import { ApplicationInstance, AppStatus } from '../types';

const STATUS_LABEL: Record<AppStatus, '' | 'success' | 'warning' | 'error'> = {
  Running: 'success',
  Pending: 'warning',
  Failed: 'error',
  Unknown: '',
};

const columns = [
  {
    header: 'Instance',
    accessorFn: (app: ApplicationInstance) => app.instance,
    Cell: ({ row }: { row: { original: ApplicationInstance } }) => (
      <Link
        routeName="application"
        params={{
          namespace: row.original.namespace,
          name: row.original.application,
        }}
      >
        {row.original.instance}
      </Link>
    ),
  },
  {
    header: 'Application',
    accessorFn: (app: ApplicationInstance) => app.application,
  },
  {
    header: 'Namespace',
    accessorFn: (app: ApplicationInstance) => app.namespace,
    Cell: ({ row }: { row: { original: ApplicationInstance } }) => (
      <Link routeName="namespace" params={{ name: row.original.namespace }}>
        {row.original.namespace}
      </Link>
    ),
  },
  {
    header: 'Managed By',
    accessorFn: (app: ApplicationInstance) => app.managedBy,
  },
  {
    header: 'Version',
    accessorFn: (app: ApplicationInstance) => app.version,
  },
  {
    header: 'Age',
    accessorFn: (app: ApplicationInstance) => app.creationTimestamp,
    Cell: ({ row }: { row: { original: ApplicationInstance } }) =>
      row.original.creationTimestamp ? (
        <DateLabel date={row.original.creationTimestamp} format="mini" />
      ) : null,
  },
  {
    header: 'Status',
    accessorFn: (app: ApplicationInstance) => app.status,
    Cell: ({ row }: { row: { original: ApplicationInstance } }) => (
      <StatusLabel status={STATUS_LABEL[row.original.status]}>{row.original.status}</StatusLabel>
    ),
  },
];

function useNamespaces(): string[] {
  interface FilterState {
    namespaces: Set<string>;
  }

  const namespacesSet = useSelector(({ filter }: { filter: FilterState }) => filter.namespaces);
  return useMemo(() => [...namespacesSet], [namespacesSet]);
}

export default function ApplicationList() {
  const { applications, isLoading } = useApplications();
  const selectedNamespaces = useNamespaces();

  const filtered = useMemo(() => {
    if (selectedNamespaces.length === 0) return applications;
    const set = new Set(selectedNamespaces);
    return applications.filter(app => set.has(app.namespace));
  }, [applications, selectedNamespaces]);

  if (isLoading) {
    return <Loader title="Loading applications..." />;
  }

  return (
    <SectionBox title={<SectionFilterHeader title="Applications" />} backLink="">
      <Table
        data={filtered}
        columns={columns}
        emptyMessage={
          <>
            No applications found. Resources must be labelled with{' '}
            <code>app.kubernetes.io/name</code>.
          </>
        }
      />
    </SectionBox>
  );
}

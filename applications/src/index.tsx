import { registerRoute, registerSidebarEntry } from '@kinvolk/headlamp-plugin/lib';
import ApplicationDetail from './components/Detail';
import ApplicationList from './components/List';

registerSidebarEntry({
  parent: null,
  name: 'applications',
  label: 'Applications',
  url: '/applications',
  icon: 'mdi:apps',
});

registerRoute({
  path: '/applications',
  sidebar: 'applications',
  name: 'applications',
  exact: true,
  component: () => <ApplicationList />,
});

registerRoute({
  path: '/applications/:namespace/:name',
  sidebar: 'applications',
  name: 'application',
  exact: true,
  component: () => <ApplicationDetail />,
});

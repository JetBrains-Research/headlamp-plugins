import { Icon } from '@iconify/react';
import { Activity } from '@kinvolk/headlamp-plugin/lib';
import { getCluster } from '@kinvolk/headlamp-plugin/lib/Utils';
import { IconButton, Tooltip } from '@mui/material';
import CloudShellView from './CloudShellView';

/**
 * App bar button that launches (and re-attaches to) a cloud shell as a
 * full-page activity, like Headlamp's native pod terminal/debug views.
 * The activity id is per-cluster, so clicking again just re-focuses the
 * existing session rather than opening a duplicate.
 */
export default function CloudShellButton() {
  const openCloudShell = () => {
    const cluster = getCluster();
    const id = `cloud-shell-${cluster || 'default'}`;
    Activity.launch({
      id,
      location: 'full',
      title: 'Cloud Shell',
      cluster: cluster || undefined,
      icon: <Icon icon="mdi:console" width="100%" height="100%" />,
      content: <CloudShellView onClose={() => Activity.close(id)} />,
    });
  };

  return (
    <Tooltip title="Cloud Shell">
      <IconButton aria-label="Cloud Shell" color="inherit" onClick={openCloudShell}>
        <Icon icon="mdi:console" />
      </IconButton>
    </Tooltip>
  );
}

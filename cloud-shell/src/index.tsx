import { registerAppBarAction, registerPluginSettings } from '@kinvolk/headlamp-plugin/lib';
import { TextField } from '@mui/material';
import CloudShellButton from './components/CloudShellButton';
import { DEFAULTS, PLUGIN_NAME, PluginConfig } from './config';

function Settings(props: {
  data?: Record<string, any>;
  onDataChange?: (data: Record<string, any>) => void;
}) {
  const { data, onDataChange } = props;
  const current = { ...DEFAULTS, ...data } as PluginConfig;

  function onChange(field: keyof PluginConfig, value: string) {
    if (onDataChange) {
      onDataChange({ ...current, [field]: value });
    }
  }

  const fields: { key: keyof PluginConfig; label: string; helperText: string }[] = [
    {
      key: 'image',
      label: 'Shell Image',
      helperText:
        'Container image used for cloud shell sessions. Its default command must keep running.',
    },
    {
      key: 'namespace',
      label: 'Namespace',
      helperText: 'Namespace where cloud shell sessions are created.',
    },
    {
      key: 'serviceAccountName',
      label: 'Service Account',
      helperText: 'Service account the shell pod runs as.',
    },
  ];

  return (
    <>
      {fields.map(({ key, label, helperText }) => (
        <TextField
          key={key}
          label={label}
          helperText={helperText}
          value={current[key]}
          onChange={e => onChange(key, e.target.value)}
          fullWidth
          margin="normal"
          variant="outlined"
          size="small"
        />
      ))}
    </>
  );
}

registerPluginSettings(PLUGIN_NAME, Settings, true);
registerAppBarAction(CloudShellButton);

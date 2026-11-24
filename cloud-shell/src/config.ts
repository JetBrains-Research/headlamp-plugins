import { ConfigStore } from '@kinvolk/headlamp-plugin/lib';

export const PLUGIN_NAME = '@jetbrains/cloud-shell';

export interface PluginConfig {
  /** Container image used for cloud shell sessions. */
  image: string;
  /** Namespace where cloud shell sessions are created. */
  namespace: string;
  /** Service account the shell pod runs as. */
  serviceAccountName: string;
}

export const DEFAULTS: PluginConfig = {
  image: 'ghcr.io/jetbrains-research/cloud-shell:latest',
  namespace: 'default',
  serviceAccountName: 'default',
};

const store = new ConfigStore<PluginConfig>(PLUGIN_NAME);

/** Reactively read the plugin settings, merged over the defaults. */
export function useSettings(): PluginConfig {
  const useConf = store.useConfig();
  const conf = useConf();
  return { ...DEFAULTS, ...conf };
}

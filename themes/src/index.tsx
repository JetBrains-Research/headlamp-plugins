import { registerAppTheme } from '@kinvolk/headlamp-plugin/lib';
import { AppTheme } from '@kinvolk/headlamp-plugin/lib/AppTheme';

export const jetBrainsLightTheme: AppTheme = {
  name: 'JetBrains Light',
  base: 'light',
  primary: '#087CFA',
  secondary: '#DFE1E5',
  text: {
    primary: '#000000',
  },
  link: {
    color: '#087CFA',
  },
  background: {
    default: '#FFFFFF',
    surface: '#FFFFFF',
    muted: '#F7F8FA',
  },
  sidebar: {
    background: '#F7F8FA',
    color: '#000000',
    selectedBackground: '#CFDFFF',
    selectedColor: '#000000',
    actionBackground: '#FFFFFF',
  },
  navbar: {
    background: '#FFFFFF',
    color: '#000000',
  },
  radius: 8,
  buttonTextTransform: 'none',
};

export const jetBrainsDarkTheme: AppTheme = {
  name: 'JetBrains Dark',
  base: 'dark',
  primary: '#3574F0',
  secondary: '#43454A',
  text: {
    primary: '#DFE1E5',
  },
  link: {
    color: '#548AF7',
  },
  background: {
    default: '#1E1F22',
    surface: '#2B2D30',
    muted: '#2B2D30',
  },
  sidebar: {
    background: '#2B2D30',
    color: '#DFE1E5',
    selectedBackground: '#35446B',
    selectedColor: '#DFE1E5',
    actionBackground: '#1E1F22',
  },
  navbar: {
    background: '#1E1F22',
    color: '#DFE1E5',
  },
  radius: 8,
  buttonTextTransform: 'none',
};

registerAppTheme(jetBrainsDarkTheme);
registerAppTheme(jetBrainsLightTheme);

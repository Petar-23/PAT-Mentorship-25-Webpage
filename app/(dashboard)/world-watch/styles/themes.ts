import type { Theme, ThemeColors } from '../types';

export const themes: Record<Theme, ThemeColors> = {
  gotham: {
    // Palantir Gotham-inspired — deep navy, electric blue accents
    base: '#0d1117',
    mantle: '#090c10',
    crust: '#060810',
    surface0: '#161b22',
    surface1: '#21262d',
    text: '#e6edf3',
    subtext0: '#8b949e',
    overlay0: '#484f58',
    red: '#f85149',
    peach: '#d29922',
    yellow: '#e3b341',
    green: '#3fb950',
    blue: '#58a6ff',
    mauve: '#bc8cff',
    teal: '#39d2c0',
  },
  mocha: {
    base: '#1e1e2e',
    mantle: '#181825',
    crust: '#11111b',
    surface0: '#313244',
    surface1: '#45475a',
    text: '#cdd6f4',
    subtext0: '#a6adc8',
    overlay0: '#6c7086',
    red: '#ff5577',
    peach: '#ff8844',
    yellow: '#ffcc00',
    green: '#44ff88',
    blue: '#4499ff',
    mauve: '#cba6f7',
    teal: '#94e2d5',
  },
  latte: {
    base: '#eff1f5',
    mantle: '#e6e9ef',
    crust: '#dce0e8',
    surface0: '#ccd0da',
    surface1: '#bcc0cc',
    text: '#4c4f69',
    subtext0: '#6c6f85',
    overlay0: '#9ca0b0',
    red: '#d20f39',
    peach: '#fe640b',
    yellow: '#df8e1d',
    green: '#40a02b',
    blue: '#1e66f5',
    mauve: '#8839ef',
    teal: '#179299',
  },
  bloomberg: {
    base: '#0a0e14',
    mantle: '#060a0f',
    crust: '#040709',
    surface0: '#1a2332',
    surface1: '#243347',
    text: '#33ff33',
    subtext0: '#1a9f1a',
    overlay0: '#0f5c0f',
    red: '#ff3333',
    peach: '#ffaa00',
    yellow: '#ffff00',
    green: '#33ff33',
    blue: '#3399ff',
    mauve: '#cc33ff',
    teal: '#00ffcc',
  },
};

export const severityColors = (theme: ThemeColors): Record<number, string> => ({
  4: theme.red,
  3: theme.peach,
  2: theme.yellow,
  1: theme.overlay0,
});

export const getThemeFromStorage = (): Theme => {
  if (typeof window === 'undefined') return 'gotham';
  return (localStorage.getItem('ww-theme') as Theme) || 'gotham';
};

export const setThemeToStorage = (theme: Theme): void => {
  if (typeof window === 'undefined') return;
  localStorage.setItem('ww-theme', theme);
};

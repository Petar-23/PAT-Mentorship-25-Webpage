export interface GeoEvent {
  id: string;
  title: string;
  description: string;
  lat: number;
  lng: number;
  severity: 1 | 2 | 3 | 4;
  category: 'conflict' | 'economic' | 'natural-disaster' | 'political' | 'health';
  source: string;
  timestamp: string;
  country: string;
}

export interface EconCalendarEntry {
  id: string;
  time: string; // ISO timestamp
  currency: string;
  impact: 1 | 2 | 3; // 1=low, 2=medium, 3=high
  event: string;
  forecast: string;
  previous: string;
  actual: string; // empty if future
}

export interface LayerPoint {
  id: string;
  lat: number;
  lng: number;
  label: string;
  subLabel?: string;
  color: string;
}

export interface LayerArc {
  id: string;
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  label: string;
  color: string;
}

export interface DataLayer {
  id: string;
  name: string;
  icon: string;
  enabled: boolean;
  type: 'points' | 'arcs';
  points?: LayerPoint[];
  arcs?: LayerArc[];
  color: string;
}

export type Theme = 'gotham' | 'mocha' | 'latte' | 'bloomberg';

export interface ThemeColors {
  base: string;
  mantle: string;
  crust: string;
  surface0: string;
  surface1: string;
  text: string;
  subtext0: string;
  overlay0: string;
  red: string;
  peach: string;
  yellow: string;
  green: string;
  blue: string;
  mauve: string;
  teal: string;
}

export const SEVERITY_LABELS: Record<number, string> = {
  4: 'CRITICAL',
  3: 'HIGH',
  2: 'MEDIUM',
  1: 'LOW',
};

export const CATEGORY_ICONS: Record<string, string> = {
  conflict: 'conflict',
  economic: 'economic',
  'natural-disaster': 'disaster',
  political: 'political',
  health: 'health',
};

export const IMPACT_LABELS: Record<number, string> = {
  3: 'HIGH',
  2: 'MED',
  1: 'LOW',
};

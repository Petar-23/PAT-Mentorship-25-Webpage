import type { ImageSourcePropType } from 'react-native';

export type Film = {
  id: string;
  title: string;
  topic: string;
  description: string;
  duration: number;
  bytes: number;
  file: string;
  still: ImageSourcePropType;
};

// These PAT editorial films are the local preview catalog. Member videos are never bundled.
export const films: readonly Film[] = [
  {
    id: 'fvg-v1', title: 'Fair Value Gaps', topic: 'ICT-Konzepte',
    description: 'Vom klassischen Drei-Kerzen-Muster über die Volume Imbalance bis zum Suspension Block. Drei Varianten im Chart, Schritt für Schritt.',
    duration: 80, bytes: 2129589, file: 'fvg-v1.mp4',
    still: require('../assets/art/fvg-still.jpg'),
  },
  {
    id: 'wochenprofil-v1', title: 'Das Wochenprofil', topic: 'Wochenvorbereitung',
    description: 'Wie greifen Kalender und Marktstruktur ineinander? Anhand der Woche ab dem 19. Oktober 2026 siehst du zwei mögliche Pfade für den Nasdaq.',
    duration: 78.52, bytes: 2300226, file: 'wochenprofil-v1.mp4',
    still: require('../assets/art/profil-still.jpg'),
  },
];

export function clock(seconds: number) {
  const whole = Math.floor(Math.max(0, seconds));
  return Math.floor(whole / 60) + ':' + String(whole % 60).padStart(2, '0');
}

export function fileSize(bytes: number) {
  return (bytes / 1_000_000).toFixed(1).replace('.', ',') + ' MB';
}

export type Progress = { seconds: number; seen: boolean };
export type Journal = Record<string, Progress>;

export function decodeJournal(raw: string | null): Journal {
  if (!raw) return {};
  try {
    const input: unknown = JSON.parse(raw);
    if (!input || typeof input !== 'object') return {};
    const result: Journal = {};
    for (const film of films) {
      const item = (input as Record<string, Partial<Progress> | null>)[film.id];
      if (item && typeof item.seconds === 'number' && Number.isFinite(item.seconds)) {
        result[film.id] = { seconds: Math.min(film.duration, Math.max(0, item.seconds)), seen: item.seen === true };
      }
    }
    return result;
  } catch {
    return {};
  }
}

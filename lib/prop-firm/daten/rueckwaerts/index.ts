/**
 * Lader für die vorab gerechneten Tabellen des Rückwärts-Modus (scripts/prop-firm-rueckwaerts.mjs).
 * Je Datei ein eigener Chunk: der Browser lädt nur die Tabelle für die gewählten Trades pro Woche und den Zeitraum.
 */
import type { RwTabelle } from '../../rueckwaerts'

export const TABELLEN: Record<string, () => Promise<{ default: unknown }>> = {
  'tpw2-m1': () => import('./tpw2-m1.json'),
  'tpw2-m2': () => import('./tpw2-m2.json'),
  'tpw2-m3': () => import('./tpw2-m3.json'),
  'tpw2-m6': () => import('./tpw2-m6.json'),
  'tpw2-m12': () => import('./tpw2-m12.json'),
  'tpw5-m1': () => import('./tpw5-m1.json'),
  'tpw5-m2': () => import('./tpw5-m2.json'),
  'tpw5-m3': () => import('./tpw5-m3.json'),
  'tpw5-m6': () => import('./tpw5-m6.json'),
  'tpw5-m12': () => import('./tpw5-m12.json'),
  'tpw10-m1': () => import('./tpw10-m1.json'),
  'tpw10-m2': () => import('./tpw10-m2.json'),
  'tpw10-m3': () => import('./tpw10-m3.json'),
  'tpw10-m6': () => import('./tpw10-m6.json'),
  'tpw10-m12': () => import('./tpw10-m12.json'),
  'tpw20-m1': () => import('./tpw20-m1.json'),
  'tpw20-m2': () => import('./tpw20-m2.json'),
  'tpw20-m3': () => import('./tpw20-m3.json'),
  'tpw20-m6': () => import('./tpw20-m6.json'),
  'tpw20-m12': () => import('./tpw20-m12.json'),
}

export async function ladeTabelle(tradesProWoche: number, monate: number): Promise<RwTabelle> {
  const lader = TABELLEN[`tpw${tradesProWoche}-m${monate}`]
  if (!lader) throw new Error(`Keine Tabelle für ${tradesProWoche} Trades pro Woche und ${monate} Monate`)
  return (await lader()).default as RwTabelle
}

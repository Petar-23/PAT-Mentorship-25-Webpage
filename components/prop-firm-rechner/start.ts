/**
 * Startwerte des Prop-Firm-Rechners: eine Quelle für die Eingaben beim ersten Laden und für die Beispiel-Karte im Hero.
 * Die Zahlen sind in beiden Sprachen gleich, nur das Dezimalzeichen im Eingabefeld folgt der Sprache.
 */
import type { Streuung } from '@/lib/prop-firm/stroeme'
import { formatierer } from './format'

export type Form = {
  trefferquote: string
  gewinnR: string
  verlustR: string
  tradesProWoche: string
  streuung: Streuung
  groessenModus: 'risiko' | 'kontrakte' | 'dd_anteil'
  risikoUsd: string
  instrument: 'MNQ' | 'NQ'
  stopPunkte: string
  kontrakte: string
  ddAnteil: string
  politik: 'A' | 'B' | 'C'
  politikFaktor: 1 | 2
  botBetrieb: boolean
  perpKosten: boolean
  pfade: number
}

export const START_ZAHLEN = { trefferquote: 45, gewinnR: 1.5, verlustR: 1, tradesProWoche: 5, risikoUsd: 200 } as const

function startForm(sprache: 'de' | 'en'): Form {
  const z = (x: number) => formatierer(sprache).zahlText(x, 1)
  const S = START_ZAHLEN
  return {
    trefferquote: z(S.trefferquote), gewinnR: z(S.gewinnR), verlustR: z(S.verlustR), tradesProWoche: z(S.tradesProWoche),
    streuung: 'gemischt', groessenModus: 'risiko', risikoUsd: String(S.risikoUsd), instrument: 'MNQ', stopPunkte: '20', kontrakte: '3',
    ddAnteil: '10', politik: 'A', politikFaktor: 1, botBetrieb: false, perpKosten: true, pfade: 1000,
  }
}

/** Startwerte je Sprache, einmal beim Laden des Moduls. */
export const STARTS: Record<'de' | 'en', Form> = { de: startForm('de'), en: startForm('en') }

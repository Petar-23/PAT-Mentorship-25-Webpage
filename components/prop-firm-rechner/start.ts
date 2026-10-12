/**
 * Startwerte des Prop-Firm-Rechners (vorwärts und rückwärts), eine Quelle für beide Sprachen.
 * Die Zahlen sind gleich, nur das Dezimalzeichen im Eingabefeld folgt der Sprache.
 */
import type { Streuung } from '@/lib/prop-firm/stroeme'
import { formatierer } from './format'

export type Form = {
  trefferquote: string
  crv: string
  risikoUsd: string
  tradesProWoche: string
  streuung: Streuung
  verlustStreuung: boolean
  instrument: 'MNQ' | 'NQ'
  stopPunkte: string
  politik: 'A' | 'B' | 'C'
  politikFaktor: 1 | 2
  botBetrieb: boolean
  perpKosten: boolean
  pfade: number
}

export const START_ZAHLEN = { trefferquote: 45, crv: 2, tradesProWoche: 5, risikoUsd: 200 } as const

/** Rückwärts: 5.000 USD netto in 6 Monaten, 5 Trades pro Woche, in 5 von 10 Fällen */
export const RUECK_START = { ziel: 5000, monate: 6, tradesProWoche: 5, sicherheit: 5 } as const

function startForm(sprache: 'de' | 'en'): Form {
  const z = (x: number) => formatierer(sprache).zahlText(x, 1)
  const S = START_ZAHLEN
  return {
    trefferquote: z(S.trefferquote), crv: z(S.crv), risikoUsd: String(S.risikoUsd), tradesProWoche: z(S.tradesProWoche),
    streuung: 'gleich', verlustStreuung: false, instrument: 'MNQ', stopPunkte: '20', politik: 'A', politikFaktor: 1,
    botBetrieb: false, perpKosten: true, pfade: 500,
  }
}

/** Startwerte je Sprache, einmal beim Laden des Moduls. */
export const STARTS: Record<'de' | 'en', Form> = { de: startForm('de'), en: startForm('en') }

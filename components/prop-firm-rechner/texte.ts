/**
 * Prop-Firm-Rechner: Wörterbücher je Sprache. Komponenten bekommen `sprache` und holen sich hier ihre Texte.
 * Deutsch: texte.de.ts, Englisch: texte.en.ts (gleiche Form, Typ Woerterbuch).
 */
import { de, type Woerterbuch } from './texte.de'
import { en } from './texte.en'

export type Sprache = 'de' | 'en'
export type { Absatz, Woerterbuch } from './texte.de'

export const SPRACHEN: readonly Sprache[] = ['de', 'en']

const WOERTERBUECHER: Record<Sprache, Woerterbuch> = { de, en }

export function woerterbuch(sprache: Sprache): Woerterbuch {
  return WOERTERBUECHER[sprache]
}

export { PFADE } from './pfade'

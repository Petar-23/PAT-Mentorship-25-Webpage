/**
 * Browser-Verlauf für die Bildschirm-App: jeder gezeigte Schritt (Frage, Fertig-Schirm, Ergebnis, offenes Blatt) ist ein
 * Eintrag. Browser-Zurück springt so genau einen Schritt zurück, und „Zurück“ in der App geht denselben Weg
 * (history.back statt eines zweiten Eintrags). Die Adresse bleibt gleich; Next.js übernimmt seine eigenen Felder
 * beim pushState selbst in den Eintrag.
 */
export type Pfad = 'rueck' | 'vor'
export type BlattArt = 'methode' | 'andere' | 'annahmen'
export type Stand = { pfad: Pfad; index: number; blatt: BlattArt | null }
export type Eintrag = { tiefe: number; stand: Stand }

export const START_STAND: Stand = { pfad: 'rueck', index: 0, blatt: null }
export const VERLAUF_SCHLUESSEL = 'pfr'

export const gleich = (a: Stand | undefined, b: Stand) => !!a && a.pfad === b.pfad && a.index === b.index && a.blatt === b.blatt

/**
 * Tiefe des früheren Eintrags, zu dem „Zurück zu s“ springen soll, oder -1, wenn s nicht in der Kette davor liegt
 * (dann wird der aktuelle Eintrag ersetzt). Gesucht wird nur innerhalb derselben Fragen-Kette: gleicher Weg, Schritte
 * davor mit kleinerem Index, ohne offenes Blatt. So springt „Zurück“ nach einem Wegwechsel nicht über ein altes
 * Ergebnis hinweg an den Anfang.
 */
export function zielImVerlauf(stapel: readonly (Stand | undefined)[], tiefe: number, s: Stand): number {
  let vorher = stapel[tiefe]
  for (let d = tiefe - 1; d >= 0; d--) {
    const e = stapel[d]
    if (!e || !vorher) return -1
    if (gleich(e, s)) return d
    if (e.pfad !== vorher.pfad || e.blatt || e.index >= vorher.index) return -1
    vorher = e
  }
  return -1
}

/** Eintrag aus history.state lesen; null, wenn er nicht vom Rechner stammt. */
export function verlaufAus(state: unknown): Eintrag | null {
  const e = (state as Record<string, unknown> | null)?.[VERLAUF_SCHLUESSEL] as Eintrag | undefined
  if (!e || typeof e.tiefe !== 'number' || !e.stand) return null
  const { pfad, index, blatt } = e.stand
  if ((pfad !== 'rueck' && pfad !== 'vor') || typeof index !== 'number') return null
  if (blatt !== null && blatt !== 'methode' && blatt !== 'andere' && blatt !== 'annahmen') return null
  return e
}

export function schreibeVerlauf(art: 'push' | 'replace', e: Eintrag) {
  try {
    if (art === 'push') window.history.pushState({ [VERLAUF_SCHLUESSEL]: e }, '')
    else window.history.replaceState({ ...(window.history.state ?? {}), [VERLAUF_SCHLUESSEL]: e }, '')
  } catch {
    // Verlauf gesperrt (etwa in einer Vorschau): die App läuft ohne Browser-Zurück weiter.
  }
}

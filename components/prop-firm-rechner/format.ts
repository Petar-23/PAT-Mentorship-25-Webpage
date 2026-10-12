/**
 * Zahlen, Beträge, Prozente und Daten für den Prop-Firm-Rechner, je Sprache.
 * Deutsch: 1.234 USD, 45 %, +1,50 R, 09.10.2026. Englisch: 1,234 USD, 45%, +1.50 R, Oct 9, 2026.
 * Minuszeichen ist immer U+2212, damit Zahlenspalten sauber stehen.
 */
const MINUS = '−'

export type Formatierer = {
  /** Betrag in USD, gerundet auf ganze Dollar, optional mit Vorzeichen. */
  usd: (x: number | null | undefined, vorzeichen?: boolean) => string
  zahlText: (x: number | null | undefined, stellen?: number) => string
  r: (x: number, vorzeichen?: boolean) => string
  pct: (x: number | null | undefined) => string
  /** Prozentzahl, die schon in Prozent vorliegt (45 -> "45 %" bzw. "45%"). */
  prozent: (x: number) => string
  groesseKurz: (usdBetrag: number) => string
  /** ISO-Datum (2026-10-09) lesbar. */
  datum: (iso: string) => string
  /** Platzhalter für fehlende Werte. */
  ka: string
}

export function formatierer(sprache: 'de' | 'en'): Formatierer {
  const locale = sprache === 'de' ? 'de-DE' : 'en-US'
  const ka = sprache === 'de' ? 'k. A.' : 'n/a'
  const pctSep = sprache === 'de' ? ' %' : '%'
  const zahl = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 })
  const zahl1 = new Intl.NumberFormat(locale, { maximumFractionDigits: 1, minimumFractionDigits: 0 })
  const zahl2 = new Intl.NumberFormat(locale, { maximumFractionDigits: 2, minimumFractionDigits: 2 })
  const monate = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })

  const usd = (x: number | null | undefined, vorzeichen = false) => {
    if (x === null || x === undefined || !Number.isFinite(x)) return ka
    const r = Math.round(x)
    if (r === 0) return '0 USD'
    const s = r < 0 ? MINUS : vorzeichen ? '+' : ''
    return `${s}${zahl.format(Math.abs(r))} USD`
  }
  const zahlText = (x: number | null | undefined, stellen = 0) => {
    if (x === null || x === undefined || !Number.isFinite(x)) return ka
    const t = stellen === 0 ? zahl.format(x) : stellen === 1 ? zahl1.format(x) : zahl2.format(x)
    return t.replace('-', MINUS)
  }
  const r = (x: number, vorzeichen = true) => `${x < 0 ? MINUS : vorzeichen && x > 0 ? '+' : ''}${zahl2.format(Math.abs(x))} R`
  const prozent = (x: number) => `${zahl1.format(x)}${pctSep}`
  const pct = (x: number | null | undefined) => {
    if (x === null || x === undefined || !Number.isFinite(x)) return ka
    if (x > 0 && x < 0.005) return `< 1${pctSep}`
    if (x < 1 && x > 0.995) return `> 99${pctSep}`
    return `${Math.round(x * 100)}${pctSep}`
  }
  const groesseKurz = (usdBetrag: number) => (usdBetrag >= 1000 ? `${zahl1.format(usdBetrag / 1000)}K` : zahl.format(usdBetrag))
  const datum = (iso: string) => {
    const [j, m, t] = iso.split('-')
    if (sprache === 'de') return `${t}.${m}.${j}`
    return monate.format(new Date(Date.UTC(Number(j), Number(m) - 1, Number(t))))
  }
  return { usd, zahlText, r, pct, prozent, groesseKurz, datum, ka }
}

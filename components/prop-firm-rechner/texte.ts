import type { Konto, Phase } from '@/lib/prop-firm/kern'

const zahl = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 })
const zahl1 = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1, minimumFractionDigits: 0 })
const zahl2 = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2, minimumFractionDigits: 2 })
const MINUS = '−'

export function usd(x: number | null | undefined, vorzeichen = false): string {
  if (x === null || x === undefined || !Number.isFinite(x)) return 'k. A.'
  const r = Math.round(x)
  const betrag = zahl.format(Math.abs(r))
  if (r === 0) return '0 USD'
  const s = r < 0 ? MINUS : vorzeichen ? '+' : ''
  return `${s}${betrag} USD`
}

export function zahlText(x: number | null | undefined, stellen = 0): string {
  if (x === null || x === undefined || !Number.isFinite(x)) return 'k. A.'
  const t = stellen === 0 ? zahl.format(x) : stellen === 1 ? zahl1.format(x) : zahl2.format(x)
  return t.replace('-', MINUS)
}

export function r(x: number, vorzeichen = true): string {
  const t = zahl2.format(Math.abs(x))
  return `${x < 0 ? MINUS : vorzeichen && x > 0 ? '+' : ''}${t} R`
}

export function pct(x: number | null | undefined): string {
  if (x === null || x === undefined || !Number.isFinite(x)) return 'k. A.'
  if (x > 0 && x < 0.005) return '< 1 %'
  if (x < 1 && x > 0.995) return '> 99 %'
  return `${Math.round(x * 100)} %`
}

export function groesseKurz(usdBetrag: number): string {
  if (usdBetrag >= 1000) return `${zahl1.format(usdBetrag / 1000)}K`
  return zahl.format(usdBetrag)
}

const DD_ART: Record<string, string> = {
  eod_trailing: 'nachziehend zum Tagesschluss',
  intraday_trailing: 'nachziehend in Echtzeit',
  statisch: 'fest',
  keiner: 'keiner',
}

function phaseName(p: Phase, i: number, k: Konto): string {
  if (p.typ === 'eval') {
    const n = k.phasen.filter((x) => x.typ === 'eval').length
    return n > 1 ? `Prüfung, Stufe ${p.stufe}` : 'Prüfung'
  }
  return i === 0 ? 'Funded (sofort, ohne Prüfung)' : 'Funded'
}

function dllText(p: Phase): string | null {
  if (p.dll_betrag === null && p.dll_anteil === null) return null
  let b: string
  if (p.dll_stufen && p.dll_stufen.length) b = `${usd(p.dll_betrag)}, steigt mit dem Kontostand`
  else if (p.dll_anteil !== null) b = `${zahl1.format(p.dll_anteil * 100)} % ${p.dll_anteil_bezug === 'tagesbeginn' ? 'des Stands bei Tagesbeginn' : 'des Startsaldos'}`
  else b = usd(p.dll_betrag)
  const w = p.dll_wirkung === 'tagessperre' ? 'weich: Handel für den Rest des Tages gesperrt' : 'hart: Konto verloren'
  return `Tagesverlustgrenze ${b} (${w})`
}

/** Regeln eines Kontotyps in kurzen Sätzen, je Phase. */
export function regelSaetze(k: Konto): { titel: string; saetze: string[] }[] {
  return k.phasen.map((p, i) => {
    const s: string[] = []
    if (p.typ === 'eval' && p.ziel !== null) s.push(`Gewinnziel ${usd(p.ziel)}`)
    if (p.dd_art !== 'keiner' && p.dd_betrag !== null) {
      let t = `Drawdown ${usd(p.dd_betrag)}, ${DD_ART[p.dd_art] ?? p.dd_art}`
      if (p.lock !== null && p.dd_art !== 'statisch') {
        const ueber = p.lock - p.start
        t += ueber === 0 ? ', zieht nur bis zum Startsaldo nach' : `, zieht nur bis Start ${usd(ueber, true)} nach`
      }
      s.push(t)
    }
    const d = dllText(p)
    if (d) s.push(d)
    if (p.cons_anteil) s.push(`Consistency: bester Tag höchstens ${Math.round(p.cons_anteil * 100)} % des Gesamtgewinns (sonst steigt das Ziel)`)
    if (p.min_tage) s.push(`mindestens ${p.min_tage} Handelstage`)
    if (p.max_tage) s.push(`Zeitlimit ${p.max_tage} Kalendertage`)
    if (p.max_micro !== null || p.max_mini !== null) s.push(`höchstens ${p.max_mini ?? 'k. A.'} Mini bzw. ${p.max_micro ?? 'k. A.'} Micro${p.skalierung ? ' (Scaling-Plan nach Kontostand)' : ''}`)
    if (p.hebel) s.push(`Hebel bis ${p.hebel}x`)
    if (p.inaktiv_art === 'kalenderwoche') s.push('mindestens ein Trade je Kalenderwoche')
    else if (p.inaktiv_tage) s.push(`höchstens ${p.inaktiv_tage} Tage ohne Trade`)
    const a = p.ausz
    if (a) {
      const t: string[] = [`Split ${Math.round(a.split * 100)} % für dich`]
      if (a.gewinntage) t.push(`${a.gewinntage} Gewinntage${a.min_tagesgewinn ? ` ab ${usd(a.min_tagesgewinn)}` : ''} je Auszahlung`)
      if (a.handelstage) t.push(`${a.handelstage} Handelstage je Auszahlung`)
      if (a.erste_ab_tag) t.push(`erste Auszahlung frühestens nach ${a.erste_ab_tag} Tagen`)
      if (a.kalendertage) t.push(`Abstand ${a.kalendertage} Tage`)
      if (a.puffer) t.push(`Puffer ${usd(a.puffer)} bleibt stehen`)
      if (a.max_anteil !== null && a.max_anteil < 1) t.push(`höchstens ${Math.round(a.max_anteil * 100)} % des Gewinns`)
      if (a.max_betrag && a.max_betrag.length) t.push(`höchstens ${a.max_betrag.map((x) => usd(x)).join(' / ')} je Auszahlung`)
      if (a.min_betrag) t.push(`mindestens ${usd(a.min_betrag)}`)
      if (a.cons_anteil) t.push(`Consistency ${a.cons_anteil.map((x) => `${Math.round(x * 100)} %`).join(' / ')}`)
      if (a.max_anzahl) t.push(`nach ${a.max_anzahl} Auszahlungen ${a.ende_nach_max === 'geschlossen' ? 'Konto geschlossen' : 'Wechsel ins Live-Konto'}`)
      if (a.max_summe_brutto) t.push(`ab ${usd(a.max_summe_brutto)} Auszahlungen Wechsel ins Live-Konto`)
      if (a.lebenszeit_deckel) t.push(`insgesamt höchstens ${usd(a.lebenszeit_deckel)}`)
      s.push(`Auszahlung: ${t.join(', ')}`)
    }
    return { titel: phaseName(p, i, k), saetze: s }
  })
}

export function kostenSaetze(k: Konto, botBetrieb: boolean): string[] {
  const s: string[] = []
  if (k.preis === null) s.push('Preis: von der Firma nicht öffentlich genannt')
  else s.push(`Preis ${usd(k.preis)} ${k.rhythmus === 'monatlich' ? 'pro Monat bis zum Bestehen' : 'einmalig'}`)
  if (k.aktivierung) s.push(`Aktivierung ${usd(k.aktivierung)}`)
  if (k.reset !== null) s.push(`Reset ${usd(k.reset)}${k.reset_setzt_abo_zurueck ? ' (verschiebt das Abo um 30 Tage)' : ''}`)
  for (const [name, betrag, nurBot] of k.fixkosten) {
    if (betrag && (botBetrieb || !nurBot)) s.push(`${name}: ${usd(betrag)} pro Monat${nurBot ? ' (nur mit Bot)' : ''}`)
  }
  if (k.auszahlung_gebuehr) s.push(`Gebühr je Auszahlung ${usd(k.auszahlung_gebuehr)}`)
  return s
}

export const POLITIK_TEXT = {
  A: { name: 'Nimm und geh', kurz: 'Jede mögliche Auszahlung sofort in voller Höhe. Stirbt das Konto danach, wird neu gekauft.' },
  B: { name: 'Cash-Cow', kurz: 'Nur auszahlen, was über einem stehenden Polster liegt. Das Konto soll lange leben und regelmäßig zahlen.' },
  C: { name: 'Hybrid', kurz: 'Erst wie „Nimm und geh“, bis das Polster einmal steht. Danach wie „Cash-Cow“.' },
} as const

export function datum(iso: string): string {
  const [j, m, t] = iso.split('-')
  return `${t}.${m}.${j}`
}

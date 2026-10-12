/**
 * Prop-Firm-Rechner: Kontotypen aus der Regel-Datei (öffentliche Firmenregeln, Stand 09.10.2026) für Rechnung und
 * Anzeige. Die Datei selbst wird vom Aufrufer importiert und hier nur ausgewertet.
 */
import { kontoAusDaten, wendeAenderungenAn } from './kern'
import type { Konto } from './kern'

type Quelle = { url: string; titel: string; abruf: string | null }
type RohKonto = {
  id: string
  firma: string
  programm: string | null
  variante: string | null
  groesse: number
  quellen: string[]
  regeln: Record<string, unknown>
  offen: string[]
  strenger: string[]
  live_nicht_simuliert: boolean
  varianten: { name: string; text: string; aenderungen: [string, unknown][] }[]
  aktionen: { name: string; text: string }[]
}
type RohNicht = { id: string; firma: string; programm: string | null; variante: string | null; groesse: number; quellen: string[]; grund: string; preis: number | null }
export type RegelDaten = { stand: string; quellen: Record<string, Quelle>; konten: RohKonto[]; nicht_simulierbar: RohNicht[] }

export type Rechnung = { name: string; text: string | null; konto: Konto }

export type KontoEintrag = {
  id: string
  firma: string
  programm: string
  variante: string
  groesse: number
  quellen: string[]
  offen: string[]
  strenger: string[]
  liveNichtSimuliert: boolean
  aktionen: { name: string; text: string }[]
  rechnungen: Rechnung[] // Standard zuerst, danach offene Varianten
  konto: Konto // Standard
  perp: boolean
  hatEval: boolean
  evalStufen: number
  aktiv: boolean
  botAusschluss: boolean
}

export type NichtSimulierbarEintrag = RohNicht

export const FIRMEN = ['Topstep', 'MyFundedFutures', 'Tradeify', 'MyFundedPerps', 'Vest'] as const

export function ladeKonten(daten: RegelDaten): KontoEintrag[] {
  return daten.konten.map((k) => {
    const konto = kontoAusDaten(k.regeln)
    const rechnungen: Rechnung[] = [{ name: 'standard', text: null, konto }]
    for (const v of k.varianten) {
      rechnungen.push({ name: v.name, text: v.text, konto: kontoAusDaten(wendeAenderungenAn(k.regeln, v.aenderungen)) })
    }
    const evalStufen = konto.phasen.filter((p) => p.typ === 'eval').length
    return {
      id: k.id,
      firma: k.firma,
      programm: k.programm ?? '',
      variante: k.variante ?? '',
      groesse: k.groesse,
      quellen: k.quellen,
      offen: k.offen,
      strenger: k.strenger,
      liveNichtSimuliert: k.live_nicht_simuliert,
      aktionen: k.aktionen,
      rechnungen,
      konto,
      perp: konto.perp,
      hatEval: evalStufen > 0,
      evalStufen,
      aktiv: konto.angebot_status === 'aktiv',
      botAusschluss: konto.ko_kriterien.some(([, b, w]) => b === 'bot' && w === 'ausschluss') || konto.bot_eignung === 'ungeeignet',
    }
  })
}

// ------------------------------------------------------------------------------------------------- Texte
export const KO_TEXT: Record<string, string> = {
  bot_nur_eigenes_geraet: 'Bots nur vom eigenen Gerät (kein VPS)',
  live_keine_automatisierung: 'Im Live-Konto keine Automatisierung',
  hft_simfill_ausnutzen: 'HFT oder Ausnutzen simulierter Füllungen verboten (Ermessen der Firma)',
  news_t1_flat_funded: 'Im Funded-Konto bei wichtigen Wirtschaftsdaten flach sein',
  positionsgroesse_realistisch: 'Positionsgröße muss „realistisch“ sein (Ermessen der Firma)',
  exposure_cap_gemeinsam: 'Gemeinsame Positionsgrenze über gleichartige Konten',
  bot_eigenentwicklung_video: 'Bots nur als Eigenentwicklung, Nachweis per Video',
  microscalping: 'Microscalping verboten (Ermessen der Firma)',
  kein_api_handel: 'Kein Handel über API: für Bots ausgeschlossen',
}

export const VERBOT_TEXT: Record<string, string> = {
  gambling: 'Gambling-Verhalten',
  max_risiko_je_trade: 'Höchstrisiko je Trade',
  windfall: 'Windfall-Gewinne',
  kopierhandel: 'Kopierhandel',
  hedging: 'Hedging',
  hft: 'Hochfrequenzhandel',
  news: 'News-Handel',
  sonstige: 'Weitere',
}

export const BOT_TEXT: Record<string, string> = {
  geeignet: 'erlaubt',
  bedingt: 'mit Bedingungen erlaubt',
  ungeeignet: 'nicht erlaubt',
  unklar: 'nicht eindeutig geregelt',
}

/** Feldpfad eines offenen Punkts -> verständliche Bezeichnung. */
export function feldText(pfad: string): string {
  const f = pfad.replace(/^phasen\[\d+\]\./, '')
  const regeln: [RegExp, string][] = [
    [/preis/, 'Preis'],
    [/aktivierung/, 'Aktivierungsgebühr'],
    [/reset/, 'Reset'],
    [/gewinnziel/, 'Gewinnziel'],
    [/startsaldo/, 'Startsaldo'],
    [/drawdown\.(bruch_basis)/, 'Wann der Drawdown greift'],
    [/drawdown/, 'Drawdown'],
    [/tagesverlust/, 'Tagesverlustgrenze'],
    [/auszahlung\.consistency|^consistency/, 'Consistency-Regel'],
    [/auszahlung/, 'Auszahlungsregel'],
    [/max_kontrakte|skalierung/, 'Kontraktgrenze'],
    [/hebel/, 'Hebel'],
    [/mindesthandelstage/, 'Mindesthandelstage'],
    [/max_kalendertage/, 'Zeitlimit'],
    [/inaktivitaet/, 'Inaktivität'],
  ]
  for (const [re, txt] of regeln) if (re.test(f)) return txt
  return f
}

export function groesseText(usd: number): string {
  if (usd >= 1000) return `${(usd / 1000).toLocaleString('de-DE', { maximumFractionDigits: 1 })}K`
  return `${usd.toLocaleString('de-DE')}`
}

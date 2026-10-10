/**
 * Prop-Firm-Rechner: Simulationskern.
 *
 * TypeScript-Fassung der Kernregeln des Python-Referenz-Simulators (Fassung 3.2.1): ein Kauf (`versuch`) und ein
 * Konto-Platz über 12 Monate mit Neukauf/Reset und allen Gebühren (`kampagne`). Gleiche Ströme ergeben dieselben
 * Kennzahlen wie die Referenz (Paritätstest lib/prop-firm-rechner.test.mjs).
 *
 * Nur löschbare TypeScript-Syntax und keine Laufzeit-Importe, damit Node die Datei in Tests direkt ausführen kann.
 */

export const EPS = 1e-9
export const MONAT = 30.44

// ------------------------------------------------------------------------------------------------- Typen
export type Trade = {
  ein: number // Einstiegsminute ab 18:00 ET (Futures-Handelstag)
  aus: number // Ausstiegsminute ab 18:00 ET
  pnl_e: number // Netto-Ergebnis je Einheit (USD je Kontrakt bzw. R)
  risiko_e: number // Größen-Nenner je Einheit
  stop_e: number // Verlust je Einheit am Stop (1 R)
  mae_e: number | null // Gegenbewegung je Einheit (>= 0)
  mfe_e: number | null // Gunstbewegung je Einheit (>= 0)
  ist_stop: boolean
  kurs: number | null
  stop_pt: number | null
  punktwert_e: number | null // USD je Indexpunkt je Einheit
  stunden: number | null
}

export type Strom = {
  modus: 'kontrakt' | 'r'
  instrument: 'micro' | 'mini' | 'perp'
  uhr: number[] // Kalendertag-Nummer je Handelstag
  woche: number[] // ISO-Woche je Handelstag (Jahr * 100 + Woche)
  tage: Trade[][] // Trades je Handelstag, nach Einstieg sortiert
}

export type Ausz = {
  split: number
  split_stufen: [number | null, number][] | null // (bis kumuliert, Split); null = unbegrenzt
  gewinntage: number | null
  min_tagesgewinn: number | null
  tagesgewinn_strikt: boolean
  handelstage: number | null
  kalendertage: number | null
  erste_ab_tag: number | null
  min_saldo: number | null
  puffer: number | null
  puffer_bezug: string | null
  max_betrag: number[] | null
  max_anteil: number | null
  max_anteil_bezug: string
  min_betrag: number
  cons_anteil: number[] | null
  cons_zeitraum: string
  zyklus_ziel: number[] | null
  gewinn_positiv: boolean
  antragstag_aus: boolean
  max_anzahl: number | null
  max_summe_brutto: number | null
  ende_nach_max: string
  lebenszeit_deckel: number | null
  lebenszeit_basis: string
}

export type Phase = {
  typ: 'eval' | 'funded' | 'live'
  stufe: number
  start: number
  ziel: number | null
  dd_art: string
  dd_betrag: number | null
  boden0: number | null
  lock: number | null
  bruch_basis: string
  nach_ausz: string | null
  nach_ausz_boden: number | null
  dll_betrag: number | null
  dll_anteil: number | null
  dll_bezug: string | null
  dll_anteil_bezug: string | null
  dll_wirkung: string | null
  dll_stufen: [number, number][] | null
  cons_anteil: number | null
  cons_wirkung: string | null
  min_tage: number | null
  max_tage: number | null
  max_micro: number | null
  max_mini: number | null
  skalierung: [number, number | null, number | null][] | null
  hebel: number | null
  inaktiv_tage: number | null
  inaktiv_art: string | null
  ausz: Ausz | null
}

export type Konto = {
  preis: number | null
  rhythmus: string
  aktivierung: number
  reset: number | null
  phasen: Phase[]
  perp: boolean
  reset_setzt_abo_zurueck: boolean
  perp_kommission_bp_rt: number | null
  angebot_status: string
  tageswechsel_et: string | null
  fixkosten: [string, number, boolean][]
  auszahlung_gebuehr: number | null
  bot_eignung: string
  ko_kriterien: [string, string, string][]
  verbote_codes: string[]
  rechenvariante: string
  variante_art: string
}

export type Groesse = {
  art: 'risiko_usd' | 'kontrakte' | 'anteil_start' | 'dd_anteil'
  wert: number
  wert_funded: number | null
  ganzzahlig: boolean | null // null = automatisch: Futures ganze Kontrakte, Perps stufenlos
  abstand_puffer_usd: number | null
  abstand_anteil: number | null
  dll_puffer_usd: number | null
  max_trades_tag: number | null
  eine_position: boolean
  nach_ziel_stoppen: boolean
}

export type PerpKosten = { spread_pt: number; funding_pa: number; kommission_bp_rt: number | null }

export type Optionen = {
  mae_modus: 'gemessen' | 'konservativ' | 'realisiert'
  mfe_modus: 'gemessen' | 'realisiert'
  ziel_pruefung: 'tagesende' | 'sofort'
  glattstell_slip_pt: number
  perp: PerpKosten | null
  perp_immer: boolean
  hebel_kappe: boolean
  inaktivitaet: 'aus' | 'keepalive' | 'bruch'
  keepalive_usd: number
  bot_betrieb: boolean
  auszahlungsgebuehr: boolean
}

export type Politik = {
  name: 'A' | 'B' | 'C' | 'M'
  puffer_ziel_usd: number | null
  wechsel_puffer_usd: number | null
  raster_tage: number | null
  nur_ueber_start: boolean
}

export type Auszahlung = { i: number; brutto: number; netto: number; nr: number; phase: string }

export type VersuchErgebnis = {
  start: number
  ende: number
  status: 'offen' | 'bruch' | 'bestanden_ohne_funded' | 'live' | 'geschlossen'
  grund: string | null
  bruch_phase: string | null
  pass_i: number | null
  funded_i: number | null
  live_i: number | null
  auszahlungen: Auszahlung[]
  cons_hebt: boolean
  cons_ausz_sperren: number
  end_saldo: number
  end_boden: number | null
  end_phase: string
  ueberlappt: number
  keepalive: number
  kum_lebenszeit: [number, number]
}

export type Fluss = [number, number, string]

export type KampagneErgebnis = {
  start: number
  netto: number
  ertrag: number
  gebuehren: number
  einsatz: number
  monate_gewinnschwelle: number | null
  n_auszahlungen: number
  n_kauf: number
  n_reset: number
  n_bruch_eval: number
  n_bruch_funded: number
  n_live: number
  n_geschlossen: number
  n_keepalive: number
  n_ueberlappt: number
  fixkosten: number
  erste_ausz_tage: number | null
  erste_ausz_htage: number | null
  monate: number
  fluss: Fluss[]
  erster: VersuchErgebnis // erster Kauf ab dem Starttag (= Einzelkauf mit demselben Horizont)
}

export class NichtSimulierbar extends Error {}

// ------------------------------------------------------------------------------------------------- Standardwerte
export const PERP_STANDARD: PerpKosten = { spread_pt: 0.5, funding_pa: 0.1, kommission_bp_rt: null }

export function groesse(teil: Partial<Groesse> = {}): Groesse {
  return {
    art: 'risiko_usd', wert: 300, wert_funded: null, ganzzahlig: null, abstand_puffer_usd: null, abstand_anteil: null,
    dll_puffer_usd: null, max_trades_tag: null, eine_position: true, nach_ziel_stoppen: true, ...teil,
  }
}

export function optionen(teil: Partial<Optionen> = {}): Optionen {
  return {
    mae_modus: 'gemessen', mfe_modus: 'gemessen', ziel_pruefung: 'tagesende', glattstell_slip_pt: 0.5, perp: null,
    perp_immer: false, hebel_kappe: true, inaktivitaet: 'keepalive', keepalive_usd: 3.0, bot_betrieb: true,
    auszahlungsgebuehr: true, ...teil,
  }
}

export function politik(teil: Partial<Politik> = {}): Politik {
  return { name: 'A', puffer_ziel_usd: null, wechsel_puffer_usd: null, raster_tage: null, nur_ueber_start: true, ...teil }
}

type Roh = Record<string, unknown>
const n = (x: unknown): number | null => (x === undefined || x === null ? null : (x as number))
const s = (x: unknown): string | null => (x === undefined || x === null ? null : (x as string))

/** Normalisierte Regeln aus der Daten-Datei (fehlende Felder = Standardwerte der Referenz). */
export function kontoAusDaten(r: Roh): Konto {
  const phasen = ((r.phasen as Roh[]) || []).map((p): Phase => {
    const a = p.ausz as Roh | undefined
    return {
      typ: p.typ as Phase['typ'], stufe: n(p.stufe) ?? 1, start: n(p.start) ?? 0, ziel: n(p.ziel),
      dd_art: s(p.dd_art) ?? 'keiner', dd_betrag: n(p.dd_betrag), boden0: n(p.boden0), lock: n(p.lock),
      bruch_basis: s(p.bruch_basis) ?? 'equity_intraday', nach_ausz: s(p.nach_ausz), nach_ausz_boden: n(p.nach_ausz_boden),
      dll_betrag: n(p.dll_betrag), dll_anteil: n(p.dll_anteil), dll_bezug: s(p.dll_bezug),
      dll_anteil_bezug: s(p.dll_anteil_bezug), dll_wirkung: s(p.dll_wirkung),
      dll_stufen: (p.dll_stufen as [number, number][] | undefined) ?? null, cons_anteil: n(p.cons_anteil),
      cons_wirkung: s(p.cons_wirkung), min_tage: n(p.min_tage), max_tage: n(p.max_tage), max_micro: n(p.max_micro),
      max_mini: n(p.max_mini), skalierung: (p.skalierung as Phase['skalierung'] | undefined) ?? null, hebel: n(p.hebel),
      inaktiv_tage: n(p.inaktiv_tage), inaktiv_art: s(p.inaktiv_art),
      ausz: a
        ? {
            split: n(a.split) ?? 0, split_stufen: (a.split_stufen as Ausz['split_stufen'] | undefined) ?? null,
            gewinntage: n(a.gewinntage), min_tagesgewinn: n(a.min_tagesgewinn), tagesgewinn_strikt: Boolean(a.tagesgewinn_strikt),
            handelstage: n(a.handelstage), kalendertage: n(a.kalendertage), erste_ab_tag: n(a.erste_ab_tag),
            min_saldo: n(a.min_saldo), puffer: n(a.puffer), puffer_bezug: s(a.puffer_bezug),
            max_betrag: (a.max_betrag as number[] | undefined) ?? null, max_anteil: n(a.max_anteil),
            max_anteil_bezug: s(a.max_anteil_bezug) ?? 'saldo_ueber_start', min_betrag: n(a.min_betrag) ?? 0,
            cons_anteil: (a.cons_anteil as number[] | undefined) ?? null,
            cons_zeitraum: s(a.cons_zeitraum) ?? 'seit_letzter_auszahlung', zyklus_ziel: (a.zyklus_ziel as number[] | undefined) ?? null,
            gewinn_positiv: Boolean(a.gewinn_positiv), antragstag_aus: Boolean(a.antragstag_aus), max_anzahl: n(a.max_anzahl),
            max_summe_brutto: n(a.max_summe_brutto), ende_nach_max: s(a.ende_nach_max) ?? 'live',
            lebenszeit_deckel: n(a.lebenszeit_deckel), lebenszeit_basis: s(a.lebenszeit_basis) ?? 'brutto',
          }
        : null,
    }
  })
  return {
    preis: n(r.preis), rhythmus: s(r.rhythmus) ?? 'einmalig', aktivierung: n(r.aktivierung) ?? 0, reset: n(r.reset),
    phasen, perp: Boolean(r.perp), reset_setzt_abo_zurueck: Boolean(r.reset_setzt_abo_zurueck),
    perp_kommission_bp_rt: n(r.perp_kommission_bp_rt), angebot_status: s(r.angebot_status) ?? 'unklar',
    tageswechsel_et: s(r.tageswechsel_et), fixkosten: (r.fixkosten as Konto['fixkosten'] | undefined) ?? [],
    auszahlung_gebuehr: n(r.auszahlung_gebuehr), bot_eignung: s(r.bot_eignung) ?? 'unklar',
    ko_kriterien: (r.ko_kriterien as Konto['ko_kriterien'] | undefined) ?? [],
    verbote_codes: (r.verbote_codes as string[] | undefined) ?? [], rechenvariante: s(r.rechenvariante) ?? 'standard',
    variante_art: s(r.variante_art) ?? 'standard',
  }
}

/** Variante: Änderungen [pfad, wert] auf eine Kopie der Regeln anwenden (Pfade wie 'phasen[1].ausz.puffer'). */
export function wendeAenderungenAn(regeln: Roh, aenderungen: [string, unknown][]): Roh {
  const kopie = JSON.parse(JSON.stringify(regeln)) as Roh
  for (const [pfad, wert] of aenderungen) {
    const teile = pfad.match(/[^.[\]]+|\[\d+\]/g) || []
    let obj: Record<string, unknown> | unknown[] = kopie
    teile.forEach((t, i) => {
      const letzt = i === teile.length - 1
      const key: string | number = t.startsWith('[') ? Number(t.slice(1, -1)) : t
      const o = obj as Record<string | number, unknown>
      if (letzt) o[key] = wert
      else {
        if (o[key] === undefined || o[key] === null) o[key] = {}
        obj = o[key] as Record<string, unknown>
      }
    })
  }
  return kopie
}

// ------------------------------------------------------------------------------------------------- Hilfen
/** Python-Gleitkomma-Ganzzahldivision `a // b` (CPython float_floor_div), für exakte Kontraktzahlen. */
export function pyFloorDiv(a: number, b: number): number {
  let mod = a % b
  let div = (a - mod) / b
  if (mod) {
    if (b < 0 !== mod < 0) {
      mod += b
      div -= 1.0
    }
  }
  if (div) {
    let fl = Math.floor(div)
    if (div - fl > 0.5) fl += 1.0
    return fl
  }
  return 0 * (a / b)
}

/** numpy.searchsorted(arr, x, side='right'). */
export function searchsortedRechts(arr: number[], x: number): number {
  let lo = 0
  let hi = arr.length
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (arr[mid] <= x) lo = mid + 1
    else hi = mid
  }
  return lo
}

/** ET-Minute -> Minute ab 18:00 ET. */
export function eth(m: number): number {
  return (((m - 1080) % 1440) + 1440) % 1440
}

/** Quantil wie numpy.quantile (Methode 'linear'); nicht endliche Werte fallen weg, leere Liste -> null. */
export function quantil(werte: ArrayLike<number | null>, p: number): number | null {
  const x = (Array.from(werte).filter((v) => v !== null && Number.isFinite(v)) as number[]).sort((a, b) => a - b)
  const n = x.length
  if (!n) return null
  const vi = n * p + (1 + p * -1) - 1
  let lo = Math.floor(vi)
  let hi = lo + 1
  if (vi >= n - 1) lo = hi = n - 1
  else if (vi < 0) lo = hi = 0
  const t = vi - Math.floor(vi)
  const a = x[lo]
  const b = x[hi]
  const d = b - a
  return t >= 0.5 ? b - d * (1 - t) : a + d * t
}

// ------------------------------------------------------------------------------------------------- Engine
type Zustand = {
  ph: Phase
  ph_i: number
  start_i: number
  saldo: number
  boden: number | null
  hwm: number
  eingefroren: boolean
  beste_tag: number
  handelstage: number
  tag_pnl: number
  tag_start: number
  tag_trades: number
  gesperrt: boolean
  ziel_heute: boolean
  letzter_aus: number | null
  kap_mini: number | null
  kap_micro: number | null
  letzter_trade_uhr: number
  akt_woche: number
  start_woche: number
  woche_trade: boolean
  z_gewinntage: number
  z_handelstage: number
  z_bester: number
  z_start_saldo: number
  z_start_uhr: number
  naechster_zaehlt_nicht: boolean
  n_ausz: number
  summe_brutto: number
  raster_naechst: number | null
  politik_b: boolean
  cons_basis_erreicht_i: number | null
}

function kappe(ph: Phase, instrument: string, saldoVor: number): number | null {
  let mini = ph.max_mini
  let micro = ph.max_micro
  if (ph.skalierung && ph.skalierung.length) {
    const ueber = saldoVor - ph.start
    for (const [ab, smini, smicro] of ph.skalierung) {
      if (ueber + EPS >= ab) {
        mini = smini
        micro = smicro
      }
    }
    if (ueber + EPS < ph.skalierung[0][0]) {
      mini = ph.skalierung[0][1]
      micro = ph.skalierung[0][2]
    }
  }
  if (instrument === 'micro') {
    if (micro !== null) return micro
    return mini !== null ? mini * 10 : null
  }
  if (instrument === 'mini') {
    if (mini !== null) return mini
    return micro !== null ? Math.floor(micro / 10) : null
  }
  return null
}

function dllUsd(z: Zustand): number | null {
  const ph = z.ph
  if (ph.dll_betrag === null && ph.dll_anteil === null) return null
  let base: number
  if (ph.dll_anteil !== null && ph.dll_anteil_bezug === 'tagesbeginn') base = ph.dll_anteil * z.tag_start
  else if (ph.dll_betrag !== null) base = ph.dll_betrag
  else if (ph.dll_anteil_bezug === 'start' || ph.dll_bezug === 'start') base = (ph.dll_anteil as number) * ph.start
  else base = (ph.dll_anteil as number) * z.tag_start
  if (ph.dll_stufen && ph.dll_stufen.length) {
    for (const [ab, b] of ph.dll_stufen) {
      if (z.tag_start + EPS >= ab) base = b
    }
  }
  return base
}

function neuePhase(konto: Konto, j: number, i: number, uhr: number, strom: Strom): Zustand {
  const ph = konto.phasen[j]
  const boden = ph.dd_art !== 'keiner' ? ph.boden0 : null
  const z: Zustand = {
    ph, ph_i: j, start_i: i, saldo: ph.start, boden, hwm: ph.start, eingefroren: false, beste_tag: 0, handelstage: 0,
    tag_pnl: 0, tag_start: 0, tag_trades: 0, gesperrt: false, ziel_heute: false, letzter_aus: null, kap_mini: null,
    kap_micro: null, letzter_trade_uhr: uhr, akt_woche: strom.woche[i], start_woche: strom.woche[i], woche_trade: false,
    z_gewinntage: 0, z_handelstage: 0, z_bester: 0, z_start_saldo: ph.start, z_start_uhr: uhr,
    naechster_zaehlt_nicht: false, n_ausz: 0, summe_brutto: 0, raster_naechst: null, politik_b: false,
    cons_basis_erreicht_i: null,
  }
  z.kap_micro = kappe(ph, 'micro', ph.start)
  z.kap_mini = kappe(ph, 'mini', ph.start)
  if (ph.lock !== null && boden !== null && boden >= ph.lock - EPS) z.eingefroren = true
  return z
}

function trail(z: Zustand, hoch: number) {
  const ph = z.ph
  if (z.eingefroren || (ph.dd_art !== 'eod_trailing' && ph.dd_art !== 'intraday_trailing')) return
  z.hwm = Math.max(z.hwm, hoch)
  let neu = Math.max(z.boden as number, z.hwm - (ph.dd_betrag as number))
  if (ph.lock !== null && neu >= ph.lock - EPS) {
    neu = Math.max(z.boden as number, ph.lock)
    z.eingefroren = true
  }
  z.boden = neu
}

function zielErfuellt(z: Zustand): [boolean, boolean] {
  const ph = z.ph
  const gewinn = z.saldo - ph.start
  if (gewinn + EPS < (ph.ziel as number)) return [false, false]
  const bester = Math.max(z.beste_tag, z.tag_pnl)
  if (ph.cons_anteil && (ph.cons_wirkung === 'ziel_steigt' || ph.cons_wirkung === 'nicht_bestanden_bis_erfuellt')) {
    if (bester > ph.cons_anteil * gewinn + EPS) return [false, true]
  }
  return [true, false]
}

function einheiten(z: Zustand, tr: Trade, strom: Strom, g: Groesse, opt: Optionen, dll: number | null): number {
  const ph = z.ph
  const wert = ph.typ === 'eval' || g.wert_funded === null ? g.wert : g.wert_funded
  const ganz = g.ganzzahlig !== null ? g.ganzzahlig : strom.instrument !== 'perp'
  let m: number
  if (g.art === 'kontrakte') m = wert
  else {
    let budget: number
    if (g.art === 'risiko_usd') budget = wert
    else if (g.art === 'dd_anteil') budget = wert * (ph.dd_betrag || 0.0)
    else budget = wert * ph.start
    if (g.abstand_puffer_usd !== null && z.boden !== null) budget = Math.min(budget, z.saldo - z.boden - g.abstand_puffer_usd)
    if (g.abstand_anteil && z.boden !== null) budget = Math.min(budget, g.abstand_anteil * (z.saldo - z.boden))
    if (g.dll_puffer_usd !== null && dll !== null) budget = Math.min(budget, dll + Math.min(0.0, z.tag_pnl) - g.dll_puffer_usd)
    if (budget <= 0) return 0.0
    m = ganz ? pyFloorDiv(budget, tr.risiko_e) : budget / tr.risiko_e
  }
  const kap = strom.instrument === 'micro' ? z.kap_micro : strom.instrument === 'mini' ? z.kap_mini : null
  if (kap !== null) m = Math.min(m, kap)
  if (opt.hebel_kappe && ph.hebel && tr.kurs && tr.punktwert_e) m = Math.min(m, (ph.hebel * ph.start) / (tr.punktwert_e * tr.kurs))
  return Math.max(m, 0.0)
}

export function perpKostenE(tr: Trade, pk: PerpKosten, bpJson: number | null): number {
  if (tr.punktwert_e === null) throw new NichtSimulierbar('Perp-Kosten brauchen punktwert_e')
  let k = pk.spread_pt * tr.punktwert_e
  if (pk.funding_pa && tr.kurs && tr.stunden) k += (((tr.kurs * tr.punktwert_e) * pk.funding_pa) * tr.stunden) / 8760.0
  const bp = pk.kommission_bp_rt !== null ? pk.kommission_bp_rt : bpJson || 0.0
  if (bp && tr.kurs) k += ((tr.kurs * tr.punktwert_e) * bp) / 1e4
  return k
}

function bodenNach(z: Zustand): number | null {
  const ph = z.ph
  if (ph.nach_ausz === 'boden_auf_start') return ph.start
  if (ph.nach_ausz === 'boden_auf_wert' && ph.nach_ausz_boden !== null) {
    return z.boden !== null ? Math.max(ph.nach_ausz_boden, z.boden) : ph.nach_ausz_boden
  }
  return z.boden
}

function auszahlungBetrag(z: Zustand, uhrT: number, pol: Politik, sperren: { n: number }, restLebenszeit: number): number {
  const ph = z.ph
  const a = ph.ausz
  if (a === null) return 0.0
  if (a.max_anzahl !== null && z.n_ausz >= a.max_anzahl) return 0.0
  if (a.erste_ab_tag !== null && z.n_ausz === 0 && uhrT - z.z_start_uhr < a.erste_ab_tag - EPS) return 0.0
  if (a.kalendertage !== null && uhrT - z.z_start_uhr < a.kalendertage - EPS) return 0.0
  if (pol.raster_tage !== null) {
    if (z.raster_naechst === null || uhrT < z.raster_naechst - EPS) return 0.0
  }
  if (a.gewinntage !== null && z.z_gewinntage < a.gewinntage) return 0.0
  if (a.handelstage !== null && z.z_handelstage < a.handelstage) return 0.0
  const gewinnZyklus = z.saldo - z.z_start_saldo
  if (a.gewinn_positiv && gewinnZyklus <= EPS) return 0.0
  if (a.zyklus_ziel && a.zyklus_ziel.length && gewinnZyklus + EPS < a.zyklus_ziel[Math.min(z.n_ausz, a.zyklus_ziel.length - 1)]) return 0.0
  if (a.min_saldo !== null && z.saldo + EPS < a.min_saldo) return 0.0
  let unten = pol.nur_ueber_start ? ph.start : z.boden !== null ? z.boden : ph.start
  if (a.puffer !== null) unten = Math.max(unten, (a.puffer_bezug === 'boden' && z.boden !== null ? z.boden : ph.start) + a.puffer)
  let betrag = z.saldo - unten
  if (a.max_anteil !== null) {
    const bez = a.max_anteil_bezug === 'saldo_ueber_start' ? z.saldo - ph.start : gewinnZyklus
    betrag = Math.min(betrag, a.max_anteil * bez)
  }
  if (a.max_betrag && a.max_betrag.length) betrag = Math.min(betrag, a.max_betrag[Math.min(z.n_ausz, a.max_betrag.length - 1)])
  const bn = bodenNach(z)
  if (bn !== null) betrag = Math.min(betrag, z.saldo - bn) // eine Auszahlung bricht das Konto nie selbst
  if (pol.name === 'B' || (pol.name === 'C' && z.politik_b)) {
    betrag = Math.min(betrag, z.saldo - ((bn !== null ? bn : ph.start) + (pol.puffer_ziel_usd as number)))
  }
  betrag = Math.min(betrag, restLebenszeit)
  if (betrag + EPS < Math.max(a.min_betrag, 0.01)) return 0.0
  if (a.cons_anteil !== null) {
    const bez = a.cons_zeitraum === 'seit_letzter_auszahlung' ? gewinnZyklus : z.saldo - ph.start
    const anteil = a.cons_anteil[Math.min(z.n_ausz, a.cons_anteil.length - 1)]
    if (z.z_bester > anteil * bez + EPS) {
      sperren.n += 1
      return 0.0
    }
  }
  return betrag
}

function nettoSplit(a: Ausz, brutto: number, kumuliert: number): number {
  if (!a.split_stufen || !a.split_stufen.length) return a.split * brutto
  let netto = 0.0
  let rest = brutto
  let k = kumuliert
  for (const [bisRoh, sp] of a.split_stufen) {
    const bis = bisRoh === null ? Infinity : bisRoh
    if (rest <= 0) break
    const teil = Math.min(rest, Math.max(0.0, bis - k))
    netto += teil * sp
    rest -= teil
    k += teil
  }
  return netto + rest * a.split_stufen[a.split_stufen.length - 1][1]
}

function inaktivFaellig(z: Zustand, strom: Strom, t: number, e: number): boolean {
  const ph = z.ph
  if (ph.inaktiv_tage === null && ph.inaktiv_art !== 'kalenderwoche') return false
  if (z.tag_trades > 0 || t >= e) return false
  if (ph.inaktiv_art === 'kalenderwoche') {
    const woche = strom.woche[t]
    const endeWoche = strom.woche[t + 1] !== woche
    return endeWoche && !z.woche_trade && woche !== z.start_woche
  }
  return strom.uhr[t + 1] - z.letzter_trade_uhr > (ph.inaktiv_tage as number) + EPS
}

/** Prüft, ob der Strom zum Kontotyp passt (MAE/MFE, Handelstag-Grenze, Tagesgrenze der Firma). */
export function pruefeStrom(konto: Konto, strom: Strom, opt: Optionen): void {
  const grenze = konto.tageswechsel_et === '20:00' ? eth(20 * 60) : konto.tageswechsel_et === '00:00' ? eth(0) : null
  const intraday = konto.phasen.some((p) => p.dd_art === 'intraday_trailing')
  for (const tag of strom.tage) {
    for (const t of tag) {
      if (opt.mae_modus === 'gemessen' && t.mae_e === null) throw new NichtSimulierbar('MAE fehlt im Strom')
      if (opt.mfe_modus === 'gemessen' && intraday && t.mfe_e === null) throw new NichtSimulierbar('MFE fehlt im Strom')
      if (t.aus < t.ein) throw new NichtSimulierbar('Trade über die Handelstag-Grenze')
      if (grenze !== null && t.ein < grenze) throw new NichtSimulierbar(`Tagesgrenze ${konto.tageswechsel_et} ET`)
      if ((konto.perp || opt.perp_immer) && opt.perp !== null && t.punktwert_e === null) throw new NichtSimulierbar('Perp-Kosten brauchen punktwert_e')
    }
  }
}

/** Ein Kauf ab Handelstag s bis einschließlich e (Indizes). kumStart = bisherige Auszahlungen (brutto, netto). */
export function versuch(
  konto: Konto, strom: Strom, s0: number, e: number, g: Groesse, opt: Optionen, pol: Politik,
  kumStart: [number, number] = [0.0, 0.0],
): VersuchErgebnis {
  const uhr = strom.uhr
  let z = neuePhase(konto, 0, s0, uhr[s0], strom)
  if ((z.ph.typ === 'funded' || z.ph.typ === 'live') && pol.raster_tage) z.raster_naechst = uhr[s0] + pol.raster_tage
  const ausz: Auszahlung[] = []
  const sperren = { n: 0 }
  let status: VersuchErgebnis['status'] = 'offen'
  let grund: string | null = null
  let endeI = e
  let passI: number | null = null
  let fundedI: number | null = null
  let liveI: number | null = null
  let consHebt = false
  let kumBrutto = 0.0
  let kumLBrutto = kumStart[0]
  let kumLNetto = kumStart[1]
  let wartend: number | null = null
  const perp = konto.perp || opt.perp_immer ? opt.perp : null
  let nUeberlappt = 0
  let nKeepalive = 0
  for (let t = s0; t <= e; t++) {
    if (wartend !== null) {
      z = neuePhase(konto, wartend, t, uhr[t], strom)
      if ((z.ph.typ === 'funded' || z.ph.typ === 'live') && z.ph.ausz !== null) {
        z.raster_naechst = pol.raster_tage ? uhr[t] + pol.raster_tage : null
      }
      wartend = null
    }
    const ph = z.ph
    const basisRealisiert = ph.bruch_basis !== 'equity_intraday'
    z.tag_pnl = 0.0
    z.tag_start = z.saldo
    z.tag_trades = 0
    z.gesperrt = false
    z.ziel_heute = false
    z.letzter_aus = null
    const w = strom.woche[t]
    if (w !== z.akt_woche) {
      z.akt_woche = w
      z.woche_trade = false
    }
    const dll = dllUsd(z)
    let tot = false
    for (const tr of strom.tage[t]) {
      if (z.gesperrt || (g.max_trades_tag !== null && z.tag_trades >= g.max_trades_tag)) break
      if (ph.typ === 'eval' && z.ziel_heute && g.nach_ziel_stoppen) break
      if (g.eine_position && z.letzter_aus !== null && tr.ein < z.letzter_aus) {
        nUeberlappt += 1
        continue
      }
      const m = einheiten(z, tr, strom, g, opt, dll)
      if (m <= 0) continue
      const pnlE = tr.pnl_e - (perp ? perpKostenE(tr, perp, konto.perp_kommission_bp_rt) : 0.0)
      const pnl = pnlE * m
      let mae: number
      if (opt.mae_modus === 'gemessen') {
        if (tr.mae_e === null) throw new NichtSimulierbar('MAE fehlt')
        mae = tr.mae_e * m
      } else if (opt.mae_modus === 'konservativ') mae = tr.ist_stop ? 0.0 : tr.stop_e * m
      else mae = 0.0
      let mfe: number
      if (opt.mfe_modus === 'gemessen' && tr.mfe_e !== null) mfe = tr.mfe_e * m
      else if (opt.mfe_modus === 'gemessen' && ph.dd_art === 'intraday_trailing') throw new NichtSimulierbar('MFE fehlt bei intraday-trailing')
      else mfe = Math.max(pnl, 0.0)
      if (ph.dd_art === 'intraday_trailing') trail(z, z.saldo + mfe) // V1: erst Hochpunkt, dann Tief
      const nachher = z.saldo + pnl
      const tief = basisRealisiert ? nachher : Math.min(z.saldo - mae, nachher)
      const ddLv = z.boden !== null ? z.boden : -Infinity
      const dllLv = dll !== null ? z.tag_start - dll : -Infinity
      const hitDd = tief <= ddLv + EPS
      const hitDll = tief <= dllLv + EPS
      if (hitDd || hitDll) {
        let zuerst: 'dd' | 'dll'
        if (basisRealisiert) zuerst = hitDd ? 'dd' : 'dll'
        else zuerst = hitDd && (!hitDll || ddLv >= dllLv) ? 'dd' : 'dll'
        if (zuerst === 'dd' || ph.dll_wirkung === 'konto_verloren') {
          z.saldo = basisRealisiert ? nachher : zuerst === 'dd' ? ddLv : dllLv
          status = 'bruch'
          grund = zuerst === 'dd' ? 'dd' : 'dll'
          endeI = t
          tot = true
          break
        }
        if (basisRealisiert) {
          z.saldo = nachher
          z.tag_pnl += pnl
        } else {
          z.saldo = dllLv - opt.glattstell_slip_pt * (tr.punktwert_e || 0.0) * m
          z.tag_pnl = z.saldo - z.tag_start
        }
        z.tag_trades += 1
        z.gesperrt = true
        z.letzter_trade_uhr = uhr[t]
        z.woche_trade = true
        if (z.boden !== null && z.saldo <= z.boden + EPS) {
          status = 'bruch'
          grund = 'dd'
          endeI = t
          tot = true
          break
        }
        continue
      }
      z.saldo = nachher
      z.tag_pnl += pnl
      z.tag_trades += 1
      z.letzter_aus = tr.aus
      z.letzter_trade_uhr = uhr[t]
      z.woche_trade = true
      if (ph.dd_art === 'intraday_trailing') trail(z, z.saldo)
      if (ph.typ === 'eval') {
        const [ok, hebt] = zielErfuellt(z)
        if (hebt && z.cons_basis_erreicht_i === null) z.cons_basis_erreicht_i = t
        if (ok) {
          z.ziel_heute = true
          if (opt.ziel_pruefung === 'sofort' && (ph.min_tage === null || z.handelstage + 1 >= ph.min_tage)) break
        }
      }
    }
    if (tot) break
    // Inaktivität
    let schliessen = false
    if (opt.inaktivitaet !== 'aus' && inaktivFaellig(z, strom, t, e)) {
      if (opt.inaktivitaet === 'keepalive') {
        z.saldo -= opt.keepalive_usd
        z.tag_pnl -= opt.keepalive_usd
        z.tag_trades += 1
        z.letzter_trade_uhr = uhr[t]
        z.woche_trade = true
        nKeepalive += 1
        if (z.boden !== null && z.saldo <= z.boden + EPS) {
          status = 'bruch'
          grund = 'dd'
          endeI = t
          break
        }
      } else schliessen = true
    }
    // Tagesende
    if (z.tag_trades > 0) z.handelstage += 1
    if (ph.dd_art === 'eod_trailing') trail(z, z.saldo)
    if (ph.typ === 'eval') {
      z.beste_tag = Math.max(z.beste_tag, z.tag_pnl)
      const [ok, hebt] = zielErfuellt(z)
      if (hebt && z.cons_basis_erreicht_i === null) z.cons_basis_erreicht_i = t
      if (ok && (ph.min_tage === null || z.handelstage >= ph.min_tage)) {
        if (z.cons_basis_erreicht_i !== null) consHebt = true
        const nxt = z.ph_i + 1
        if (nxt < konto.phasen.length && konto.phasen[nxt].typ === 'eval') wartend = nxt
        else {
          passI = t
          if (nxt < konto.phasen.length) {
            wartend = nxt
            fundedI = t + 1 <= e ? t + 1 : null
          } else {
            status = 'bestanden_ohne_funded'
            endeI = t
            break
          }
        }
        continue
      }
      if (ph.max_tage !== null && uhr[t] - uhr[z.start_i] + 1 > ph.max_tage + EPS) {
        status = 'bruch'
        grund = 'zeitlimit'
        endeI = t
        break
      }
    } else {
      if (z.tag_trades > 0) {
        if (z.naechster_zaehlt_nicht) z.naechster_zaehlt_nicht = false
        else {
          z.z_handelstage += 1
          if (ph.ausz !== null && ph.ausz.min_tagesgewinn !== null) {
            const zaehlt = ph.ausz.tagesgewinn_strikt
              ? z.tag_pnl > ph.ausz.min_tagesgewinn + EPS
              : z.tag_pnl + EPS >= ph.ausz.min_tagesgewinn
            if (zaehlt) z.z_gewinntage += 1
          } else if (z.tag_pnl > EPS) z.z_gewinntage += 1
          z.z_bester = Math.max(z.z_bester, z.tag_pnl)
        }
      }
      if (pol.name === 'C' && !z.politik_b) {
        const bn = bodenNach(z)
        if (bn !== null && z.saldo - bn + EPS >= (pol.wechsel_puffer_usd as number)) z.politik_b = true
      }
      const a = ph.ausz
      let rest = Infinity
      if (a !== null && a.lebenszeit_deckel !== null) {
        rest = a.lebenszeit_basis === 'brutto' ? a.lebenszeit_deckel - kumLBrutto : (a.lebenszeit_deckel - kumLNetto) / Math.max(a.split, EPS)
        rest = Math.max(rest, 0.0)
      }
      const betrag = auszahlungBetrag(z, uhr[t], pol, sperren, rest)
      if (pol.raster_tage !== null && z.raster_naechst !== null && uhr[t] >= z.raster_naechst - EPS) {
        const schritte = Math.max(1, Math.ceil((uhr[t] - z.raster_naechst + EPS) / pol.raster_tage))
        z.raster_naechst += schritte * pol.raster_tage
      }
      if (betrag > 0 && a !== null) {
        const netto = nettoSplit(a, betrag, kumBrutto)
        const bn = bodenNach(z)
        kumBrutto += betrag
        kumLBrutto += betrag
        kumLNetto += netto
        z.saldo -= betrag
        z.n_ausz += 1
        z.summe_brutto += betrag
        ausz.push({ i: t, brutto: betrag, netto, nr: z.n_ausz, phase: ph.typ })
        if (ph.nach_ausz === 'boden_auf_start' || ph.nach_ausz === 'boden_auf_wert') {
          z.boden = bn
          z.eingefroren = true
        }
        z.z_gewinntage = 0
        z.z_handelstage = 0
        z.z_bester = 0.0
        z.z_start_saldo = z.saldo
        z.z_start_uhr = uhr[t]
        z.naechster_zaehlt_nicht = a.antragstag_aus
        const endeMax =
          (a.max_anzahl !== null && z.n_ausz >= a.max_anzahl) ||
          (a.max_summe_brutto !== null && z.summe_brutto + EPS >= a.max_summe_brutto)
        if (endeMax) {
          const nxt = z.ph_i + 1
          if (a.ende_nach_max === 'geschlossen') {
            status = 'geschlossen'
            endeI = t
            break
          }
          if (nxt < konto.phasen.length) {
            wartend = nxt
            liveI = t + 1
          } else {
            status = 'live'
            endeI = t
            liveI = t
            break
          }
        }
      }
      if (ph.max_tage !== null && uhr[t] - uhr[z.start_i] + 1 > ph.max_tage + EPS) {
        status = 'bruch'
        grund = 'zeitlimit'
        endeI = t
        break
      }
    }
    if (schliessen) {
      status = 'bruch'
      grund = 'inaktivitaet'
      endeI = t
      break
    }
    z.kap_micro = kappe(ph, 'micro', z.saldo)
    z.kap_mini = kappe(ph, 'mini', z.saldo)
  }
  return {
    start: s0, ende: endeI, status, grund, bruch_phase: status === 'bruch' ? z.ph.typ : null, pass_i: passI,
    funded_i: fundedI, live_i: liveI, auszahlungen: ausz, cons_hebt: consHebt, cons_ausz_sperren: sperren.n,
    end_saldo: z.saldo, end_boden: z.boden, end_phase: z.ph.typ, ueberlappt: nUeberlappt, keepalive: nKeepalive,
    kum_lebenszeit: [kumLBrutto, kumLNetto],
  }
}

/** Ein Konto-Platz ab Handelstag s für `horizontTage` Kalendertage: Neukauf/Reset, alle Gebühren, Auszahlungen netto. */
export function kampagne(
  konto: Konto, strom: Strom, s0: number, horizontTage: number, g: Groesse, opt: Optionen, pol: Politik,
): KampagneErgebnis {
  if (konto.preis === null) throw new NichtSimulierbar('Preis unbekannt')
  const preis = konto.preis
  const uhr = strom.uhr
  const endeUhr = uhr[s0] + horizontTage
  const e = searchsortedRechts(uhr, endeUhr) - 1
  const fluss: Fluss[] = []
  let t = s0
  let neukauf = true
  let aboBis: number | null = null
  let nKauf = 0, nReset = 0, nBruchEval = 0, nBruchFunded = 0, nLive = 0, nGeschlossen = 0, nKeep = 0, nUeb = 0
  let ersteAuszI: number | null = null
  let kum: [number, number] = [0.0, 0.0]
  let erster: VersuchErgebnis | null = null
  for (const [, usd, nurBot] of konto.fixkosten) {
    if (usd && (opt.bot_betrieb || !nurBot)) {
      let k = 0
      while (k * MONAT < horizontTage - EPS) {
        fluss.push([uhr[s0] + k * MONAT, -usd, 'fixkosten'])
        k += 1
      }
    }
  }
  while (t <= e) {
    if (neukauf) {
      fluss.push([uhr[t], -preis, 'kauf'])
      nKauf += 1
      aboBis = konto.rhythmus === 'monatlich' ? uhr[t] + 30.0 : null
    }
    const v = versuch(konto, strom, t, e, g, opt, pol, kum)
    if (erster === null) erster = v
    kum = v.kum_lebenszeit
    nKeep += v.keepalive
    nUeb += v.ueberlappt
    if (aboBis !== null) {
      const evalEnde = v.pass_i !== null ? v.pass_i : v.ende
      while (aboBis <= uhr[evalEnde] + EPS && aboBis <= endeUhr + EPS) {
        fluss.push([aboBis, -preis, 'abo'])
        aboBis += 30.0
      }
      if (v.pass_i !== null) aboBis = null
    }
    if (v.funded_i !== null && konto.aktivierung) fluss.push([uhr[Math.min(v.funded_i, e)], -konto.aktivierung, 'aktivierung'])
    for (const a of v.auszahlungen) {
      fluss.push([uhr[a.i], a.netto, 'auszahlung'])
      if (opt.auszahlungsgebuehr && konto.auszahlung_gebuehr) fluss.push([uhr[a.i], -konto.auszahlung_gebuehr, 'auszahlungsgebuehr'])
      if (ersteAuszI === null) ersteAuszI = a.i
    }
    if (v.status === 'bruch') {
      const nt = v.ende + 1
      if (v.bruch_phase === 'eval') nBruchEval += 1
      else nBruchFunded += 1
      if (nt > e) break
      if (v.bruch_phase === 'eval' && konto.reset !== null) {
        fluss.push([uhr[nt], -konto.reset, 'reset'])
        nReset += 1
        neukauf = false
        if (konto.reset_setzt_abo_zurueck && aboBis !== null) aboBis = uhr[nt] + 30.0
      } else neukauf = true
      t = nt
      continue
    }
    if (v.status === 'live' || v.status === 'bestanden_ohne_funded' || v.status === 'geschlossen') {
      if (v.status === 'geschlossen') nGeschlossen += 1
      else nLive += 1
      const nt = v.ende + 1
      if (nt > e) break
      neukauf = true
      t = nt
      continue
    }
    break
  }
  const fl = fluss.map((x, i) => [x, i] as const).sort((a, b) => a[0][0] - b[0][0] || a[1] - b[1]).map((x) => x[0])
  let cum = 0.0
  let cumMin = fl.length ? Infinity : 0.0
  let schwelle: number | null = null
  let gebuehren = 0
  let ertrag = 0
  let fix = 0
  let nAusz = 0
  for (const [u, b, art] of fl) {
    cum += b
    if (cum < cumMin) cumMin = cum
    if (schwelle === null && cum > EPS) schwelle = (u - uhr[s0]) / MONAT
  }
  for (const [, b, art] of fl) if (art !== 'auszahlung') gebuehren += b
  gebuehren = -gebuehren
  for (const [, b, art] of fl) {
    if (art === 'auszahlung') {
      ertrag += b
      nAusz += 1
    }
  }
  for (const [, b, art] of fl) if (art === 'fixkosten') fix += b
  return {
    start: s0, netto: ertrag - gebuehren, ertrag, gebuehren, einsatz: Math.max(0.0, -cumMin),
    monate_gewinnschwelle: schwelle, n_auszahlungen: nAusz, n_kauf: nKauf, n_reset: nReset, n_bruch_eval: nBruchEval,
    n_bruch_funded: nBruchFunded, n_live: nLive, n_geschlossen: nGeschlossen, n_keepalive: nKeep, n_ueberlappt: nUeb,
    fixkosten: -fix, erste_ausz_tage: ersteAuszI === null ? null : uhr[ersteAuszI] - uhr[s0],
    erste_ausz_htage: ersteAuszI === null ? null : ersteAuszI - s0 + 1, monate: horizontTage / MONAT, fluss: fl,
    erster: erster as VersuchErgebnis,
  }
}

/** Politiken je Kontotyp: A; B(p) und C(x = p) mit p = Faktor x Drawdown der ersten Funded-Phase. */
export function politikFuer(konto: Konto, art: 'A' | 'B' | 'C', faktor: number): Politik | null {
  if (art === 'A') return politik({ name: 'A' })
  const fund = konto.phasen.filter((p) => p.typ === 'funded' || p.typ === 'live')
  const dd = fund.length && fund[0].dd_betrag ? fund[0].dd_betrag : null
  if (!dd) return null
  if (art === 'B') return politik({ name: 'B', puffer_ziel_usd: faktor * dd })
  return politik({ name: 'C', puffer_ziel_usd: faktor * dd, wechsel_puffer_usd: faktor * dd })
}

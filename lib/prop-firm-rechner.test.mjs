import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { registriereTs } from './prop-firm/ts-hooks.mjs'
import { gunzipSync } from 'node:zlib'

// Prop-Firm-Rechner: Parität des TS-Kerns mit dem Python-Referenz-Simulator (Fassung 3.2.1) auf festen,
// synthetischen Trade-Strömen, dazu Generator, Simulation und Datenhygiene.
// Die TS-Module importieren einander ohne Dateiendung (wie im Next-Build); hier lösen Hooks .ts/.tsx und '@/' auf,
// .tsx übersetzt TypeScript (für den Render-Test), JSON und CSS werden als Module geladen, next/image und next/link sind schlichte <img> und <a>.
await registriereTs()

const K = await import('./prop-firm/kern.ts')
const G = await import('./prop-firm/stroeme.ts')
const SIM = await import('./prop-firm/simulation.ts')
const AUS = await import('./prop-firm/auswertung.ts')
const KON = await import('./prop-firm/konten.ts')

const lese = (pfad) => readFileSync(new URL(pfad, import.meta.url))
const datenRoh = lese('./prop-firm/daten/regeln-2026-10-09.json')
const DATEN = JSON.parse(datenRoh.toString('utf8'))
const FIX_TEXT = gunzipSync(lese('./prop-firm/paritaet/faelle.json.gz')).toString('utf8')
const FIX = JSON.parse(FIX_TEXT)

// ------------------------------------------------------------------------------------------- Aufbau aus den Fixtures
function strom(roh) {
  return {
    modus: roh.modus,
    instrument: roh.instrument,
    uhr: roh.uhr,
    woche: roh.woche,
    tage: roh.tage.map((tag) =>
      tag.map(([ein, aus, pnl_e, risiko_e, stop_e, mae_e, mfe_e, ist_stop, kurs, stop_pt, punktwert_e, stunden]) => ({
        ein, aus, pnl_e, risiko_e, stop_e, mae_e, mfe_e, ist_stop: Boolean(ist_stop), kurs, stop_pt, punktwert_e, stunden,
      })),
    ),
  }
}
const STROEME = Object.fromEntries(Object.entries(FIX.stroeme).map(([k, v]) => [k, strom(v)]))

const KONTEN = new Map()
for (const k of DATEN.konten) {
  KONTEN.set(`${k.id}|standard`, K.kontoAusDaten(k.regeln))
  for (const v of k.varianten) KONTEN.set(`${k.id}|${v.name}`, K.kontoAusDaten(K.wendeAenderungenAn(k.regeln, v.aenderungen)))
}
for (const [schl, regeln] of Object.entries(FIX.konten_eingebettet)) KONTEN.set(`${schl}|standard`, K.kontoAusDaten(regeln))

function fallParameter(f) {
  const g = K.groesse({ ...f.g })
  const o = K.optionen({ ...f.o, perp: f.o.perp ?? null })
  const [name, puffer, wechsel] = f.p
  const p = K.politik({ name, puffer_ziel_usd: puffer, wechsel_puffer_usd: wechsel })
  return { g, o, p }
}

// ------------------------------------------------------------------------------- Kennzahlen wie die Referenz
const mittel = (x) => (x.length ? x.reduce((a, b) => a + Number(b), 0) / x.length : null)

function letzterTradeIndex(st) {
  for (let i = st.tage.length - 1; i >= 0; i--) if (st.tage[i].length) return i
  return -1
}

function startsFuer(st, schritt) {
  const letzter = letzterTradeIndex(st)
  const out = []
  for (let s = 0; s < st.uhr.length; s += schritt) {
    if (s - 1 > letzter) break
    if (st.uhr[s] > st.uhr[letzter] + K.EPS) break
    out.push(s)
  }
  return out
}

function bewerteEinzel(konto, st, starts, g, o, p, horizont) {
  const letzter = letzterTradeIndex(st)
  const n = st.uhr.length
  let res = starts.map((s) => {
    const e = Math.min(K.searchsortedRechts(st.uhr, st.uhr[s] + horizont) - 1, n - 1)
    return K.versuch(konto, st, s, e, g, o, p)
  })
  const out = { starts: res.length }
  const hatEval = konto.phasen[0].typ === 'eval'
  for (const h of [30, 60, 90]) {
    const ok = res.filter((v) => v.start + h - 1 <= letzter)
    if (!ok.length) {
      out[`FK${h}`] = null
      continue
    }
    if (hatEval) {
      out[`FK${h}`] = mittel(ok.map((v) => v.pass_i !== null && v.pass_i - v.start + 1 <= h))
      out[`bruch_eval${h}`] = mittel(ok.map((v) => v.status === 'bruch' && v.bruch_phase === 'eval' && v.ende - v.start + 1 <= h))
    } else {
      out[`FK${h}`] = 1
      out[`bruch_eval${h}`] = 0
    }
  }
  const p_ = res.filter((v) => v.pass_i !== null)
  const ht = p_.map((v) => v.pass_i - v.start + 1)
  res = res.filter((v) => st.uhr[v.start] + horizont <= st.uhr[letzter] + K.EPS)
  out.starts_12m = res.length
  out.bestanden_12m = hatEval ? (res.length ? mittel(res.map((v) => v.pass_i !== null)) : null) : 1
  out.pass_htage_p25 = K.quantil(ht, 0.25)
  out.pass_htage_med = K.quantil(ht, 0.5)
  out.pass_htage_p75 = K.quantil(ht, 0.75)
  out.cons_hebt_anteil = p_.length ? mittel(p_.map((v) => v.cons_hebt)) : null
  const fa = res.filter((v) => v.auszahlungen.length)
  const at = fa.map((v) => v.auszahlungen[0].i - v.start + 1)
  const akt = fa.map((v) => st.uhr[v.auszahlungen[0].i] - st.uhr[v.start])
  const funded = res.filter((v) => v.funded_i !== null || !hatEval)
  out.erste_ausz_12m = res.length ? fa.length / res.length : null
  out.ausz_htage_p25 = K.quantil(at, 0.25)
  out.ausz_htage_med = K.quantil(at, 0.5)
  out.ausz_htage_p75 = K.quantil(at, 0.75)
  out.ausz_tage_med = K.quantil(akt, 0.5)
  out.erste_ausz_brutto_med = K.quantil(fa.map((v) => v.auszahlungen[0].brutto), 0.5)
  out.funded_bruch_anteil = funded.length ? mittel(funded.map((v) => v.status === 'bruch' && v.bruch_phase !== 'eval')) : null
  out.konto_verloren_12m = res.length ? mittel(res.map((v) => v.status === 'bruch')) : null
  out.inaktiv_bruch_anteil = res.length ? mittel(res.map((v) => v.grund === 'inaktivitaet')) : null
  out.cons_ausz_sperren_mittel = res.length ? mittel(res.map((v) => v.cons_ausz_sperren)) : null
  out.cons_ausz_gesperrt_anteil = res.length ? mittel(res.map((v) => v.cons_ausz_sperren > 0)) : null
  return out
}

function bewerteKampagne(konto, st, g, o, p, horizont, schritt) {
  const letzter = letzterTradeIndex(st)
  const starts = startsFuer(st, schritt).filter((s) => st.uhr[s] + horizont <= st.uhr[letzter] + K.EPS)
  const ks = starts.map((s) => K.kampagne(konto, st, s, horizont, g, o, p))
  if (!ks.length) return { kampagnen: 0 }
  const nm = ks.map((k) => k.netto / k.monate)
  const gs = ks.map((k) => k.monate_gewinnschwelle)
  return {
    kampagnen: ks.length,
    netto_monat_mittel: mittel(nm),
    netto_monat_p10: K.quantil(nm, 0.1),
    netto_monat_med: K.quantil(nm, 0.5),
    netto_monat_p90: K.quantil(nm, 0.9),
    netto_positiv: mittel(nm.map((x) => x > 0)),
    gebuehren_mittel: mittel(ks.map((k) => k.gebuehren)),
    fixkosten_mittel: mittel(ks.map((k) => k.fixkosten)),
    einsatz_mittel: mittel(ks.map((k) => k.einsatz)),
    einsatz_p90: K.quantil(ks.map((k) => k.einsatz), 0.9),
    gewinnschwelle_anteil: mittel(gs.map((x) => x !== null)),
    gewinnschwelle_monate_med: K.quantil(gs.filter((x) => x !== null), 0.5),
    auszahlungen_mittel: mittel(ks.map((k) => k.n_auszahlungen)),
    kaeufe_mittel: mittel(ks.map((k) => k.n_kauf)),
    resets_mittel: mittel(ks.map((k) => k.n_reset)),
    funded_brueche_mittel: mittel(ks.map((k) => k.n_bruch_funded)),
    live_anteil: mittel(ks.map((k) => k.n_live > 0)),
    geschlossen_anteil: mittel(ks.map((k) => k.n_geschlossen > 0)),
    keepalive_mittel: mittel(ks.map((k) => k.n_keepalive)),
    k_erste_ausz_anteil: mittel(ks.map((k) => k.erste_ausz_tage !== null)),
    k_erste_ausz_htage_med: K.quantil(ks.filter((k) => k.erste_ausz_htage !== null).map((k) => k.erste_ausz_htage), 0.5),
  }
}

function gleich(ist, soll) {
  if (soll === null || soll === undefined) return ist === null || ist === undefined
  if (typeof soll === 'boolean') return Boolean(ist) === soll
  if (typeof soll === 'string') return ist === soll
  if (ist === null || ist === undefined) return false
  return Math.abs(Number(ist) - soll) <= 1e-9 * Math.max(1, Math.abs(soll))
}

function vergleiche(namen, ist, soll, wo, fehler) {
  namen.forEach((name, j) => {
    const a = Array.isArray(ist) ? ist[j] : ist[name]
    if (!gleich(a, soll[j])) fehler.push(`${wo} ${name}: TS ${a} / Referenz ${soll[j]}`)
  })
}

// ------------------------------------------------------------------------------------------- Tests: Parität
test('Fixtures passen zur Regel-Datei (sonst Fixtures neu erzeugen)', () => {
  assert.equal(createHash('sha256').update(datenRoh).digest('hex'), FIX.web_daten_sha256)
  assert.ok(FIX.faelle.length >= 900, `nur ${FIX.faelle.length} Fälle`)
})

test('pyFloorDiv entspricht Pythons Gleitkomma-Ganzzahldivision', () => {
  assert.equal(K.pyFloorDiv(1, 0.1), 9)
  assert.equal(K.pyFloorDiv(300, 41.22), 7)
  assert.equal(K.pyFloorDiv(-7, 2), -4)
  assert.equal(K.pyFloorDiv(6, 3), 2)
})

const ERGEBNIS = { faelle: 0, kennzahlen: 0, abweichungen: [], gruppen: new Map() }

function gruppeFuer(konto, f) {
  const ph = konto.phasen
  const tags = new Set()
  for (const p of ph) {
    tags.add(`Drawdown ${p.dd_art}`)
    if (p.cons_anteil && p.typ === 'eval') tags.add('Consistency Eval (Ziel steigt)')
    if (p.ausz?.cons_anteil) tags.add('Consistency Auszahlung (gesperrt)')
    if (p.dll_wirkung) tags.add(`Tagesverlust ${p.dll_wirkung}`)
    if (p.dll_stufen) tags.add('Tagesverlust Stufen')
    if (p.inaktiv_art) tags.add(`Inaktivität ${p.inaktiv_art}`)
    if (p.ausz?.lebenszeit_deckel) tags.add('Lebenszeit-Deckel')
    if (p.ausz?.max_summe_brutto) tags.add('Summen-Grenze bis Live')
    if (p.ausz?.ende_nach_max === 'geschlossen' && p.ausz?.max_anzahl) tags.add('Ende geschlossen')
    if (p.typ === 'funded' && p.max_tage) tags.add('Funded-Zeitlimit')
    if (p.skalierung) tags.add('Scaling-Plan')
    if (p.hebel) tags.add('Hebel-Kappe (Perps)')
    if (p.bruch_basis === 'saldo_realisiert') tags.add('Bruchbasis realisiert')
  }
  if (ph.filter((p) => p.typ === 'eval').length > 1) tags.add('Mehrstufen-Eval')
  if (ph[0].typ !== 'eval') tags.add('Sofort funded')
  if (konto.perp) tags.add('Perp-Konto')
  tags.add(`Politik ${f.p[0]}`)
  tags.add(`Größe ${f.g.art}`)
  if (f.o.inaktivitaet) tags.add(`Inaktivität Option ${f.o.inaktivitaet}`)
  if (f.o.bot_betrieb === false) tags.add('ohne Bot-Fixkosten')
  if (f.o.mae_modus) tags.add(`MAE ${f.o.mae_modus}`)
  if (konto.perp && !f.o.perp) tags.add('Perp ohne Kostenblock')
  if (konto.rechenvariante !== 'standard') tags.add(`offene Variante ${konto.rechenvariante}`)
  return tags
}

test('Parität: alle Kontotypen x Politiken und Sonderfälle gegen die Referenz', () => {
  const fehler = []
  for (const f of FIX.faelle) {
    const konto = KONTEN.get(`${f.k}|${f.v}`)
    assert.ok(konto, `Konto fehlt: ${f.k}|${f.v}`)
    const st = STROEME[f.s]
    const { g, o, p } = fallParameter(f)
    K.pruefeStrom(konto, st, o)
    const wo = `${f.k}|${f.v}|${f.s}|${f.p[0]}${f.p[1] ?? ''}`
    const vorher = fehler.length
    const ein = bewerteEinzel(konto, st, startsFuer(st, FIX.schritt), g, o, p, FIX.horizont_tage)
    vergleiche(FIX.einzel_felder, ein, f.e, wo, fehler)
    let n = FIX.einzel_felder.length
    if (f.c) {
      const kam = bewerteKampagne(konto, st, g, o, p, FIX.horizont_tage, FIX.schritt)
      vergleiche(FIX.kampagne_felder, kam, f.c, wo, fehler)
      n += FIX.kampagne_felder.length
    } else assert.equal(konto.preis, null, `${wo}: Referenz ohne Kampagne, TS mit Preis`)
    if (f.d) {
      for (const sv of f.d.versuche) {
        const s = sv[0]
        const e = Math.min(K.searchsortedRechts(st.uhr, st.uhr[s] + FIX.horizont_tage) - 1, st.uhr.length - 1)
        const v = K.versuch(konto, st, s, e, g, o, p)
        const ist = [
          s, FIX.status_codes.indexOf(v.status), v.grund, v.ende, v.pass_i, v.funded_i, v.live_i, null, v.end_saldo,
          v.end_boden, v.keepalive, v.ueberlappt, v.cons_ausz_sperren, v.cons_hebt, v.bruch_phase, null,
        ]
        const namen = ['start', 'status', 'grund', 'ende', 'pass_i', 'funded_i', 'live_i', 'auszahlungen', 'end_saldo',
          'end_boden', 'keepalive', 'ueberlappt', 'cons_ausz_sperren', 'cons_hebt', 'bruch_phase', 'kum_lebenszeit']
        const soll = [...sv]
        soll[7] = null
        soll[15] = null
        vergleiche(namen, ist, soll, `${wo} versuch@${s}`, fehler)
        const az = sv[7]
        if (az.length !== v.auszahlungen.length) fehler.push(`${wo} versuch@${s} Auszahlungen ${v.auszahlungen.length}/${az.length}`)
        else az.forEach(([i, b, nn], j) => vergleiche(['i', 'brutto', 'netto'], [v.auszahlungen[j].i, v.auszahlungen[j].brutto, v.auszahlungen[j].netto], [i, b, nn], `${wo} versuch@${s} ausz${j}`, fehler))
        vergleiche(['kum_brutto', 'kum_netto'], v.kum_lebenszeit, sv[15], `${wo} versuch@${s}`, fehler)
        n += namen.length + 3 * az.length
      }
      for (const sk of f.d.kampagnen) {
        const s = sk[0]
        const k = K.kampagne(konto, st, s, FIX.horizont_tage, g, o, p)
        const namen = ['start', 'netto', 'gebuehren', 'ertrag', 'einsatz', 'n_kauf', 'n_reset', 'n_bruch_eval',
          'n_bruch_funded', 'n_live', 'n_geschlossen', 'n_keepalive', 'fixkosten', 'erste_ausz_htage',
          'monate_gewinnschwelle', 'n_auszahlungen']
        vergleiche(namen, { ...k, start: s }, sk, `${wo} kampagne@${s}`, fehler)
        n += namen.length
      }
    }
    ERGEBNIS.faelle += 1
    ERGEBNIS.kennzahlen += n
    for (const t of gruppeFuer(konto, f)) {
      const gr = ERGEBNIS.gruppen.get(t) || { faelle: 0, abw: 0 }
      gr.faelle += 1
      if (fehler.length > vorher) gr.abw += 1
      ERGEBNIS.gruppen.set(t, gr)
    }
  }
  ERGEBNIS.abweichungen = fehler
  if (process.env.PARITAET_BERICHT) {
    const zeilen = [...ERGEBNIS.gruppen.entries()].sort((a, b) => a[0].localeCompare(b[0]))
    console.log(`Parität: ${ERGEBNIS.faelle} Fälle, ${ERGEBNIS.kennzahlen} Kennzahlen, ${fehler.length} Abweichungen`)
    for (const [t, gr] of zeilen) console.log(`  ${t.padEnd(42)} ${String(gr.faelle).padStart(5)} Fälle, ${gr.abw} mit Abweichung`)
  }
  assert.deepEqual(fehler.slice(0, 20), [], `${fehler.length} Abweichungen`)
})

test('Parität deckt jede Drawdown-Art, Consistency-Art, Politik und die Sonderregeln ab', () => {
  const pflicht = [
    'Drawdown eod_trailing', 'Drawdown intraday_trailing', 'Drawdown statisch', 'Consistency Eval (Ziel steigt)',
    'Consistency Auszahlung (gesperrt)', 'Politik A', 'Politik B', 'Politik C', 'Tagesverlust tagessperre',
    'Tagesverlust konto_verloren', 'Tagesverlust Stufen', 'Inaktivität kalendertage', 'Inaktivität kalenderwoche',
    'Lebenszeit-Deckel', 'Summen-Grenze bis Live', 'Ende geschlossen', 'Funded-Zeitlimit', 'Mehrstufen-Eval',
    'Sofort funded', 'Perp-Konto', 'Scaling-Plan', 'Hebel-Kappe (Perps)', 'Bruchbasis realisiert', 'Größe risiko_usd',
    'Größe kontrakte', 'Größe dd_anteil', 'Größe anteil_start', 'Inaktivität Option bruch', 'ohne Bot-Fixkosten',
  ]
  for (const t of pflicht) assert.ok(ERGEBNIS.gruppen.get(t)?.faelle > 0, `nicht abgedeckt: ${t}`)
})

// ------------------------------------------------------------------------------------------- Tests: Generator
const EIN = { trefferquote: 0.45, gewinnR: 1.6, verlustR: 1, tradesProWoche: 6, streuung: 'gemischt', stopPunkte: 20, instrument: 'MNQ', nqKurs: 20000 }

test('ISO-Wochen wie Python isocalendar', () => {
  assert.equal(G.isoWoche(Date.UTC(2027, 0, 4)), 202701)
  assert.equal(G.isoWoche(Date.UTC(2027, 0, 1)), 202653)
  assert.equal(G.isoWoche(Date.UTC(2026, 11, 31)), 202653)
  assert.equal(G.isoWoche(Date.UTC(2027, 11, 31)), 202752)
  assert.equal(G.isoWoche(Date.UTC(2028, 0, 3)), 202801)
  // Kalenderwochen der Fixture-Ströme (aus Python) nachrechnen
  const st = FIX.stroeme.K
  st.uhr.forEach((u, i) => assert.equal(G.isoWoche((u - 719163) * 864e5), st.woche[i]))
})

test('Generator: gleiche Saat, gleicher Pfad; Kalender ohne Wochenenden über ein Jahr', () => {
  const a = G.erzeugePfad(EIN, 7, 3)
  const b = G.erzeugePfad(EIN, 7, 3)
  const c = G.erzeugePfad(EIN, 7, 4)
  assert.deepEqual(a, b)
  assert.notDeepEqual(a.roh, c.roh)
  assert.ok(a.uhr[a.uhr.length - 1] - a.uhr[0] >= 365)
  for (const u of a.uhr) assert.ok(![0, 6].includes(new Date(u * 864e5).getUTCDay()))
})

test('Generator: Trefferquote, Trades je Woche und Erwartung stimmen; Kante-0-Zwilling hat Erwartung 0', () => {
  let n = 0, gew = 0, summe = 0, summe0 = 0, tage = 0
  for (let i = 0; i < 400; i++) {
    const p = G.erzeugePfad(EIN, 11, i)
    const s1 = G.stromAusPfad(p, EIN, 'perp', 0)
    const s0 = G.stromAusPfad(p, EIN, 'perp', G.erwartungR(EIN))
    tage += p.uhr.length
    s1.tage.forEach((tag, k) => tag.forEach((t, j) => {
      n += 1
      if (!t.ist_stop) gew += 1
      summe += t.pnl_e
      summe0 += s0.tage[k][j].pnl_e
      assert.ok(Math.abs(t.pnl_e - s0.tage[k][j].pnl_e - G.erwartungR(EIN)) < 1e-12)
      assert.ok(s0.tage[k][j].mfe_e >= s0.tage[k][j].pnl_e)
      assert.ok(t.mae_e >= 0 && t.aus > t.ein)
    }))
  }
  const se = G.streuungR(EIN) / Math.sqrt(n)
  assert.ok(Math.abs(gew / n - EIN.trefferquote) < 0.01, `Trefferquote ${gew / n}`)
  assert.ok(Math.abs(n / (tage / 5) - EIN.tradesProWoche) < 0.1, `Trades je Woche ${n / (tage / 5)}`)
  assert.ok(Math.abs(summe / n - G.erwartungR(EIN)) < 4 * se, `Erwartung ${summe / n}`)
  assert.ok(Math.abs(summe0 / n) < 4 * se, `Kante 0: ${summe0 / n}`)
})

test('Generator: Futures-Strom in USD je Kontrakt (MNQ 2 USD je Punkt), Perp-Strom in R', () => {
  const p = G.erzeugePfad(EIN, 1, 1)
  const f = G.stromAusPfad(p, EIN, 'futures', 0)
  const r = G.stromAusPfad(p, EIN, 'perp', 0)
  assert.equal(f.instrument, 'micro')
  const t = f.tage.find((x) => x.length)[0]
  const k = r.tage.find((x) => x.length)[0]
  assert.equal(t.stop_e, 40)
  assert.ok(Math.abs(t.pnl_e - k.pnl_e * 40) < 1e-9)
  assert.equal(k.punktwert_e, 1 / 20)
})

// ------------------------------------------------------------------------------------------- Tests: Simulation
const EINTRAEGE = KON.ladeKonten(DATEN)
const EINST = {
  strom: EIN, groessenModus: 'risiko', risikoUsd: 200, kontrakte: 3, ddAnteil: 0.1, politik: 'A', politikFaktor: 1,
  botBetrieb: false, perpKosten: true, saat: 42,
}
const AUSWAHL = [
  'topstep.combine.std_ohnedll_xfastd.50k', 'mffu.rapid.intraday.50k', 'tradeify.select.flex_40.50k',
  'vest.capital.instant.5k', 'myfundedperps.1-step-select.90-10.25k', 'myfundedperps.elite.80-20.5k',
]
function auftraegeFuer(ids) {
  return EINTRAEGE.filter((e) => ids.includes(e.id)).flatMap((e) => e.rechnungen.map((r) => ({ schluessel: AUS.schluesselFuer(e.id, r.name), konto: r.konto })))
}

test('Regel-Datei: alle 140 simulierbaren Kontotypen laden, Varianten und Quellen vollständig', () => {
  assert.equal(EINTRAEGE.length, 140)
  assert.equal(EINTRAEGE.reduce((a, e) => a + e.rechnungen.length - 1, 0), 57)
  assert.equal(DATEN.stand, '2026-10-09')
  for (const e of EINTRAEGE) {
    assert.ok(e.quellen.length > 0, `${e.id} ohne Quelle`)
    for (const q of e.quellen) assert.match(DATEN.quellen[q].url, /^https:\/\//)
  }
  assert.ok(DATEN.nicht_simulierbar.length >= 1)
})

test('Simulation: deterministisch, in Teilen gerechnet gleich wie am Stück', () => {
  const a = auftraegeFuer(AUSWAHL)
  const ganz = SIM.simuliere(a, EINST, 0, 24)
  const teile = AUS.verbinde([SIM.simuliere(a, EINST, 0, 10), SIM.simuliere(a, EINST, 10, 24)])
  for (const k of Object.keys(ganz)) {
    assert.deepEqual(Array.from(teile[k].kante), Array.from(ganz[k].kante))
    assert.deepEqual(Array.from(teile[k].null), Array.from(ganz[k].null))
  }
})

test('Simulation: Kennzahlen plausibel, Preis fehlt -> kein Netto, Kante 0 kostet Gebühren', () => {
  const a = auftraegeFuer(AUSWAHL)
  const roh = SIM.simuliere(a, EINST, 0, 120)
  const zeilen = AUS.baueZeilen(EINTRAEGE.filter((e) => AUSWAHL.includes(e.id)), roh, false)
  assert.equal(zeilen.length, AUSWAHL.length)
  for (const z of zeilen) {
    assert.equal(z.grund, null, `${z.eintrag.id}: ${z.grund}`)
    const k = z.kante
    for (const v of [k.ausz6, k.ausz12, k.bruch12]) assert.ok(v >= 0 && v <= 1)
    if (z.eintrag.hatEval) assert.ok(k.fk30 <= k.fk60 && k.fk60 <= k.fk90 && k.fk90 <= k.bestanden12)
    else assert.equal(k.fk30, null)
    assert.ok(k.ausz6 <= k.ausz12)
    if (z.eintrag.konto.preis === null) assert.equal(k.netto, null)
    else {
      assert.ok(k.netto.p10 <= k.netto.p50 && k.netto.p50 <= k.netto.p90)
      assert.ok(z.null.gebuehren > 0)
    }
  }
  const ts = zeilen.find((z) => z.eintrag.id === 'topstep.combine.std_ohnedll_xfastd.50k')
  assert.ok(ts.kante.netto.mittel > ts.null.netto.mittel, 'mit Kante besser als ohne')
  assert.ok(ts.null.netto.mittel < 0, 'ohne Kante verliert der Konto-Platz die Gebühren')
  // Vest hat offene Hebel-Variante: Rang = ungünstigere Lesart
  const vest = zeilen.find((z) => z.eintrag.id === 'vest.capital.instant.5k')
  assert.equal(vest.varianten.length, 1)
  assert.equal(vest.rangNetto, Math.min(vest.kante.netto.mittel, vest.varianten[0].kante.netto.mittel))
})

test('Simulation: Eingaben ohne Kante -> Zwilling identisch (Vergleich ohne Kante rechnet richtig)', () => {
  const ohne = { ...EINST, strom: { ...EIN, trefferquote: 0.5, gewinnR: 1, verlustR: 1 } }
  const roh = SIM.simuliere(auftraegeFuer(['topstep.combine.std_ohnedll_xfastd.50k']), ohne, 0, 15)
  const r = roh['topstep.combine.std_ohnedll_xfastd.50k|standard']
  assert.deepEqual(Array.from(r.kante), Array.from(r.null))
})

test('Bot-Betrieb: Vest fällt aus der Rangfolge, Topstep zahlt die API-Gebühr', () => {
  const ids = ['topstep.combine.std_ohnedll_xfastd.50k', 'vest.capital.instant.5k']
  const mitBot = { ...EINST, botBetrieb: true }
  const a = SIM.simuliere(auftraegeFuer(ids), mitBot, 0, 20)
  const b = SIM.simuliere(auftraegeFuer(ids), EINST, 0, 20)
  const za = AUS.baueZeilen(EINTRAEGE.filter((e) => ids.includes(e.id)), a, true)
  const zb = AUS.baueZeilen(EINTRAEGE.filter((e) => ids.includes(e.id)), b, false)
  assert.equal(za.find((z) => z.eintrag.id.startsWith('vest')).inRangfolge, false)
  assert.equal(zb.find((z) => z.eintrag.id.startsWith('vest')).inRangfolge, true)
  const tsA = za.find((z) => z.eintrag.id.startsWith('topstep')).null.gebuehren
  const tsB = zb.find((z) => z.eintrag.id.startsWith('topstep')).null.gebuehren
  assert.ok(Math.abs(tsA - tsB - (29 * 12) / (365 / 30.44)) < 1e-6, `${tsA} ${tsB}`)
})

test('Kanten-Sicherheit: nötige Trades für ein 95-%-Signal', () => {
  const s = AUS.kantenSicherheit({ ...EIN, streuung: 'gleich', trefferquote: 0.5, gewinnR: 2, verlustR: 1 })
  assert.equal(s.erwartung, 0.5)
  assert.ok(Math.abs(s.sd - 1.5) < 1e-12)
  assert.equal(s.tradesNoetig, Math.ceil((1.96 * 1.5 / 0.5) ** 2))
  assert.equal(AUS.kantenSicherheit({ ...EIN, trefferquote: 0.3, gewinnR: 1, verlustR: 1 }).tradesNoetig, null)
})

// ------------------------------------------------------------------------------------------- Tests: öffentliches Repo
test('Daten und Fixtures: nur öffentliche Quellen (https), keine lokalen Pfade oder Dateiverweise', () => {
  for (const [name, txt] of [['Regel-Datei', datenRoh.toString('utf8')], ['Fixtures', FIX_TEXT]]) {
    assert.ok(!/\/(Users|Volumes|home)\/|[A-Za-z]:\\|lokal:|file:\/\//.test(txt), `${name} enthält einen lokalen Pfad`)
  }
  for (const q of Object.values(DATEN.quellen)) assert.match(q.url, /^https:\/\//)
  // Nur Felder, die der Rechner braucht: keine Freitexte aus der Recherche
  for (const k of DATEN.konten) {
    assert.deepEqual(Object.keys(k).sort(), ['aktionen', 'firma', 'groesse', 'id', 'live_nicht_simuliert', 'offen', 'programm', 'quellen', 'regeln', 'strenger', 'variante', 'varianten'])
  }
})

// ------------------------------------------------------------------------------------------- Render-Test (beide Sprachen)
const React = (await import('react')).default
const { renderToString } = await import('react-dom/server')
const h = React.createElement
const render = (el) => renderToString(el).replaceAll('<!-- -->', '')
const ohneStrich = (html, wo) => assert.ok(!/[–—]/.test(html), `${wo}: Gedankenstrich im Text`)
const T = await import('../components/prop-firm-rechner/texte.ts')

// Sichtbarer Text samt title/aria-label/alt (Klassen und IDs im Markup sind deutsch und zählen nicht)
function sichtbar(html) {
  const attrs = [...html.matchAll(/\s(?:title|aria-label|alt|placeholder)="([^"]*)"/g)].map((m) => m[1])
  const text = html.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<[^>]+>/g, ' ')
  return [text, ...attrs].join(' ').replaceAll('&quot;', '"').replaceAll('&#x27;', "'").replaceAll('&amp;', '&').replaceAll('&lt;', '<').replaceAll('&gt;', '>')
}
// Typische deutsche Wörter und Umlaute: dürfen auf der englischen Seite nicht vorkommen
const DEUTSCH = /[äöüÄÖÜß]|\b(und|oder|nicht|mit|für|bei|der|die|das|den|dem|ein|eine|ist|sind|bis|ab|je|pro|auch|nur|wenn|Konto|Konten|Kontotyp|Kontotypen|Gebühr|Gebühren|Auszahlung|Auszahlungen|Prüfung|Handelstage|Monat|Monate|Jahre|Regel|Regeln|Quelle|Quellen|Startseite|Drittseite|Drittquelle|DRITTQUELLE|Abschnitt|Ziel|ohne|Kauf|Preis|Hinweise|Kosten|Stufe|Aktion|Aktionspreis|Gewinn|Verlust|Trefferquote|Stopp|Punkte|Anzeige|abgerufen|Startsaldo|Kante)\b/
// dazu Wortteile deutscher Zusammensetzungen (Tagesverlustgrenze, Auszahlungsregel …), die im Englischen nicht vorkommen
const DEUTSCH_TEILE = /verlust|grenze|gewinn|zahlung|prüf|konto|gebühr|weich|nachzieh|einmalig|höchst|mindest|insgesamt|zeitlimit|kalender|handel|gesprengt|lesart|sofort|stufe|quelle|regel|eingabe|erwartung|streuung|glück|monat|jahre|polster|anzeige|werkzeug|rechner|firmen/i
function ohneDeutsch(html, wo) {
  const text = sichtbar(html)
  const m = DEUTSCH.exec(text) ?? DEUTSCH_TEILE.exec(text)
  assert.ok(!m, `${wo}: deutscher Rest „${m?.[0]}“ in „${m ? text.slice(Math.max(0, m.index - 60), m.index + 60) : ''}“`)
}
const istDeutsch = (s) => DEUTSCH.test(s) || DEUTSCH_TEILE.test(s)
// Ergebnisse werden nie über „Glück“ erklärt, sondern über die Kante (Vergleich ohne Kante, Kante 0)
const GLUECK = /glück|glueck|luck/i
function ohneGlueck(html, wo) {
  const text = sichtbar(html)
  const m = GLUECK.exec(text)
  assert.ok(!m, `${wo}: „${m?.[0]}“ in „${m ? text.slice(Math.max(0, m.index - 60), m.index + 40) : ''}“`)
}

test('Prüfwerkzeug: erkennt deutsche Reste, lässt englische Texte durch', () => {
  for (const s of ['Tagesverlustgrenze 1.000 USD (weich)', 'Preis 49 USD', 'Topstep Labs (Startseite)', 'Auszahlungsregel', 'Kontotyp']) assert.ok(istDeutsch(s), s)
  for (const s of ['Daily loss limit 1,000 USD (soft)', 'Rules as of Oct 9, 2026', 'Payout rule', 'Topstep Labs (home page)', 'MyFundedFutures 50K Pro']) assert.ok(!istDeutsch(s), s)
})

test('Wörterbücher: Deutsch und Englisch haben dieselbe Form', () => {
  const form = (o, pfad = '') =>
    Object.entries(o).flatMap(([k, v]) => {
      const p = `${pfad}.${k}`
      if (v && typeof v === 'object' && !Array.isArray(v)) return form(v, p)
      return [`${p}:${Array.isArray(v) ? `array${v.length}` : typeof v}`]
    })
  assert.deepEqual(form(T.woerterbuch('en')), form(T.woerterbuch('de')))
  assert.equal(T.woerterbuch('de').sprache, 'de')
  assert.equal(T.woerterbuch('en').sprache, 'en')
})

test('Zahlenformat: Deutsch 1.234 USD und 45 %, Englisch 1,234 USD und 45%', () => {
  const de = T.woerterbuch('de').f
  const en = T.woerterbuch('en').f
  assert.equal(de.usd(1234.4), '1.234 USD')
  assert.equal(en.usd(1234.4), '1,234 USD')
  assert.equal(de.usd(-1234, true), '−1.234 USD')
  assert.equal(en.usd(56, true), '+56 USD')
  assert.equal(de.pct(0.45), '45 %')
  assert.equal(en.pct(0.45), '45%')
  assert.equal(de.r(1.5), '+1,50 R')
  assert.equal(en.r(-0.25), '−0.25 R')
  assert.equal(de.datum('2026-10-09'), '09.10.2026')
  assert.equal(en.datum('2026-10-09'), 'Oct 9, 2026')
  assert.equal(en.zahlText(3000), '3,000')
  assert.equal(de.ka, 'k. A.')
  assert.equal(en.ka, 'n/a')
})

test('Englisch: jeder deutsche Text aus der Regel-Datei hat eine Übersetzung', () => {
  const en = T.woerterbuch('en')
  for (const e of EINTRAEGE) {
    if (e.variante) assert.ok(!istDeutsch(en.daten.variante(e.variante)), `Variante ${e.id}: ${en.daten.variante(e.variante)}`)
    for (const r of e.rechnungen.slice(1)) {
      const txt = en.daten.regelVariante(r.name, r.text)
      assert.notEqual(txt, r.text, `Regel-Variante ${r.name} ohne Übersetzung`)
      assert.ok(!istDeutsch(txt), `Regel-Variante ${r.name}: ${txt}`)
    }
    for (const a of e.aktionen) assert.match(en.daten.aktion(a), /^(Promo price|Double payout cap) [\d,]+ USD/, `Aktion ${e.id}: ${a.text}`)
    for (const p of [...e.offen, ...e.strenger]) assert.ok(!istDeutsch(en.daten.feld(p)), `Feld ${p}: ${en.daten.feld(p)}`)
    for (const [code] of e.konto.ko_kriterien) assert.ok(!istDeutsch(en.daten.ko(code)) && en.daten.ko(code) !== code, `K.-o.-Kriterium ${code}`)
    for (const code of e.konto.verbote_codes) assert.notEqual(en.daten.verbot(code), T.woerterbuch('de').daten.verbot(code), `Verbot ${code} ohne Übersetzung`)
    assert.notEqual(en.daten.bot(e.konto.bot_eignung), e.konto.bot_eignung, `Bot-Eignung ${e.konto.bot_eignung}`)
  }
  for (const [id, q] of Object.entries(DATEN.quellen)) {
    const titel = en.daten.quelleTitel({ id, ...q })
    assert.ok(!istDeutsch(titel), `Quelle ${id}: ${titel}`)
  }
})

const RW_ZIELE = (await import('./prop-firm/rueckwaerts.ts')).RW.ziele
const STARTS_FORM = (await import('../components/prop-firm-rechner/start.ts')).STARTS

for (const sprache of ['de', 'en']) {
  test(`Render (${sprache}): Rechner, Ergebnisse, Details und Hintergrund ohne Fehler (react-dom/server)`, async () => {
    const { Wizard } = await import('../components/prop-firm-rechner/wizard.tsx')
    const { VorAnnahmen } = await import('../components/prop-firm-rechner/rechner.tsx')
    const { VorKlartext } = await import('../components/prop-firm-rechner/klartext.tsx')
    const { Ergebnisse } = await import('../components/prop-firm-rechner/ergebnisse.tsx')
    const { Details } = await import('../components/prop-firm-rechner/details.tsx')
    const { Hintergrund } = await import('../components/prop-firm-rechner/hintergrund.tsx')
    const en = sprache === 'en'

    // Erster Schritt des Ablaufs: eine Frage, Antworten aus dem Raster, Abzweig „Ich kenne meine Zahlen“
    const start = render(h(Wizard, { sprache }))
    const startTexte = en
      ? ['Prop firm calculator', 'How much do you want paid out?', '5,000 USD', '50,000 USD', 'What does this mean?', 'I know my numbers', 'Next', 'How the calculator works', 'Legal notice', 'Privacy policy', 'Not financial advice', 'Step 1 of 7']
      : ['Prop-Firm-Rechner', 'Wie viel willst du ausgezahlt bekommen?', '5.000 USD', '50.000 USD', 'Was heißt das?', 'Ich kenne meine Zahlen', 'Weiter', 'So rechnet der Rechner', 'Impressum', 'Datenschutz', 'Keine Finanzberatung', 'Schritt 1 von 7']
    for (const t of startTexte) assert.ok(start.includes(t), `Startansicht ohne „${t}“`)
    assert.equal((start.match(/class="wz-chip"/g) || []).length, RW_ZIELE.length, 'je Rasterziel eine Antwort')
    assert.equal((start.match(/class="punkt"/g) || []).length, 7, 'ein Punkt je Frage (6) und einer für das Ergebnis')
    assert.ok(start.includes('href="/impressum"') && start.includes('href="/datenschutz"'), 'Impressum und Datenschutz erreichbar')
    // Weitere Annahmen (Blatt) und Ergebnis vorwärts in Klartext mit echter Rechnung
    const annahmen = render(h(VorAnnahmen, { sprache, form: STARTS_FORM[sprache], setForm: () => {} }))
    for (const t of en ? ['Losses vary', 'Take and go', 'I trade with a bot'] : ['Verluste schwanken', 'Nimm und geh', 'Ich handle mit einem Bot']) {
      assert.ok(annahmen.includes(t), `Annahmen ohne „${t}“`)
    }
    const vorEinst = { ...EINST, strom: { ...EINST.strom, trefferquote: 0.45, gewinnR: 2, verlustR: 1, streuung: 'gleich' } }
    const vorRoh = SIM.simuliere(EINTRAEGE.flatMap((e) => e.rechnungen.map((r) => ({ schluessel: AUS.schluesselFuer(e.id, r.name), konto: r.konto }))), vorEinst, 0, 20)
    const vorZeilen = AUS.baueZeilen(EINTRAEGE, vorRoh, false).filter((z) => z.inRangfolge && z.rangNetto !== null).sort((a, b) => b.rangNetto - a.rangNetto)
    const rechnung = { lauf: { status: 'fertig', fertig: 20, gesamt: 20 }, ergebnis: { roh: vorRoh, einst: vorEinst, pfade: 20, dauerMs: 1, formSchl: '' }, veraltet: false, bester: vorZeilen[0], eintraege: EINTRAEGE, varianten: 197 }
    const vor = render(h(VorKlartext, { sprache, form: STARTS_FORM[sprache], rechnung, onAndere: () => {}, onAnnahmen: () => {} }))
    for (const t of en ? ['per month net', 'See other accounts', 'Adjust assumptions', 'of 10 simulated years', vorZeilen[0].eintrag.firma] : ['pro Monat netto', 'Andere Konten ansehen', 'Annahmen anpassen', 'von 10 simulierten Jahren', vorZeilen[0].eintrag.firma]) {
      assert.ok(vor.includes(t), `Vorwärts-Ergebnis ohne „${t}“`)
    }
    ohneStrich(vor, `Vorwärts-Ergebnis ${sprache}`)
    ohneGlueck(vor, `Vorwärts-Ergebnis ${sprache}`)
    if (en) ohneDeutsch(vor, 'Vorwärts-Ergebnis en')
    ohneStrich(start, `Startansicht ${sprache}`)
    ohneGlueck(start, `Startansicht ${sprache}`)
    if (en) ohneDeutsch(start, 'Startansicht en')

    const alle = EINTRAEGE.flatMap((e) => e.rechnungen.map((r) => ({ schluessel: AUS.schluesselFuer(e.id, r.name), konto: r.konto })))
    for (const politik of ['A', 'C']) {
      const einst = { ...EINST, politik, politikFaktor: 2, botBetrieb: politik === 'C' }
      const roh = SIM.simuliere(alle, einst, 0, 20)
      const html = render(h(Ergebnisse, { ergebnis: { roh, einst, pfade: 20, dauerMs: 1, formSchl: '' }, eintraege: EINTRAEGE, daten: DATEN, veraltet: false, sprache }))
      const texte = en
        ? ['The three best account types', 'Rank 1', 'All account types', 'Net / month']
        : ['Die drei besten Kontotypen', 'Platz 1', 'Alle Kontotypen', 'Netto / Monat']
      for (const t of texte) assert.ok(html.includes(t), `Ergebnis (${sprache}, ${politik}) ohne „${t}“`)
      // „ohne Kante“ gehört nicht mehr in die Hauptansicht, nur noch als Satz in den Details
      for (const t of en ? ['Zero edge', 'without an edge'] : ['Kante 0', 'ohne Kante']) assert.ok(!html.includes(t), `Ergebnis (${sprache}) zeigt noch „${t}“`)
      assert.ok(/(meist:|mostly:|scheitert selten|rarely fails)/.test(html), `Ergebnis (${sprache}): Hauptgrund des Scheiterns fehlt`)
      assert.ok(!/NaN|undefined|Infinity/.test(html), `Ergebnis (${sprache}, ${politik}) enthält NaN/undefined`)
      const zeilen = (html.match(/<tr class="zeile/g) || []).length
      // zuerst 25 Zeilen, der Rest hinter „Alle … anzeigen“
      const auswahl = EINTRAEGE.filter((e) => e.aktiv && !(einst.botBetrieb && e.botAusschluss)).length
      assert.equal(zeilen, Math.min(25, auswahl), `Tabellenzeilen ${zeilen} statt ${Math.min(25, auswahl)}`)
      const mehr = en ? `Show all ${auswahl} account types` : `Alle ${auswahl} Kontotypen anzeigen`
      assert.ok(html.includes(mehr), `Knopf „${mehr}“ fehlt`)
      ohneStrich(html, `Ergebnis ${sprache} ${politik}`)
      ohneGlueck(html, `Ergebnis ${sprache} ${politik}`)
      if (en) ohneDeutsch(html, `Ergebnis en ${politik}`)
      const zeilenObj = AUS.baueZeilen(EINTRAEGE, roh, einst.botBetrieb)
      for (const z of zeilenObj) {
        const d = render(h(Details, { zeile: z, daten: DATEN, botBetrieb: einst.botBetrieb, sprache }))
        const [q, r, w] = en ? ['Sources', 'Rules', 'Where it fails'] : ['Quellen', 'Regeln', 'Woran es scheitert']
        assert.ok(d.includes(q) && d.includes(r) && d.includes(w), `Details ${z.eintrag.id}`)
        assert.ok(!/NaN|undefined/.test(d), `Details ${z.eintrag.id} enthält NaN/undefined`)
        ohneStrich(d, `Details ${sprache} ${z.eintrag.id}`)
        ohneGlueck(d, `Details ${sprache} ${z.eintrag.id}`)
        if (en) ohneDeutsch(d, `Details en ${z.eintrag.id}`)
      }
    }

    const hg = render(h(Hintergrund, { daten: DATEN, sprache }))
    const hgTexte = en
      ? ['How the calculator works', 'Rules and sources', 'Oct 9, 2026', 'Not financial advice', 'Rules change', 'Topstep', 'Vest']
      : ['So rechnet der Rechner', 'Regelstand und Quellen', '09.10.2026', 'Keine Finanzberatung', 'Regeln ändern sich', 'Topstep', 'Vest']
    for (const t of hgTexte) assert.ok(hg.includes(t), `Hintergrund (${sprache}) ohne „${t}“`)
    const links = [...hg.matchAll(/href="([^"]+)"/g)].map((m) => m[1])
    assert.ok(links.length >= 100, `nur ${links.length} Quellen-Links`)
    for (const l of links) assert.ok(!/[?&](ref|aff|affiliate|via|utm_[a-z]+|coupon|code)=/i.test(l), `Werbe-Parameter im Link ${l}`)
    ohneStrich(hg, `Hintergrund ${sprache}`)
    ohneGlueck(hg, `Hintergrund ${sprache}`)
    if (en) ohneDeutsch(hg, 'Hintergrund en')
  })
}

test('CTA-Karte: in beiden Sprachen X und YouTube, AI Lab und das eToro-Angebot mit allen Hinweisen', async () => {
  const { CtaKarte, X_URL, AI_LAB_URL, AI_LAB_ABO_URL } = await import('../components/prop-firm-rechner/cta-karte.tsx')
  const { ETORO_OFFER, ETORO_CTA, YOUTUBE_URL } = await import('../components/landing-v3/content.ts')
  const esc = (s) => s.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll("'", '&#x27;')
  assert.equal(X_URL, 'https://x.com/petar_trades')
  assert.equal(YOUTUBE_URL, 'https://www.youtube.com/@PriceActionTrader_Petar')
  assert.equal(AI_LAB_URL, 'https://petartrades.substack.com')
  assert.equal(AI_LAB_ABO_URL, 'https://petartrades.substack.com/subscribe')
  for (const sprache of ['de', 'en']) {
    const html = render(h(CtaKarte, { sprache }))
    const links = [...html.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>/g)]
    for (const ziel of [X_URL, YOUTUBE_URL, AI_LAB_ABO_URL]) assert.equal(links.filter((m) => m[1] === ziel).length, 1, `${sprache}: Link ${ziel}`)
    // Substack als eigener, sichtbarer Knopf wie X und YouTube
    const knopf = html.match(new RegExp(`<a class="cta-ziel" href="${AI_LAB_ABO_URL}"[^>]*>([^<]*)<`))
    assert.ok(knopf, `${sprache}: Substack-Knopf fehlt`)
    assert.equal(knopf[1].trim(), sprache === 'de' ? 'Substack abonnieren' : 'Subscribe on Substack')
    assert.equal((html.match(/class="cta-ziel"/g) || []).length, 3, `${sprache}: X, YouTube und Substack als Knöpfe`)
    if (ETORO_OFFER.enabled) {
      const partner = links.filter((m) => m[1] === ETORO_OFFER.href)
      assert.equal(partner.length, 1, `${sprache}: genau ein Partnerlink`)
      assert.match(partner[0][0], /rel="sponsored noopener"/)
      assert.match(partner[0][0], new RegExp(`data-cta="${ETORO_CTA.tool}"`))
      assert.ok(html.includes('href="/#etoro"'), `${sprache}: Verweis auf die Schritte der Landing`)
      const o = sprache === 'de' ? ETORO_OFFER : ETORO_OFFER.en
      for (const t of [o.disclosure, o.riskPlatform, o.riskCfd, o.minDeposit]) assert.ok(html.includes(esc(t)), `${sprache}: fehlt ${t}`)
      assert.ok(html.includes(sprache === 'de' ? '>Anzeige<' : '>Ad<'), `${sprache}: Werbekennzeichnung`)
    }
    ohneStrich(html, `CTA ${sprache}`)
    ohneGlueck(html, `CTA ${sprache}`)
    if (sprache === 'en') {
      assert.ok(html.includes('German-language mentorship'))
      ohneDeutsch(html, 'CTA en')
    } else {
      assert.ok(html.includes('englischsprachig'))
    }
  }
})

test('Kein „Glück“/„luck“ in Texten und Metadaten', () => {
  for (const datei of ['texte.de.ts', 'texte.en.ts', 'cta-karte.tsx', 'seite.tsx', 'wizard.tsx', 'bewegung.tsx', 'crv-skizze.tsx', 'rueckwaerts.tsx', 'scheitern.tsx', 'rechner.tsx', 'klartext.tsx', 'blatt.tsx', 'messung.ts', 'verlauf.ts', 'regler.tsx']) {
    const quelle = lese(`../components/prop-firm-rechner/${datei}`).toString('utf8').replace(/^\s*(\/\/|\*|\/\*\*).*$/gm, '')
    assert.doesNotMatch(quelle, GLUECK, `${datei} enthält Glück/luck`)
  }
  // auch der Eintrag im globalen Footer (andere Seiten verlinken den Rechner dort)
  assert.doesNotMatch(lese('../components/layout/footer.tsx').toString('utf8'), GLUECK, 'globaler Footer enthält Glück/luck')
  for (const seite of ['../app/tools/prop-firm-rechner/page.tsx', '../app/en/tools/prop-firm-calculator/page.tsx']) {
    assert.doesNotMatch(lese(seite).toString('utf8'), GLUECK, `${seite} enthält Glück/luck`)
  }
})

// ------------------------------------------------------------------------------------------- Rückwärts-Modus
const RWM = await import('./prop-firm/rueckwaerts.ts')
const RW = RWM.RW
const RW_KONTEN = EINTRAEGE.filter((e) => e.aktiv && e.konto.preis !== null).map((e) => ({ id: e.id, konto: e.konto }))
const tabelle = (tpw, m) => JSON.parse(lese(`./prop-firm/daten/rueckwaerts/tpw${tpw}-m${m}.json`).toString('utf8'))

test('Rückwärts: Tabellen vollständig, Raster und Kontotypen passen zur Regel-Datei', () => {
  for (const tpw of RW.tradesProWoche) {
    for (const m of RW.monate) {
      const t = tabelle(tpw, m)
      assert.equal(t.version, RW.version)
      assert.equal(t.stand, DATEN.stand)
      assert.deepEqual([t.tradesProWoche, t.monate, t.pfade], [tpw, m, RW.pfade])
      assert.deepEqual(t.crv, [...RW.crv])
      assert.deepEqual(t.sicherheit, [...RW.sicherheit])
      assert.deepEqual(t.ziele, [...RW.ziele])
      assert.deepEqual(t.konten, RW_KONTEN.map((k) => k.id))
      assert.equal(t.werte.length, t.konten.length * t.crv.length * t.sicherheit.length * t.ziele.length)
    }
  }
  const lader = lese('./prop-firm/daten/rueckwaerts/index.ts').toString('utf8')
  for (const tpw of RW.tradesProWoche) for (const m of RW.monate) assert.ok(lader.includes(`./tpw${tpw}-m${m}.json`), `Lader ohne tpw${tpw}-m${m}`)
})

test('Rückwärts: Stichproben der Tabelle stimmen mit einer Live-Rechnung überein', () => {
  // Futures und Perps, alle Zeiträume, Sicherheiten und Ziele. Alte Rasterstellen (übernommen aus Fassung 2) und neue
  // (Raster für die Slider, 13.10.2026): neue Trades-Zahl, neues CRV, neues CRV bei alter Trades-Zahl
  const futures = RW_KONTEN.filter((k) => !k.konto.perp)
  const proben = [
    { id: futures.find((k) => k.id.startsWith('topstep.combine')).id, crv: 2, tpw: 5 },
    { id: RW_KONTEN.find((k) => k.konto.perp).id, crv: 1.5, tpw: 2 },
    { id: futures.find((k) => k.id.startsWith('tradeify')).id, crv: 2.5, tpw: 1 },
    { id: futures.find((k) => k.id.startsWith('mffu')).id, crv: 4, tpw: 3 },
    { id: RW_KONTEN.find((k) => k.konto.perp).id, crv: 4, tpw: 10 },
    { id: futures.find((k) => k.id.startsWith('topstep.combine')).id, crv: 1, tpw: 7 },
  ]
  for (const pr of proben) assert.ok(RW.crv.includes(pr.crv) && RW.tradesProWoche.includes(pr.tpw))
  for (const pr of proben) {
    const ki = RW_KONTEN.findIndex((k) => k.id === pr.id)
    const ci = RW.crv.indexOf(pr.crv)
    const jeP = RW.trefferquoten.map((p) => RWM.quantile(RWM.nettoStaende([RW_KONTEN[ki]], p, pr.crv, pr.tpw)[0]))
    RW.monate.forEach((m, mi) => {
      const t = tabelle(pr.tpw, m)
      const live = Array.from(RWM.loese(jeP, mi))
      const n = RW.sicherheit.length * RW.ziele.length
      const basis = (ki * RW.crv.length + ci) * n
      assert.deepEqual(t.werte.slice(basis, basis + n), live, `${pr.id} CRV ${pr.crv}, ${pr.tpw}/Woche, ${m} Monate`)
    })
  }
})

test('Rückwärts: Anforderung steigt mit Ziel und Sicherheit, Einpassen zwischen Rasterzielen', () => {
  const t = tabelle(5, 6)
  let geprueft = 0
  t.konten.forEach((_, ki) => {
    t.crv.forEach((_, ci) => {
      t.sicherheit.forEach((_, si) => {
        let vorher = 0
        for (const z of t.ziele) {
          const a = RWM.anforderungAusTabelle(t, ki, ci, si, z)
          if (!a) {
            vorher = Infinity
            continue
          }
          assert.ok(vorher !== Infinity, 'nach „kaum erreichbar“ wieder erreichbar')
          assert.ok(a.trefferquote + 1e-9 >= vorher, 'höheres Ziel braucht keine kleinere Trefferquote')
          vorher = a.trefferquote
          geprueft++
        }
      })
    })
  })
  assert.ok(geprueft > 1000)
  // zwischen zwei Rasterzielen liegt die Anforderung zwischen den beiden Rasterwerten
  const a = RWM.anforderungAusTabelle(t, 0, 2, 0, 3000)
  const b = RWM.anforderungAusTabelle(t, 0, 2, 0, 5000)
  const m = RWM.anforderungAusTabelle(t, 0, 2, 0, 4000)
  if (a && b && m) assert.ok(m.trefferquote >= a.trefferquote - 1e-9 && m.trefferquote <= b.trefferquote + 1e-9)
  assert.equal(RWM.anforderungAusTabelle(t, 0, 2, 0, 60000), null, 'über dem Raster: nicht vorgerechnet')
  assert.ok(Math.abs(RWM.erwartungBeiCrv(0.4, 2) - 0.2) < 1e-12)
})

test('Rückwärts: Details (Woran es scheitert, Vergleich ohne Vorteil) sind plausibel', () => {
  const k = RW_KONTEN.find((x) => x.id.startsWith('topstep.combine'))
  const d = RWM.detailRueckwaerts(k.konto, 0.5, 2, 5, 1, 6, 3000, 60)
  const summe = [...d.endenEval, ...d.endenFunded].reduce((a, b) => a + b, 0)
  assert.ok(Math.abs(summe - 1) < 1e-9, `Anteile summieren sich zu ${summe}`)
  assert.ok(d.erreicht >= 0 && d.erreicht <= 1)
  assert.ok(d.medianOhneVorteil < d.median, 'ohne Vorteil weniger als mit Erwartung +0,5 R')
})

test('Generator: Verluste schwanken um das Risiko, Gewinner und Kalender bleiben gleich', () => {
  const basis = { trefferquote: 0.45, gewinnR: 2, verlustR: 1, tradesProWoche: 10, streuung: 'gleich', stopPunkte: 20, instrument: 'MNQ', nqKurs: 20000 }
  const fest = G.erzeugePfad(basis, 7, 3)
  const lose = G.erzeugePfad({ ...basis, verlustStreuung: true }, 7, 3)
  const verluste = []
  fest.roh.forEach((tag, i) => tag.forEach((tr, j) => {
    const v = lose.roh[i][j]
    assert.equal(v.r > 0, tr.r > 0, 'gleiche Gewinner und Verlierer')
    if (tr.r > 0) assert.equal(v.r, tr.r)
    else {
      assert.equal(tr.r, -1)
      verluste.push(-v.r)
    }
  }))
  const mittel = verluste.reduce((a, b) => a + b, 0) / verluste.length
  assert.ok(verluste.length > 200 && Math.abs(mittel - 1) < 0.1, `Mittel ${mittel} aus ${verluste.length} Verlusten`)
  assert.ok(Math.max(...verluste) > 1.8 && Math.min(...verluste) < 0.6, 'Verluste streuen in beide Richtungen')
  assert.ok(G.streuungR({ ...basis, verlustStreuung: true }) > G.streuungR(basis))
})

test('Simulation: Enden je Kauf summieren sich zu 1 und folgen den Gründen des Kerns', () => {
  const a = auftraegeFuer(AUSWAHL)
  const roh = SIM.simuliere(a, EINST, 0, 30)
  for (const e of EINTRAEGE.filter((x) => AUSWAHL.includes(x.id))) {
    const k = AUS.kennzahlen(roh[AUS.schluesselFuer(e.id, 'standard')].kante, e.hatEval)
    const summe = [...k.endenEval, ...k.endenFunded].reduce((x, y) => x + y, 0)
    assert.ok(Math.abs(summe - 1) < 1e-9, `${e.id}: ${summe}`)
    const bruch = SIM.ENDEN.slice(0, 4).reduce((x, _, j) => x + k.endenEval[j] + k.endenFunded[j], 0)
    assert.ok(Math.abs(bruch - k.bruch12) < 1e-9, `${e.id}: gescheitert ${bruch} statt ${k.bruch12}`)
  }
  assert.equal(SIM.endeVon({ status: 'bruch', grund: 'dll', end_phase: 'eval' }), 'dll')
  assert.equal(SIM.endeVon({ status: 'offen', grund: null, end_phase: 'eval' }), 'offen_eval')
  assert.equal(SIM.endeVon({ status: 'offen', grund: null, end_phase: 'funded' }), 'funded_laeuft')
  assert.equal(SIM.endeVon({ status: 'live', grund: null, end_phase: 'funded' }), 'weiter')
})

test('React-Schlüssel eindeutig: Quellenliste je Firma (gleiche URL unter zwei IDs) und Detail-Listen', async () => {
  const { quellenJeFirma } = await import('../components/prop-firm-rechner/hintergrund.tsx')
  const dopp = (liste) => liste.filter((x, i) => liste.indexOf(x) !== i)
  let doppelteUrl = 0
  for (const { firma, quellen } of quellenJeFirma(DATEN)) {
    assert.deepEqual(dopp(quellen.map((q) => q.id)), [], `${firma}: doppelte Quellen-ID`)
    doppelteUrl += dopp(quellen.map((q) => q.url)).length
  }
  assert.ok(doppelteUrl > 0, 'Regressionsfall fehlt: dieselbe URL unter zwei Quellen-IDs (Topstep Labs)')
  assert.ok(lese('../components/prop-firm-rechner/hintergrund.tsx').toString('utf8').includes('<li key={q.id}>'), 'Quellenliste muss die Quellen-ID als Schlüssel nutzen')
  for (const sprache of ['de', 'en']) {
    const W = T.woerterbuch(sprache)
    for (const e of EINTRAEGE) {
      for (const bot of [false, true]) {
        assert.deepEqual(dopp(W.kostenSaetze(e.konto, bot)), [], `${e.id}: doppelter Kosten-Satz (${sprache})`)
        for (const r of e.rechnungen) assert.deepEqual(dopp(W.regelSaetze(r.konto).map((p) => p.titel)), [], `${e.id}: doppelter Phasen-Titel (${sprache})`)
      }
    }
  }
  for (const e of EINTRAEGE) {
    assert.deepEqual(dopp(e.quellen), [], `${e.id}: doppelte Quelle`)
    assert.deepEqual(dopp(e.aktionen.map((a) => a.name)), [], `${e.id}: doppelte Aktion`)
    assert.deepEqual(dopp(e.konto.ko_kriterien.map(([c]) => c)), [], `${e.id}: doppeltes K.-o.-Kriterium`)
    assert.deepEqual(dopp(e.rechnungen.map((r) => r.name)), [], `${e.id}: doppelte Variante`)
  }
})

test('Seiten: beide Sprachen verweisen per hreflang aufeinander, Sitemap kennt beide, Navbar macht Platz', () => {
  const de = lese('../app/tools/prop-firm-rechner/page.tsx').toString('utf8')
  const en = lese('../app/en/tools/prop-firm-calculator/page.tsx').toString('utf8')
  for (const [name, src] of [['de', de], ['en', en]]) {
    assert.match(src, /languages: \{ de: PFADE\.de, en: PFADE\.en, 'x-default': PFADE\.de \}/, `${name}: hreflang fehlt`)
    assert.match(src, new RegExp(`<RechnerSeite sprache="${name}" />`))
    assert.match(src, new RegExp(`canonical: PFADE\\.${name}`))
  }
  assert.match(en, /locale: 'en_US'/)
  const sitemap = lese('../app/sitemap.ts').toString('utf8')
  assert.match(sitemap, /\$\{PFADE\.de\}/)
  assert.match(sitemap, /\$\{PFADE\.en\}/)
  const navbar = lese('../components/layout/navbar.tsx').toString('utf8')
  assert.match(navbar, /if \(hasOwnHeader \|\| hasToolHeader\) return null/)
})

test('Rückwärts-Ergebnis in Klartext: Strategie-Anforderung, leichtestes Konto, Wert darunter, Scheitern; Liste und Größenfilter', async () => {
  const { KontenListe, loeseAntworten } = await import('../components/prop-firm-rechner/rueckwaerts.tsx')
  const { RueckKlartext, DARUNTER_PUNKTE } = await import('../components/prop-firm-rechner/klartext.tsx')
  const t = tabelle(5, 6)
  const ids = new Map(EINTRAEGE.map((e) => [e.id, e]))
  const basis = { ziel: 5000, monate: 6, tpw: 5, crv: 2, sicherheit: 7, groesseMax: null }
  for (const crv of RW.crv) {
    const liste = loeseAntworten(t, { ...basis, crv }, ids)
    const p = liste.filter((z) => z.gewaehlt).map((z) => z.gewaehlt.trefferquote)
    assert.deepEqual(p, [...p].sort((a, b) => a - b), `CRV ${crv}: sortiert nach nötiger Trefferquote`)
    for (const z of liste) if (z.gewaehlt) assert.equal(z.gewaehlt.crv, crv)
  }
  const klein = loeseAntworten(t, { ...basis, groesseMax: 50000 }, ids)
  assert.ok(klein.length > 0 && klein.every((z) => z.e.groesse <= 50000), 'Größenfilter bis 50K')
  const liste = loeseAntworten(t, basis, ids)
  const b = liste[0]
  const z = b.gewaehlt
  const detail = RWM.detailRueckwaerts(b.e.konto, z.trefferquote, z.crv, 5, z.risikoIndex, 6, 5000, 60)
  const darunter = RWM.detailRueckwaerts(b.e.konto, z.trefferquote - DARUNTER_PUNKTE / 100, z.crv, 5, z.risikoIndex, 6, 5000, 60)
  assert.ok(darunter.erreicht <= detail.erreicht + 1e-9, 'weniger Trefferquote erreicht das Ziel nicht öfter')
  for (const sprache of ['de', 'en']) {
    const html = render(h(RueckKlartext, { sprache, antworten: basis, bester: b, detail, darunter, onAndere: () => {} }))
    const texte = sprache === 'en'
      ? ['You want 5,000 USD paid out within 6 months, in 7 of 10 cases.', 'Then your strategy has to deliver this:', 'Win rate at least', 'at R:R 2', 'trades per week', 'Risk per trade', 'after costs', 'You reach it most easily at', 'Why there:', 'points lower', 'See other accounts']
      : ['Du willst in 6 Monaten 5.000 USD ausgezahlt bekommen, in 7 von 10 Fällen.', 'Dann muss deine Strategie das leisten:', 'Trefferquote mindestens', 'bei CRV 2', 'Trades pro Woche', 'Risiko je Trade', 'nach Kosten', 'Am leichtesten schaffst du das bei', 'Warum dort:', 'Punkte darunter', 'Andere Konten ansehen']
    for (const s of texte) assert.ok(html.includes(s), `${sprache}: fehlt ${s}`)
    assert.ok(html.includes(b.e.firma))
    ohneStrich(html, `Klartext ${sprache}`)
    ohneGlueck(html, `Klartext ${sprache}`)
    if (sprache === 'en') ohneDeutsch(html, 'Klartext en')
    const l = render(h(KontenListe, { sprache, liste, antworten: basis }))
    assert.ok(l.includes(b.e.firma) && (l.match(/class="rw-karte/g) || []).length === Math.min(8, liste.length))
    ohneGlueck(l, `Liste ${sprache}`)
    if (sprache === 'en') ohneDeutsch(l, 'Liste en')
  }
})

test('Messung: nur mit Einwilligung in „Analyse“, nur Sprache und Modus bzw. Ziel, nie Eingaben oder Ergebnisse', async () => {
  const M = await import('../components/prop-firm-rechner/messung.ts')
  const gesendet = []
  const sender = [(n, d) => gesendet.push(['vercel', n, d]), (n, d) => gesendet.push(['google', n, d])]
  for (const einwilligung of [null, undefined, { necessary: true, analytics: false, marketing: true }]) {
    assert.equal(M.messeMit(einwilligung, sender, 'de', { name: 'rechner_start' }), false)
  }
  assert.equal(gesendet.length, 0, 'ohne Einwilligung in Analyse geht nichts raus')
  const ja = { necessary: true, analytics: true, marketing: false }
  assert.equal(M.messeMit(ja, sender, 'en', { name: 'rechner_ergebnis', modus: 'rueckwaerts' }), true)
  assert.deepEqual(gesendet, [
    ['vercel', 'rechner_ergebnis', { modus: 'rueckwaerts', sprache: 'en' }],
    ['google', 'rechner_ergebnis', { modus: 'rueckwaerts', sprache: 'en' }],
  ])
  const fehler = () => {
    throw new Error('Netz weg')
  }
  assert.equal(M.messeMit(ja, [fehler, (n, d) => gesendet.push(['google', n, d])], 'de', { name: 'rechner_cta', ziel: 'etoro' }), true)
  assert.deepEqual(gesendet.at(-1), ['google', 'rechner_cta', { ziel: 'etoro', sprache: 'de' }], 'ein Fehler beim Senden stört nicht')
  const wiz = lese('../components/prop-firm-rechner/wizard.tsx').toString('utf8')
  assert.ok(wiz.includes("messe(sprache, { name: 'rechner_start' })"))
  assert.ok(wiz.includes("name: 'rechner_ergebnis', modus: pfad === 'rueck' ? 'rueckwaerts' : 'vorwaerts'"))
  const cta = lese('../components/prop-firm-rechner/cta-karte.tsx').toString('utf8')
  for (const ziel of ['x', 'youtube', 'substack', 'etoro']) assert.equal(cta.split(`onClick={klick('${ziel}')}`).length, 2, `CTA ${ziel} genau einmal`)
})

test('Verlauf: Browser-Zurück und „Zurück“ gehen einen Schritt, nur innerhalb der Fragen-Kette; fremde Einträge zählen nicht', async () => {
  const V = await import('../components/prop-firm-rechner/verlauf.ts')
  const s = (pfad, index, blatt = null) => ({ pfad, index, blatt })
  const kette = [s('rueck', 0), s('rueck', 1), s('rueck', 2), s('rueck', 3)]
  assert.equal(V.zielImVerlauf(kette, 3, s('rueck', 2)), 2)
  assert.equal(V.zielImVerlauf(kette, 3, s('rueck', 0)), 0)
  // Fertig-Schirm (Index 7) zurück zur letzten Frage (5): der Eintrag der Rechen-Animation wurde ersetzt
  const fertig = [s('rueck', 0), s('rueck', 1), s('rueck', 2), s('rueck', 3), s('rueck', 4), s('rueck', 5), s('rueck', 7)]
  assert.equal(V.zielImVerlauf(fertig, 6, s('rueck', 5)), 5)
  assert.equal(V.zielImVerlauf([s('rueck', 8), s('rueck', 8, 'andere')], 1, s('rueck', 8)), 0, 'Blatt schließen')
  assert.equal(V.zielImVerlauf([s('rueck', 0), s('rueck', 1), s('rueck', 8), s('vor', 0)], 3, s('rueck', 0)), -1, 'nach Wegwechsel nicht über das Ergebnis springen')
  assert.equal(V.zielImVerlauf([undefined, s('rueck', 2)], 1, s('rueck', 1)), -1, 'Lücke nach Neuladen: ersetzen')
  assert.deepEqual(V.verlaufAus({ pfr: { tiefe: 2, stand: s('vor', 1) }, __NA: true }), { tiefe: 2, stand: s('vor', 1) })
  const kaputt = [null, {}, { pfr: { tiefe: 'x', stand: s('rueck', 1) } }, { pfr: { tiefe: 1, stand: { pfad: 'seit', index: 1, blatt: null } } }, { pfr: { tiefe: 1, stand: s('rueck', 1, 'fremd') } }]
  for (const k of kaputt) assert.equal(V.verlaufAus(k), null)
})

test('Methode-Blatt erklärt den Rückwärts-Modus in beiden Sprachen, passend zum Raster', async () => {
  const { Hintergrund } = await import('../components/prop-firm-rechner/hintergrund.tsx')
  assert.equal(RW.trefferquoten.length, 29)
  assert.equal(RW.pfade, 300)
  assert.deepEqual(RW.risiko, [0.025, 0.05, 0.075, 0.1])
  assert.deepEqual(RW.monate, [1, 2, 3, 6, 12])
  assert.deepEqual(RW.tradesProWoche, [1, 2, 3, 4, 5, 7, 10, 15, 20])
  assert.deepEqual(RW.crv, [1, 1.5, 2, 2.5, 3, 4])
  assert.deepEqual([RW.ziele[0], RW.ziele.at(-1), RW.trefferquoten[0], RW.trefferquoten.at(-1)], [500, 50000, 0.1, 0.8])
  for (const sprache of ['de', 'en']) {
    const html = render(h(Hintergrund, { daten: DATEN, sprache }))
    const muss = sprache === 'en'
      ? ['From your goal (default).', '500 to 50,000 USD net', '1, 2, 3, 6 and 12 months', '1, 2, 3, 4, 5, 7, 10, 15 or 20 trades per week', 'R:R 1 : 1, 1 : 1.5, 1 : 2, 1 : 2.5, 1 : 3 and 1 : 4', '2.5, 5, 7.5 or 10% of the drawdown', '29 win rates from 10 to 80%', '300 paths', 'same random numbers', 'one account slot with rebuys', '“Take and go”', 'rounded up to a whole percent', 'is rounded down', '“5 points lower” is recomputed live', 'With your own numbers.']
      : ['Vom Ziel aus (Standard).', '500 bis 50.000 USD netto', '1, 2, 3, 6 und 12 Monaten', '1, 2, 3, 4, 5, 7, 10, 15 oder 20 Trades pro Woche', 'CRV 1 : 1, 1 : 1,5, 1 : 2, 1 : 2,5, 1 : 3 und 1 : 4', '2,5, 5, 7,5 oder 10 % des Drawdowns', '29 Trefferquoten von 10 bis 80 %', '300 Pfaden', 'denselben Zufallszahlen', 'Konto-Platz mit Nachkauf', '„Nimm und geh“', 'auf ganze Prozent aufgerundet', 'rundet er ab', 'rechnet er live in deinem Browser nach', 'Mit deinen eigenen Zahlen.']
    for (const s of muss) assert.ok(html.includes(s), `${sprache}: fehlt ${s}`)
    ohneGlueck(html, `Methode ${sprache}`)
    if (sprache === 'en') ohneDeutsch(html, 'Methode en')
  }
})

test('Cookie-Banner auf den Rechner-Seiten: klein oben, App rückt darunter, Ablehnen und Akzeptieren gleichwertig', () => {
  const src = lese('../components/ui/cookie-banner.tsx').toString('utf8')
  assert.match(src, /const compactLang = pathname === PFADE\.de \? 'de' : pathname === PFADE\.en \? 'en' : null/)
  assert.match(src, /onClick=\{onReject\} className=\{compactDecisionClass\}/)
  assert.match(src, /onClick=\{onAccept\} className=\{compactDecisionClass\}/)
  assert.match(src, /fixed inset-x-0 top-0 z-50/)
  assert.match(src, /setProperty\('--pfr-banner-h'/)
  for (const s of ['Google Analytics', 'Microsoft Clarity', 'Google Ads', 'in die USA', 'Jederzeit widerrufbar', 'transferred to the USA', 'withdraw at any time']) {
    assert.ok(src.includes(s), `Banner-Text: fehlt ${s}`)
  }
  const css = lese('../components/prop-firm-rechner/rechner.css').toString('utf8')
  assert.match(css, /max\(env\(safe-area-inset-top,0px\),var\(--pfr-banner-h,0px\)\)/)
  const wiz = lese('../components/prop-firm-rechner/wizard.tsx').toString('utf8')
  assert.ok(wiz.includes('onClick={openCookieSettings}'), 'Widerruf direkt aus der Fußzeile des Rechners')
})

test('Seiten-Metadaten: Titel und Beschreibung zum neuen Ablauf, eigenes OG-Bild je Sprache (1200 × 630)', () => {
  for (const [datei, bild, wort] of [
    ['../app/tools/prop-firm-rechner/page.tsx', '/images/og/prop-firm-rechner-de.png', 'Trefferquote'],
    ['../app/en/tools/prop-firm-calculator/page.tsx', '/images/og/prop-firm-rechner-en.png', 'win rate'],
  ]) {
    const src = lese(datei).toString('utf8')
    assert.ok(src.includes(bild) && src.includes('width: 1200, height: 630'), `${datei}: OG-Bild`)
    assert.ok(!src.includes('pat-banner.jpeg'), `${datei}: altes Bild`)
    assert.ok(src.includes(wort), `${datei}: Titel zum Ablauf`)
    const png = lese(`../public${bild}`)
    assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [1200, 630], `${bild}: Größe`)
  }
})

test('eToro: eigene Kontaktadresse statt Partnerbetreuung, Aktionslink B22508, Texte „schreib mir an“', async () => {
  const { ETORO_OFFER, ETORO_FAQ } = await import('../components/landing-v3/content.ts')
  const { CtaKarte } = await import('../components/prop-firm-rechner/cta-karte.tsx')
  assert.equal(ETORO_OFFER.supportEmail, 'kontakt@price-action-trader.de')
  assert.equal(ETORO_OFFER.href, 'https://med.etoro.com/B22508_A132628_TClick.aspx')
  assert.ok(ETORO_FAQ.a.includes(`schreib mir an ${ETORO_OFFER.supportEmail}`))
  const partner = lese('../components/landing-v3/sections/partner.tsx').toString('utf8')
  assert.ok(partner.includes('schreib mir an <a href={`mailto:${ETORO_OFFER.supportEmail}`}>'))
  for (const [sprache, satz] of [['de', 'schreib mir an'], ['en', 'email me at']]) {
    const html = render(h(CtaKarte, { sprache }))
    assert.ok(html.includes(satz) && html.includes('href="mailto:kontakt@price-action-trader.de"'), `${sprache}: Kontakt im Rechner`)
  }
  // nirgends mehr die Adresse der Partnerbetreuung oder der alte Link
  const { execFileSync } = await import('node:child_process')
  const treffer = (muster) => {
    try {
      return execFileSync('git', ['grep', '-n', '-I', '-i', muster, '--', 'components', 'app', 'lib', 'public', 'docs'], { cwd: new URL('..', import.meta.url), encoding: 'utf8' })
        .split('\n').filter((z) => z && !z.startsWith('lib/prop-firm-rechner.test.mjs'))
    } catch {
      return []
    }
  }
  assert.deepEqual(treffer('B22479'), [], 'alter Aktionslink')
  assert.deepEqual(treffer('@etoro.com'), [], 'Adresse bei eToro')
})

test('Regler: rastet im Rückwärts-Modus auf dem Raster ein, stufenlos vorwärts; Wert in Worten für Screenreader', async () => {
  const { Regler, naechsteStufe } = await import('../components/prop-firm-rechner/regler.tsx')
  assert.deepEqual(RW.tradesProWoche, [1, 2, 3, 4, 5, 7, 10, 15, 20])
  assert.deepEqual(RW.crv, [1, 1.5, 2, 2.5, 3, 4])
  assert.equal(naechsteStufe(RW.tradesProWoche, 6), 4, 'zwischen zwei Stufen: die nähere (5)')
  assert.equal(naechsteStufe(RW.crv, 3.6), 5)
  const gestuft = render(h(Regler, {
    label: 'Trades pro Woche', wert: 7, stufen: RW.tradesProWoche, anzeige: String, einheit: 'pro Woche',
    sprechText: (x) => `${x} Trades pro Woche`, marken: RW.tradesProWoche.map((x) => ({ wert: x, text: String(x) })), onChange: () => {},
  }))
  const input = gestuft.match(/<input[^>]*>/)[0]
  for (const a of ['type="range"', 'min="0"', 'max="8"', 'step="1"', 'value="5"', 'aria-valuetext="7 Trades pro Woche"']) assert.ok(input.includes(a), `gestuft: ${a}`)
  const id = input.match(/id="([^"]+)"/)[1]
  assert.ok(gestuft.includes(`<label for="${id}">Trades pro Woche</label>`), 'Beschriftung gehört zum Regler')
  assert.equal((gestuft.match(/<span style="--f:/g) || []).length, 9, 'eine Marke je Rasterwert')
  const frei = render(h(Regler, {
    label: 'CRV', wert: 2.3, min: 0.5, max: 5, schritt: 0.1, anzeige: (x) => `1 : ${x}`, sprechText: (x) => `CRV 1 zu ${x}`,
    marken: [0.5, 1, 2, 3, 4, 5].map((x) => ({ wert: x, text: String(x) })), onChange: () => {},
  }))
  const input2 = frei.match(/<input[^>]*>/)[0]
  for (const a of ['min="0.5"', 'max="5"', 'step="0.1"', 'value="2.3"', 'aria-valuetext="CRV 1 zu 2.3"']) assert.ok(input2.includes(a), `stufenlos: ${a}`)
  // im Ablauf: beide Fragen in beiden Modi als Regler, vorwärts mit Eingabefeld
  const wiz = lese('../components/prop-firm-rechner/wizard.tsx').toString('utf8')
  assert.equal((wiz.match(/<Regler\b/g) || []).length, 3, 'Rückwärts: Trades und CRV; vorwärts: ein gemeinsamer Baustein mit Feld')
  assert.ok(wiz.includes('stufen={RW.tradesProWoche}') && wiz.includes('stufen={RW.crv}'))
  assert.ok(wiz.includes('const VOR_TPW = { min: 1, max: 25, schritt: 1'))
  assert.ok(wiz.includes('const VOR_CRV = { min: 0.5, max: 5, schritt: 0.1'))
  assert.ok(wiz.includes("reglerMitFeld('crv'") && wiz.includes("reglerMitFeld('tradesProWoche'"))
  const css = lese('../components/prop-firm-rechner/rechner.css').toString('utf8')
  assert.match(css, /\.regler\{--daumen:44px/, 'Daumen mit 44 px Trefferfläche')
})

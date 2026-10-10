import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { registerHooks } from 'node:module'
import { gunzipSync } from 'node:zlib'

// Prop-Firm-Rechner: Parität des TS-Kerns mit dem Python-Referenz-Simulator (Fassung 3.2.1) auf festen,
// synthetischen Trade-Strömen, dazu Generator, Simulation und Datenhygiene.
// Die TS-Module importieren einander ohne Dateiendung (wie im Next-Build); hier lösen Hooks .ts/.tsx und '@/' auf,
// .tsx übersetzt TypeScript (für den Render-Test), JSON und CSS werden als Module geladen.
const WURZEL = new URL('../', import.meta.url)
const ts = (await import('typescript')).default
registerHooks({
  resolve(spec, ctx, next) {
    const ziel = spec.startsWith('@/') ? new URL(spec.slice(2), WURZEL).href : spec
    try {
      return next(ziel, ctx)
    } catch (err) {
      if ((ziel.startsWith('.') || ziel.startsWith('file:')) && !/\.[a-z]+$/i.test(ziel)) {
        for (const endung of ['.ts', '.tsx']) {
          try {
            return next(`${ziel}${endung}`, ctx)
          } catch {
            // nächste Endung
          }
        }
      }
      throw err
    }
  },
  load(url, ctx, next) {
    if (url.endsWith('.tsx')) {
      const quelle = readFileSync(new URL(url), 'utf8')
      const js = ts.transpileModule(quelle, {
        fileName: url,
        compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
      }).outputText
      return { format: 'module', source: js, shortCircuit: true }
    }
    if (url.endsWith('.json') && !ctx.importAttributes?.type) {
      return { format: 'module', source: `export default ${readFileSync(new URL(url), 'utf8')}`, shortCircuit: true }
    }
    if (url.endsWith('.css')) return { format: 'module', source: 'export {}', shortCircuit: true }
    return next(url, ctx)
  },
})

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

test('Simulation: Eingaben ohne Kante -> Zwilling identisch (Glücksvergleich rechnet richtig)', () => {
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

// ------------------------------------------------------------------------------------------- Render-Test
test('Render: Rechner, Ergebnisse, Details und Hintergrund rendern ohne Fehler (react-dom/server)', async () => {
  const React = (await import('react')).default
  const { renderToString } = await import('react-dom/server')
  const { PropFirmRechner } = await import('../components/prop-firm-rechner/rechner.tsx')
  const { Ergebnisse } = await import('../components/prop-firm-rechner/ergebnisse.tsx')
  const { Details } = await import('../components/prop-firm-rechner/details.tsx')
  const { Hintergrund } = await import('../components/prop-firm-rechner/hintergrund.tsx')
  const h = React.createElement
  const render = (el) => renderToString(el).replaceAll('<!-- -->', '')
  const ohneStrich = (html, wo) => assert.ok(!/[\u2013\u2014]/.test(html), `${wo}: Gedankenstrich im Text`)

  const start = render(h(PropFirmRechner))
  for (const t of ['Trefferquote', 'Trades pro Woche', 'Nimm und geh', 'Cash-Cow', 'Hybrid', 'Ich handle mit einem Bot', 'Erwartung je Trade']) {
    assert.ok(start.includes(t), `Startansicht ohne „${t}“`)
  }
  ohneStrich(start, 'Startansicht')

  const alle = EINTRAEGE.flatMap((e) => e.rechnungen.map((r) => ({ schluessel: AUS.schluesselFuer(e.id, r.name), konto: r.konto })))
  for (const politik of ['A', 'C']) {
    const einst = { ...EINST, politik, politikFaktor: 2, botBetrieb: politik === 'C' }
    const roh = SIM.simuliere(alle, einst, 0, 20)
    const html = render(h(Ergebnisse, { ergebnis: { roh, einst, pfade: 20, dauerMs: 1, formSchl: '' }, eintraege: EINTRAEGE, daten: DATEN, veraltet: false }))
    for (const t of ['So sähe es mit reinem Glück aus', 'Wie sicher ist deine Kante?', 'Die drei besten Kontotypen', 'Platz 1', 'Alle Kontotypen', 'Kante 0']) {
      assert.ok(html.includes(t), `Ergebnis (${politik}) ohne „${t}“`)
    }
    assert.ok(!/NaN|undefined|Infinity/.test(html), `Ergebnis (${politik}) enthält NaN/undefined`)
    const zeilen = (html.match(/<tr class="zeile/g) || []).length
    const erwartet = EINTRAEGE.filter((e) => e.aktiv && !(einst.botBetrieb && e.botAusschluss)).length
    assert.equal(zeilen, erwartet, `Tabellenzeilen ${zeilen} statt ${erwartet}`)
    ohneStrich(html, `Ergebnis ${politik}`)
    const zeilenObj = AUS.baueZeilen(EINTRAEGE, roh, einst.botBetrieb)
    for (const z of zeilenObj) {
      const d = render(h(Details, { zeile: z, daten: DATEN, botBetrieb: einst.botBetrieb }))
      assert.ok(d.includes('Quellen') && d.includes('Regeln'), `Details ${z.eintrag.id}`)
      assert.ok(!/NaN|undefined/.test(d), `Details ${z.eintrag.id} enthält NaN/undefined`)
      ohneStrich(d, `Details ${z.eintrag.id}`)
    }
  }

  const hg = render(h(Hintergrund, { daten: DATEN }))
  for (const t of ['So rechnet der Rechner', 'Regelstand und Quellen', '09.10.2026', 'Keine Finanzberatung', 'Regeln ändern sich', 'Topstep', 'Vest']) {
    assert.ok(hg.includes(t), `Hintergrund ohne „${t}“`)
  }
  const links = [...hg.matchAll(/href="([^"]+)"/g)].map((m) => m[1])
  assert.ok(links.length >= 100, `nur ${links.length} Quellen-Links`)
  for (const l of links) assert.ok(!/[?&](ref|aff|affiliate|via|utm_[a-z]+|coupon|code)=/i.test(l), `Werbe-Parameter im Link ${l}`)
  ohneStrich(hg, 'Hintergrund')
})

test('React-Schlüssel eindeutig: Quellenliste je Firma (gleiche URL unter zwei IDs) und Detail-Listen', async () => {
  const { quellenJeFirma } = await import('../components/prop-firm-rechner/hintergrund.tsx')
  const T = await import('../components/prop-firm-rechner/texte.ts')
  const dopp = (liste) => liste.filter((x, i) => liste.indexOf(x) !== i)
  let doppelteUrl = 0
  for (const { firma, quellen } of quellenJeFirma(DATEN)) {
    assert.deepEqual(dopp(quellen.map((q) => q.id)), [], `${firma}: doppelte Quellen-ID`)
    doppelteUrl += dopp(quellen.map((q) => q.url)).length
  }
  assert.ok(doppelteUrl > 0, 'Regressionsfall fehlt: dieselbe URL unter zwei Quellen-IDs (Topstep Labs)')
  assert.ok(lese('../components/prop-firm-rechner/hintergrund.tsx').toString('utf8').includes('<li key={q.id}>'), 'Quellenliste muss die Quellen-ID als Schlüssel nutzen')
  for (const e of EINTRAEGE) {
    for (const bot of [false, true]) {
      assert.deepEqual(dopp(T.kostenSaetze(e.konto, bot)), [], `${e.id}: doppelter Kosten-Satz`)
      for (const r of e.rechnungen) assert.deepEqual(dopp(T.regelSaetze(r.konto).map((p) => p.titel)), [], `${e.id}: doppelter Phasen-Titel`)
    }
    assert.deepEqual(dopp(e.quellen), [], `${e.id}: doppelte Quelle`)
    assert.deepEqual(dopp(e.aktionen.map((a) => a.name)), [], `${e.id}: doppelte Aktion`)
    assert.deepEqual(dopp(e.konto.ko_kriterien.map(([c]) => c)), [], `${e.id}: doppeltes K.-o.-Kriterium`)
    assert.deepEqual(dopp(e.rechnungen.map((r) => r.name)), [], `${e.id}: doppelte Variante`)
  }
})

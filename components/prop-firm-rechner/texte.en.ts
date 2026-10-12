/**
 * Prop firm calculator, English dictionary. Same shape as texte.de.ts (type Woerterbuch).
 * Rules: address the reader as "you", no en or em dashes (U+2013, U+2014), no profit promises.
 * The rule file (lib/prop-firm/daten) is written in German; everything from it that reaches the page is translated here
 * (rule variants, promotions, source titles, field names, codes). Tests check that the English page has no German left.
 */
import type { Konto, Phase } from '@/lib/prop-firm/kern'
import { feldText } from '@/lib/prop-firm/konten'
import { formatierer } from './format'
import type { Quellenzeile, Woerterbuch } from './texte.de'

const f = formatierer('en')
const { usd } = f

const DD_ART: Record<string, string> = {
  eod_trailing: 'trailing at end of day',
  intraday_trailing: 'trailing in real time',
  statisch: 'static',
  keiner: 'none',
}

function phaseName(p: Phase, i: number, k: Konto): string {
  if (p.typ === 'eval') {
    const n = k.phasen.filter((x) => x.typ === 'eval').length
    return n > 1 ? `Evaluation, step ${p.stufe}` : 'Evaluation'
  }
  return i === 0 ? 'Funded (instant, no evaluation)' : 'Funded'
}

function dllText(p: Phase): string | null {
  if (p.dll_betrag === null && p.dll_anteil === null) return null
  let b: string
  if (p.dll_stufen && p.dll_stufen.length) b = `${usd(p.dll_betrag)}, rises with the balance`
  else if (p.dll_anteil !== null) b = `${f.prozent(p.dll_anteil * 100)} of the ${p.dll_anteil_bezug === 'tagesbeginn' ? 'balance at the start of the day' : 'starting balance'}`
  else b = usd(p.dll_betrag)
  const w = p.dll_wirkung === 'tagessperre' ? 'soft: trading locked for the rest of the day' : 'hard: account lost'
  return `Daily loss limit ${b} (${w})`
}

function regelSaetze(k: Konto): { titel: string; saetze: string[] }[] {
  return k.phasen.map((p, i) => {
    const s: string[] = []
    if (p.typ === 'eval' && p.ziel !== null) s.push(`Profit target ${usd(p.ziel)}`)
    if (p.dd_art !== 'keiner' && p.dd_betrag !== null) {
      let t = `Drawdown ${usd(p.dd_betrag)}, ${DD_ART[p.dd_art] ?? p.dd_art}`
      if (p.lock !== null && p.dd_art !== 'statisch') {
        const ueber = p.lock - p.start
        t += ueber === 0 ? ', trails only up to the starting balance' : `, trails only up to start ${usd(ueber, true)}`
      }
      s.push(t)
    }
    const d = dllText(p)
    if (d) s.push(d)
    if (p.cons_anteil) s.push(`Consistency: best day at most ${f.prozent(Math.round(p.cons_anteil * 100))} of total profit (otherwise the target rises)`)
    if (p.min_tage) s.push(`at least ${p.min_tage} trading days`)
    if (p.max_tage) s.push(`time limit ${p.max_tage} calendar days`)
    if (p.max_micro !== null || p.max_mini !== null) s.push(`at most ${p.max_mini ?? f.ka} minis or ${p.max_micro ?? f.ka} micros${p.skalierung ? ' (scaling plan by balance)' : ''}`)
    if (p.hebel) s.push(`leverage up to ${p.hebel}x`)
    if (p.inaktiv_art === 'kalenderwoche') s.push('at least one trade per calendar week')
    else if (p.inaktiv_tage) s.push(`at most ${p.inaktiv_tage} days without a trade`)
    const a = p.ausz
    if (a) {
      const t: string[] = [`split ${f.prozent(Math.round(a.split * 100))} to you`]
      if (a.gewinntage) t.push(`${a.gewinntage} winning days${a.min_tagesgewinn ? ` of at least ${usd(a.min_tagesgewinn)}` : ''} per payout`)
      if (a.handelstage) t.push(`${a.handelstage} trading days per payout`)
      if (a.erste_ab_tag) t.push(`first payout after ${a.erste_ab_tag} days at the earliest`)
      if (a.kalendertage) t.push(`${a.kalendertage} days between payouts`)
      if (a.puffer) t.push(`buffer of ${usd(a.puffer)} stays in the account`)
      if (a.max_anteil !== null && a.max_anteil < 1) t.push(`at most ${f.prozent(Math.round(a.max_anteil * 100))} of profit`)
      if (a.max_betrag && a.max_betrag.length) t.push(`at most ${a.max_betrag.map((x) => usd(x)).join(' / ')} per payout`)
      if (a.min_betrag) t.push(`at least ${usd(a.min_betrag)}`)
      if (a.cons_anteil) t.push(`consistency ${a.cons_anteil.map((x) => f.prozent(Math.round(x * 100))).join(' / ')}`)
      if (a.max_anzahl) t.push(`after ${a.max_anzahl} payouts ${a.ende_nach_max === 'geschlossen' ? 'the account is closed' : 'move to a live account'}`)
      if (a.max_summe_brutto) t.push(`move to a live account after ${usd(a.max_summe_brutto)} in payouts`)
      if (a.lebenszeit_deckel) t.push(`at most ${usd(a.lebenszeit_deckel)} in total`)
      s.push(`Payout: ${t.join(', ')}`)
    }
    return { titel: phaseName(p, i, k), saetze: s }
  })
}

function kostenSaetze(k: Konto, botBetrieb: boolean): string[] {
  const s: string[] = []
  if (k.preis === null) s.push('Price: not published by the firm')
  else s.push(`Price ${usd(k.preis)} ${k.rhythmus === 'monatlich' ? 'per month until you pass' : 'one-time'}`)
  if (k.aktivierung) s.push(`Activation ${usd(k.aktivierung)}`)
  if (k.reset !== null) s.push(`Reset ${usd(k.reset)}${k.reset_setzt_abo_zurueck ? ' (moves the subscription date by 30 days)' : ''}`)
  for (const [name, betrag, nurBot] of k.fixkosten) {
    if (betrag && (botBetrieb || !nurBot)) s.push(`${name}: ${usd(betrag)} per month${nurBot ? ' (bot only)' : ''}`)
  }
  if (k.auszahlung_gebuehr) s.push(`Fee per payout ${usd(k.auszahlung_gebuehr)}`)
  return s
}

// ------------------------------------------------------------------ Texts from the (German) rule file
const REGEL_VARIANTEN: Record<string, string> = {
  dll_hart: "Daily loss limit hard instead of soft (firm’s statement unclear)",
  hebel_5x: "Leverage 5x instead of 50x (firm’s statements contradict each other)",
  micro_x10: "Micro limit 50 instead of 5 (firm’s statement unclear)",
  mindestbetrag_250: "Minimum payout 250 USD (firm’s statement unclear)",
  preis_349: 'Price 349 instead of 449 USD (the firm states two prices)',
  puffer_0: "Payout down to the floor without a standing buffer (firm’s statement unclear)",
}

/** German parts inside account variant names (the rest is the firms’ own English wording). */
const VARIANTEN_TEILE: [string, string][] = [
  ['V2 (ab 27.08.2026)', 'V2 (from Aug 27, 2026)'],
  ['($4,000 Ziel, ohne Consistency)', '($4,000 target, no consistency)'],
  ['(Kauf nach 12.09.2025 bzw. neue Risikoparameter)', '(bought after Sep 12, 2025, or new risk parameters)'],
  ['(1-Step, fixe Auszahlungspolitik)', '(1-Step, fixed payout policy)'],
]

/** Source titles with German parts, by source ID. All others are the firms' English page titles. */
const QUELLEN_TITEL: Record<string, string> = {
  MF01: 'MyFundedFutures Help Center (home page and collections)',
  MF46: 'myfundedfutures.com (home page, /plans/*, /challenge, /terms, /cancellation)',
  MF90: 'Third-party source proptradingvibes: MyFundedFutures Pricing',
  MF92: 'Third-party source eltraderfinanciado: MFFU launches Rapid EOD 50K (Aug 2026)',
  MF94: 'myfundedfutures.com/ (FIND YOUR PLAN section, all size tabs)',
  MP01: 'MyFundedPerps Docs: index (llms.txt) and home page',
  MP18: 'Public market API (live): market list',
  MP19: 'OpenAPI (beta) and API reference get-a-challenge-account / trading-policy',
  MP21: 'Press release (GlobePRWire) Oct 3, 2026: MyFundedPerps Expands Prop Trading Beyond Crypto',
  MP25: 'Third-party site perpsmatch (as of Oct 7, 2026)',
  MP26: 'Third-party site comparefuturesprop (rules as of Sep 29, 2026)',
  MP27: 'Third-party site propfirmaudit (Oct 3, 2026)',
  MP28: 'Third-party site Phidias (competitor, Sep 14, 2026)',
  MP29: 'Third-party site The Prop Journalist (Sep 10, 2026)',
  MP30: 'myfundedperpetuals.com/ (Choose Your Challenge section)',
  TF01: 'Tradeify home page',
  TS10: "Scaling plan chart 'XFA charts - hc.png' (embedded in TS09)",
  TS23: 'Topstep Prop (pricing and account page)',
  TS28: 'Topstep Labs (also intercom.help/topstep-llc/en/articles/15520357)',
  TS45: 'Topstep Labs (home page)',
  VE01: 'Vest Capital plan API (public, GET without login)',
  VE03: 'Vest Capital limits API (public)',
  VE16: 'Vest exchangeInfo API (reference data only, no prices requested)',
  VE17: 'Vest Markets home page',
  VE18: 'Vest Docs: home page and index (docs.vestmarkets.com/home, llms.txt)',
}

/** feldText (German label of a rule path) -> English label. */
const FELD: Record<string, string> = {
  Preis: 'Price',
  Aktivierungsgebühr: 'Activation fee',
  Reset: 'Reset',
  Gewinnziel: 'Profit target',
  Startsaldo: 'Starting balance',
  'Wann der Drawdown greift': 'When the drawdown is breached',
  Drawdown: 'Drawdown',
  Tagesverlustgrenze: 'Daily loss limit',
  'Consistency-Regel': 'Consistency rule',
  Auszahlungsregel: 'Payout rule',
  Kontraktgrenze: 'Contract limit',
  Hebel: 'Leverage',
  Mindesthandelstage: 'Minimum trading days',
  Zeitlimit: 'Time limit',
  Inaktivität: 'Inactivity',
}

const KO: Record<string, string> = {
  bot_nur_eigenes_geraet: 'Bots only from your own device (no VPS)',
  live_keine_automatisierung: 'No automation in the live account',
  hft_simfill_ausnutzen: "HFT or exploiting simulated fills is prohibited (firm’s discretion)",
  news_t1_flat_funded: 'Be flat in the funded account around major economic releases',
  positionsgroesse_realistisch: 'Position size must be “realistic” (firm’s discretion)',
  exposure_cap_gemeinsam: 'Shared position limit across similar accounts',
  bot_eigenentwicklung_video: 'Bots only if you built them yourself, proof by video',
  microscalping: "Microscalping is prohibited (firm’s discretion)",
  kein_api_handel: 'No API trading: excluded for bots',
}

const VERBOT: Record<string, string> = {
  gambling: 'gambling behavior',
  max_risiko_je_trade: 'maximum risk per trade',
  windfall: 'windfall profits',
  kopierhandel: 'copy trading',
  hedging: 'hedging',
  hft: 'high-frequency trading',
  news: 'news trading',
  sonstige: 'other',
}

const BOT: Record<string, string> = {
  geeignet: 'allowed',
  bedingt: 'allowed with conditions',
  ungeeignet: 'not allowed',
  unklar: 'not clearly regulated',
}

/** Reasons from the simulation core why an account type cannot be computed. */
const GRUND: Record<string, string> = {
  'Preis unbekannt': 'price unknown',
}

function aktion(a: { name: string; text: string }): string {
  const betrag = Number(/(\d+(?:\.\d+)?)\s*USD/.exec(a.text)?.[1])
  if (a.name === 'aktionspreis' && Number.isFinite(betrag)) return `Promo price ${usd(betrag)} (limited time, not included)`
  if (a.name === 'aktion_doppeldeckel' && Number.isFinite(betrag)) return `Double payout cap ${usd(betrag)} as a promotion the firm can withdraw (not included)`
  return 'Promotion (not included)'
}

export const en: Woerterbuch = {
  sprache: 'en',
  f,
  regelSaetze,
  kostenSaetze,

  politik: {
    A: { name: 'Take and go', kurz: 'Take every possible payout right away, in full. If the account dies afterwards, buy a new one.' },
    B: { name: 'Cash cow', kurz: 'Only withdraw what sits above a standing cushion. The account should live long and pay regularly.' },
    C: { name: 'Hybrid', kurz: 'Like “Take and go” until the cushion has been built once. Then like “Cash cow”.' },
  },

  seite: {
    markeLabel: 'Price Action Trader, back to top',
    markeHref: '#top',
    sprachwahl: 'Language',
    kopfKnopf: 'Research log',
    kopfKnopfHref: '#research-log',
    kicker: 'Free tool · runs in your browser',
    titelDim: 'Prop firm calculator.',
    titel: 'Which firm fits your trades?',
    lead: (anzahl: number) =>
      `Enter your win rate and your average win and loss in R. The calculator plays thousands of trading years against the rules of ${anzahl} ` +
      'account types, with every fee, and puts next to it what the same accounts would return without an edge.',
    sprungRechner: 'Go to the calculator',
    aufEinenBlick: 'At a glance',
    eckdaten: (anzahl: number, firmen: readonly string[], stand: string) => [
      { wert: `${anzahl} account types`, text: firmen.join(', ') },
      { wert: stand, text: 'Rules as of this date, each rule with a source' },
      { wert: 'Zero-edge comparison', text: 'The same run with zero edge, side by side' },
      { wert: 'In your browser', text: 'Your inputs never leave your device' },
    ],
  },

  beispiel: {
    aria: 'Example result with the starting values',
    marke: 'Example',
    kopf: 'With the starting values below',
    annahmen: (z: { trefferquote: number; gewinnR: number; verlustR: number; tradesProWoche: number; risikoUsd: number }) =>
      `${f.prozent(z.trefferquote)} win rate · avg. win ${f.zahlText(z.gewinnR, 1)} R · avg. loss ${f.zahlText(z.verlustR, 1)} R · ` +
      `${f.zahlText(z.tradesProWoche, 1)} trades per week · ${usd(z.risikoUsd)} risk per trade`,
    besterTyp: 'Best account type',
    proMonat: 'per month after all fees',
    mitKante: 'With these numbers',
    ohneKante: 'Without an edge',
    abstand: (b: string) => `Gap that comes from the edge: ${b} per month`,
    rechnet: 'Calculating in your browser …',
    abgebrochen: 'The result for your numbers is below.',
    fuss: 'Simulation, not a forecast.',
    link: 'Enter your own numbers',
  },

  eingaben: {
    titel: 'Your inputs',
    trades: 'Your trades',
    trefferquote: 'Win rate',
    gewinn: 'Avg. win',
    verlust: 'Avg. loss',
    rHinweis: 'In R after fees and slippage. 1 R = your risk per trade.',
    tradesProWoche: 'Trades per week',
    gewinner: 'Winners',
    streuung: { gleich: 'all similar', gemischt: 'mixed', wenige_grosse: 'few big ones' },
    streuungHilfe: 'Same average, different spread: “few big ones” means many small winners and the occasional outlier.',
    groesse: 'Position size',
    groesseUeber: 'Set size by',
    modus: { risiko: 'Risk in USD', kontrakte: 'Contracts', dd_anteil: 'Share of drawdown' },
    risiko: 'Risk per trade',
    kontrakte: 'Contracts per trade',
    ddAnteil: 'Risk per trade as a share of the drawdown',
    ddHilfe: 'Scales the size to every account size automatically. 10% means ten losers in a row use up the drawdown.',
    instrument: 'Instrument',
    stopp: 'Stop',
    punkte: 'points',
    futuresHinweis: (k: number, instrument: string, echt: string, perp: string) =>
      `Futures: ${k} ${instrument} per trade (${echt} actual risk, whole contracts, capped by the firm’s limits). Perps: ${perp}.`,
    kontrakteHinweis: (risiko: string) => `= ${risiko} risk per trade (perps use the same amount).`,
    keinKontrakt: 'With this risk and stop, not even one contract fits. Futures accounts will not trade at all.',
    rahmen: 'Payout path and setup',
    weg: 'Payout path',
    polster: 'Cushion',
    polsterOptionen: { '1': '1x drawdown', '2': '2x drawdown' },
    bot: 'I trade with a bot (API)',
    botHilfe: "Adds API fees and hides firms that don’t allow bots.",
    perp: 'Include extra perp costs',
    perpHilfe: "Spread 0.5 points, funding 10% a year, the firm’s commission (Vest, MyFundedPerps).",
    genauigkeit: 'Precision',
    pfade: { '300': 'fast', '1000': 'precise', '3000': 'very precise' },
    pfadeHilfe: (n: string) => `${n} simulated years per account type, each with and without edge.`,
    erwartung: 'Expectancy per trade',
    streuungJeTrade: 'Standard deviation per trade',
    belegTitel: 'Evidence for an edge',
    beleg: (n: string) => `about ${n} trades`,
    belegText: 'is what it takes to tell this edge apart from zero with confidence.',
    keineKante: 'Without a positive expectancy there is no edge. Any profit would not come from your trades.',
    keineKanteWert: 'no edge',
    bittePruefen: 'Please check:',
    fehler: {
      trefferquote: 'Win rate between 1 and 99%',
      gewinn: 'Average win above 0 and at most 20 R',
      verlust: 'Average loss above 0 and at most 5 R',
      trades: 'Trades per week between 0.2 and 60',
      stopp: 'Stop between 1 and 500 points',
      risiko: 'Risk per trade between 1 and 100,000 USD',
      kontrakte: 'Contracts as a whole number from 1 to 200',
      dd: 'Share of drawdown between 1 and 100%',
    },
    berechnen: 'Calculate',
    neuStarten: 'Restart',
    fortschritt: (a: string, b: string) => `Simulating ${a} of ${b} years …`,
    veraltet: 'Inputs changed. Calculate again for new numbers.',
    fertig: (pfade: string, varianten: number, sekunden: string) =>
      `Done: ${pfade} years × ${varianten} rule variants in ${sekunden} s, right in your browser.`,
    fehlerPrefix: 'Error:',
    workerAbbruch: 'The background calculation stopped.',
  },

  ergebnis: {
    titel: 'Your results.',
    titelZusatz: 'Calculated honestly.',
    groessen: { k10: 'up to 10K', k25: '20K to 25K', k50: '50K', k100: '100K', k150: '150K and up' },
    unter: (pfade: string, weg: string, faktor: number | null, bot: boolean) =>
      `${pfade} simulated years per account type, payout path “${weg}”${faktor ? ` with a ${faktor}x drawdown cushion` : ''}` +
      `${bot ? ', trading by bot' : ''}. Net per month means: all payouts after the split minus all fees (purchase, subscription, ` +
      'reset, activation, fixed costs) over twelve months, buying again after every lost account.',
    ohneKanteTitel: 'What it would look like without an edge',
    bestMitWerten: 'Best account type with your numbers',
    keinerMitPreis: 'none with a known price in this selection',
    proMonatKurz: '/ month',
    bestNull: 'Best account type with zero edge',
    bestNullKlein: 'same trades and spread, expectancy per trade exactly zero',
    mittelNull: (n: number) => `Average over all ${n} account types with zero edge`,
    mittelNullKlein: 'Without a real edge, the fees are lost across many accounts.',
    urteil: {
      keinPreis: 'No account type in this selection has a known price.',
      keineKante: 'Your inputs have no positive edge. Whatever shows a profit here does not come from your trades. Across many accounts, the fees are lost.',
      nichtBesser: 'Your best value is not above the best value without an edge. With these inputs, the result cannot be told apart from zero edge.',
      abstand: (betrag: string) =>
        `Your best account type is ${betrag} per month above the best account type without an edge. Only this gap comes from your ` +
        'edge, and only if your win rate and R values are right.',
      nullPlus:
        ' That an account type is slightly positive even with zero edge comes from the simplified assumptions (instant payout, ' +
        "no rejection by the firm) and the simulation’s noise, not from a strategy.",
    },
    sicherTitel: 'How certain is your edge?',
    sicherText: (erw: string, sd: string) => `Your inputs give ${erw} per trade with a standard deviation of ${sd}.`,
    sicherBand: (lo: string, hi: string, n: string) =>
      ` Estimated from 100 trades, the true expectancy could be anywhere between ${lo} and ${hi}. Only from about ${n} trades is ` +
      'it above zero with 95% confidence.',
    sicherOhne: ' Without a positive expectancy, no profit comes from your trades. Across many accounts, the fees are lost.',
    schaetzung:
      'Your win rate and R values are estimates themselves. If they come from a few trades or from a backtest picked for its ' +
      'result, part of it comes from the selection, not from a real edge. The calculator can only be as good as these numbers.',
    topTitel: 'The three best account types for your inputs',
    topUnter:
      "Sorted by net per month, using the more cautious reading when a firm’s rule is unclear. The best value out of many account " +
      'types is always estimated a little too high: the simulation has noise too (± figure).',
    platz: (i: number) => `Rank ${i}`,
    proMonatPlusMinus: (x: string) => `per month, ± ${x} USD`,
    bestehen60: 'Pass within 60 trading days',
    ohnePruefung: 'no evaluation',
    ausz6: 'First payout within 6 months',
    mitNull: 'With zero edge',
    gesprengt12: 'Blown within 12 months',
    gerechnetMit: (v: string) => `Calculated with: ${v}.`,
    alleTitel: 'All account types',
    angezeigt: (a: number, b: number, bot: number) =>
      `${a} of ${b} account types selected${bot ? `, ${bot} hidden (firm does not allow bots)` : ''}. Tap a row for rules, costs and sources.`,
    firmen: 'Firms',
    kontogroesse: 'Account size',
    nurAktiv: 'currently offered only',
    scrollHinweis: 'Swipe the table sideways to see all columns.',
    spalten: {
      name: 'Account type',
      preis: 'Price',
      fk30: 'Pass ≤ 30 TD',
      fk30Titel: 'Share of purchases that pass the evaluation within 30 trading days',
      fk60: '≤ 60 TD',
      fk90: '≤ 90 TD',
      ausz6: '1st payout ≤ 6 mo.',
      ausz6Titel: 'One purchase: share with a first payout within 6 months',
      median: 'TD to 1st payout',
      medianTitel: 'Median trading days from purchase, only purchases with a payout',
      bruch: 'Blown',
      bruchTitel: 'One purchase: share of accounts lost within 12 months',
      netto: 'Net / month',
      nettoTitel: 'One account slot over 12 months with rebuys, all fees. Below: 10% to 90% of years',
      null: 'Zero edge',
      nullTitel: 'The same without an edge: expectancy per trade zero',
    },
    mehr: (n: number) => `Show all ${n} account types`,
    weniger: (n: number) => `Show only the first ${n}`,
    leer: 'No account types in this selection.',
    marken: {
      perps: 'Perps',
      ohnePruefung: 'no evaluation',
      stufen: (n: number) => `${n}-step evaluation`,
      regelOffen: 'rule unclear',
      aktion: 'promo',
      nichtAngeboten: 'no longer offered',
      preisUnbekannt: 'price unknown',
      wegA: 'path A used',
      nichtRechenbar: 'cannot be computed',
    },
    preisMonat: ' / month',
    aktivierung: (b: string) => `+ ${b} activation`,
    spanne: (lo: string, hi: string) => `${lo} to ${hi}`,
    vorsichtig: (b: string) => `cautious ${b}`,
    preisUnbekannt: 'price unknown',
    legende:
      'TD = trading days from purchase. Grey: not ranked (no longer offered, price unknown or excluded for bots). ' +
      '“Rule unclear”: the firm states two values; the ranking uses the less favorable one.',
    nichtGerechnet: (liste: string) => `Not calculated: ${liste} (special rules the calculator does not model).`,
  },

  details: {
    regeln: 'Rules',
    live: 'A later live account is not simulated (the account slot ends there and is bought again).',
    kosten: 'Costs',
    weitere: 'More figures',
    bestanden12: (p: string, median: string | null) => `Passed within 12 months: ${p}, median ${median !== null ? `${median} trading days` : f.ka}`,
    bruchEval: (p: string) => `Blown during the evaluation: ${p}`,
    ausz12: (p: string) => `First payout within 12 months (one purchase): ${p}`,
    kAusz6: (p: string) => `First payout within 6 months with rebuys: ${p}`,
    jahrePlus: (p: string) => `Years in profit: ${p}`,
    gebuehren: (g: string, e: string) => `Average fees: ${g} per month, net payouts ${e} per month`,
    kaeufe: (k: string, a: string) => `Purchases per year: ${k}, payouts per year: ${a}`,
    einsatz: (b: string) => `Capital you need to put up front (9 out of 10 years): up to ${b}`,
    netto: (m: string, se: string, p50: string) => `Net per month: mean ${m} ± ${se} (simulation noise), median ${p50}`,
    unklar: 'Unclear rule, second reading',
    variante: (text: string, netto: string, ausz: string) => `${text}: net ${netto} per month, first payout within 6 months ${ausz}`,
    hinweise: 'Notes',
    bots: 'Bots:',
    verboten: 'Prohibited:',
    offen: 'Unclear at the firm:',
    strenger: 'Calculated more strictly because not stated:',
    nichtRechenbar: 'Cannot be computed:',
    quellen: (stand: string) => `Sources (retrieved ${stand})`,
    weitereQuellen: (n: number) => `and ${n} more (see sources below)`,
  },

  hintergrund: {
    methodeTitel: 'How the calculator works',
    methodeLead: 'No oracle, just rules: day by day, trade by trade, with every fee.',
    methode: [
      [
        'For each account type, the calculator plays through many possible trading years. A year has about 260 trading days. How ' +
          'many trades fall on a given day is random, on average as many as you enter per week. Each trade wins with your win rate. ' +
          'Winners scatter around your average win, losers lose your average loss.',
      ],
      [
        "Day by day, the firm’s rules run alongside: drawdown (trailing at end of day, in real time, or static), daily loss limit " +
          '(soft or hard), consistency rules, profit target, minimum trading days, contract limits and scaling plan, inactivity, ' +
          'payout rules (winning days, buffer, caps, split, minimum amount, spacing) and all fees.',
      ],
      [
        'You get two views. ',
        { b: 'One purchase:' },
        ' how often you pass the evaluation, how often the first payout comes, how often the account is gone. ',
        { b: 'One account slot over twelve months:' },
        ' if an account is lost, you buy again or reset the evaluation where the firm offers that. That gives the net per month.',
      ],
      [
        { b: 'Zero edge:' },
        ' the same run with the same trades, except every result is shifted by your expectancy per trade. Shape and spread stay ' +
          'the same, the expectancy is zero. This shows what the rules and the spread alone deliver, without any edge. The calculation rules match ' +
          'a verified reference simulator; automated tests compare both on fixed trade streams.',
      ],
    ],
    annahmenTitel: 'Assumptions and limits',
    annahmen: [
      {
        titel: 'Trades and costs',
        punkte: [
          'Win and loss in R are net: fees and slippage are already included.',
          "For perp accounts (Vest, MyFundedPerps) you can add a 0.5 point spread, 10% annual funding and the firm’s commission. Price level 20,000 points.",
          'Path within a trade: losers run to the stop and were up to 0.5 R in profit before. Winners were up to 0.6 R in the red before and at times up to 25% above the final result. For real-time drawdowns the high counts first, then the low (cautious).',
          'Trades run one after another in the US session, always one position at a time. Holidays are not considered.',
          'Futures trade whole contracts (rounded down and capped by the contract limit and scaling plan), perps trade any size up to the leverage limit.',
        ],
      },
      {
        titel: 'Evaluation, payout, account slot',
        punkte: [
          'Once the profit target is reached, there is no more trading that day. Passed means: target, consistency and minimum days met. The funded account starts on the next trading day.',
          "The payout comes at the end of the first allowed day and leaves the account right away. Processing times and rejections at the firm’s discretion are not included.",
          'If an inactivity rule is about to hit, the calculator places a small trade for 3 USD.',
          'A later live account with real money is not simulated. The account slot ends there and is bought again. Taxes are not included.',
          'Subscription prices keep running until you pass. A month has 30.44 days.',
        ],
      },
      {
        titel: 'What is not modeled',
        punkte: [
          'News blackouts, trading hours, the maximum number of accounts per person and daily profit caps of individual programs.',
          'Bans such as microscalping, copy trading or “unrealistic position sizes”. They decide whether a strategy is allowed at the firm at all, so they are listed per account type under “Notes”.',
          'Special programs with their own logic (level systems, for example) are not calculated.',
          'Unclear rules are calculated in both readings. The ranking uses the less favorable one. Promo prices and limited-time promotions are not included.',
        ],
      },
    ],
    quellenTitel: 'Rules and sources',
    quellenLead: (stand: string) =>
      `Rules as of ${stand}. Rules change. Check the current terms directly with the firm before every purchase. ` +
      "The links go to the firms’ own pages and are not advertising or affiliate links.",
    quellenAnzahl: (n: number) => `${n} sources`,
    abgerufen: (d: string) => `retrieved ${d}`,
    rechtlich: [
      'Not financial advice and not investment advice. The calculator shows simulations under assumptions, not forecasts. ' +
        "Simulated results do not guarantee future results. Prop firm accounts are mostly simulated accounts; payouts depend on each firm’s terms and discretion.",
      'The order is not a recommendation of any firm. Firm names are trademarks of their owners. All calculations run in your ' +
        'browser; your inputs are not transmitted.',
    ],
  },

  daten: {
    variante: (s: string) => VARIANTEN_TEILE.reduce((t, [von, nach]) => t.replace(von, nach), s),
    regelVariante: (name: string, text: string) => REGEL_VARIANTEN[name] ?? text,
    aktion,
    quelleTitel: (q: Quellenzeile) => QUELLEN_TITEL[q.id] ?? q.titel,
    grund: (g: string) => GRUND[g] ?? 'special rules the calculator does not model',
    feld: (pfad: string) => {
      const t = feldText(pfad)
      return FELD[t] ?? t
    },
    bot: (code: string) => BOT[code] ?? code,
    ko: (code: string) => KO[code] ?? code,
    verbot: (code: string) => VERBOT[code] ?? code,
  },
}

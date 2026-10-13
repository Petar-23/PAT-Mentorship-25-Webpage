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
    kopfKnopf: 'AI Lab',
    kopfKnopfHref: 'https://petartrades.substack.com',
    kicker: 'Free tool · runs in your browser',
    titelDim: 'Prop firm calculator.',
    titel: 'Which firm fits your trades?',
    lead: (anzahl: number) =>
      `Say how much you want paid out by when, or enter your win rate and R:R. The calculator runs random trading years from ` +
      `these numbers against the rules of ${anzahl} account types, with every fee. A simulation, not market data.`,
  },

  modi: {
    aria: 'Calculation',
    rueck: 'What do I need?',
    rueckKurz: 'Payout goal → required win rate per account',
    vor: 'What do my numbers make?',
    vorKurz: 'Win rate and R:R → result per account',
    eingabe: 'Input',
    ergebnis: 'Result',
    warum: 'Why?',
  },

  rueck: {
    ziel: 'Paid out, net',
    zielHilfe: 'All payouts after the split minus all fees (purchases, subscriptions, resets, activation).',
    zeitraum: 'By when',
    monate: (m: number) => (m === 1 ? '1 month' : `${m} months`),
    monateChip: (m: number) => `${m} mo`,
    trades: 'Trades per week',
    sicherheit: 'How sure',
    sicherheitOption: (x: number) => `${x} in 10`,
    sicherheitHilfe: 'In how many of 10 simulated cases the goal should be reached.',
    soGerechnet: 'How this is calculated',
    soGerechnetText: (pfade: string) =>
      `One account slot, buying again after every lost account, payout path “Take and go”. Losers −1 R, winners +R:R R. ` +
      `MNQ with a 20 point stop, risk per trade as a share of the drawdown (2.5, 5, 7.5 or 10%); the share that reaches the goal ` +
      `most easily counts. ${pfade} simulated account slots per grid point, calculated in advance. Rules in their standard ` +
      'reading, only currently offered account types with a known price.',
    zielGrenze: (min: string, max: string) => `Goals from ${min} to ${max} are calculated in advance.`,
    laden: 'Loading table …',
    ladeFehler: 'The table could not be loaded. Please reload the page.',
    zusammenfassung: (name: string, p: string, crv: string, risiko: string) =>
      `Easiest: ${name} needs a ${p} win rate at R:R ${crv}, with ${risiko}.`,
    erwartung: (e: string, betrag: string, risiko: string) =>
      `That is ${e} per trade: in the long run each trade makes ${e} of your risk on average, so about ${betrag} at ${risiko} risk.`,
    keinKonto: 'Hardly reachable under these rules: no account type reaches this goal in this time with a win rate of 80% or less.',
    sortiert: 'Sorted by the easiest requirement, meaning the smallest expectancy per trade needed. Tap a card for details.',
    crv: (c: string) => `R:R ${c}`,
    kaum: 'hardly reachable',
    risikoKurz: (anteil: string, betrag: string) => `${betrag} · ${anteil} DD`,
    risikoSatz: (anteil: string, betrag: string) => `${betrag} risk per trade (${anteil} of the drawdown)`,
    leichteste: 'easiest',
    erwartungKurz: (e: string) => `expectancy ${e}`,
    mehr: (n: number) => `Show all ${n} account types`,
    weniger: 'Show fewer',
    detailsRechnen: 'Calculating the details …',
    detailsFuer: (crv: string, p: string, risiko: string) => `With R:R ${crv}, a ${p} win rate and ${risiko}:`,
    kurzBester: 'easiest',
    erreicht: (anteil: string, ziel: string, zeit: string) => `${anteil} of the simulated cases have at least ${ziel} net after ${zeit}.`,
    median: (betrag: string, zeit: string) => `Middle net result after ${zeit}: ${betrag}.`,
    vergleich: (betrag: string, zeit: string) =>
      `For comparison: a trader without an advantage (expectancy 0) would have ${betrag} net with this account after ${zeit}, ` +
      'in the middle case. That shows how much of the result comes from the rules alone.',
    regelnZeigen: 'Rules, costs and sources',
  },

  enden: {
    titel: 'Where it fails',
    unter: 'One purchase over 12 months, without buying again: how it ends or where it stands.',
    pruefung: 'in the evaluation',
    funded: 'in the funded account',
    name: {
      dd: 'Max drawdown',
      dll: 'Daily loss limit',
      zeitlimit: 'Time limit',
      inaktivitaet: 'Inactivity',
      offen_eval: 'Evaluation still open after 12 months',
      funded_laeuft: 'Funded account still running',
      weiter: 'Moved on as planned',
    },
    erklaerung: {
      dd: 'The balance fell further below its high (or start) than the drawdown allows. Then the account is gone.',
      dll: 'Lost more in one day than allowed. At this firm that costs the account.',
      zeitlimit: 'The profit target was not reached within the allowed days.',
      inaktivitaet: 'No trade for too long.',
      offen_eval: 'Neither passed nor blown: profit target, consistency or minimum days not met yet.',
      funded_laeuft: 'Passed and still active after 12 months.',
      weiter: 'Moved to a live account, reached the maximum number of payouts, or passed without a funded part.',
    },
    consHebt: (a: string) => `Consistency raised the evaluation target in ${a} of purchases: a single very good day may only make up part of the profit.`,
    consSperre: (a: string) => `Consistency held back a payout in ${a} of purchases.`,
    hauptgrund: (name: string, anteil: string) => `mostly: ${name} (${anteil})`,
    keinScheitern: 'rarely fails',
  },

  wz: {
    aria: 'Prop firm calculator, step by step',
    schritt: (i: number, n: number) => `Step ${i} of ${n}`,
    zurueck: 'Back',
    weiter: 'Next',
    ergebnisZeigen: 'Show result',
    neu: 'Start over',
    aendern: 'Change answers',
    wasHeisst: 'What does this mean?',
    kenneZahlen: 'I know my numbers',
    kenneZahlenKurz: 'Enter your win rate and R:R and see what they make at every account',
    vomZiel: 'Rather start from a goal',
    rechnet: (n: number) => `Running ${n} account types with your answers …`,
    rechnetZeilen: ['rules per firm', 'fees, resets and rebuys', 'required win rate per account'],
    fragen: {
      ziel: {
        frage: 'How much do you want paid out?',
        unter: 'Net, after all fees.',
        erklaerung:
          'This is the sum of all payouts after the firm’s split, minus everything you pay: purchase or subscription, resets, ' +
          'activation. If an account is lost, the calculator buys a new one, and that counts too.',
      },
      zeit: {
        frage: 'By when?',
        unter: 'Counted from the first purchase.',
        erklaerung:
          'The evaluation, the funded account and the payout rules take time: many firms only pay out after several winning ' +
          'days. Short time frames therefore demand much more.',
      },
      tpw: {
        frage: 'How often do you trade?',
        unter: 'Trades per week, on average.',
        erklaerung:
          'More trades get you to the goal faster, but also to the drawdown faster. The calculator spreads the trades ' +
          'randomly across the trading days.',
      },
      crv: {
        frage: 'What R:R do you trade?',
        unter: 'Distance to target divided by distance to stop.',
        erklaerung:
          'R:R 2 means: your target is twice as far away as your stop. A winner then makes 2 R, a loser costs 1 R, which is ' +
          'your risk. The higher the R:R, the less often you need to be right.',
      },
      sicher: {
        frage: 'How sure should it be?',
        unter: 'In how many of 10 simulated cases the goal should be reached.',
        erklaerung:
          '5 in 10 means: it works in half of the simulated cases and not in the other half. 9 in 10 is much more cautious ' +
          'and demands a higher win rate.',
      },
      treffer: {
        frage: 'How often are you right?',
        unter: 'Your win rate in percent.',
        erklaerung: 'The share of your trades that end in profit. Best taken from many real trades, not from a handful.',
      },
      risiko: {
        frage: 'How much do you risk per trade?',
        unter: 'In USD. That is 1 R.',
        erklaerung:
          'The amount you lose when the stop is hit. For futures the calculator turns it into whole contracts (MNQ with a ' +
          '20 point stop, adjustable in the result).',
      },
    },
    sicherHinweis: { '5': 'every other case', '7': 'cautious', '9': 'very cautious' } as Record<string, string>,
    proWoche: 'per week',
    crvSkizze: { stopp: 'Stop', ziel: 'Target', einstieg: 'Entry' },
    crvAnders: 'other value',
    regler: {
      tpw: 'Trades per week',
      crv: 'R:R',
      tpwText: (x: string) => `${x} ${x === '1' ? 'trade' : 'trades'} per week`,
      crvText: (x: string) => `R:R 1 to ${x}`,
      tippen: 'or type it',
    },
    ergebnisKicker: 'Your best account for these answers',
    braucht: 'needs',
    trefferquote: 'win rate',
    beiCrv: (c: string) => `at R:R ${c}`,
    antworten: (ziel: string, zeit: string, tpw: string, sicher: number) =>
      `${ziel} net in ${zeit} · ${tpw} ${tpw === '1' ? 'trade' : 'trades'} per week · ${sicher} in 10 cases`,
    weitere: 'More accounts',
    weitereUnter: 'Sorted by the win rate needed at your R:R. Tap for details.',
    andereCrv: 'At another R:R',
    keinKonto: (crv: string) =>
      `Hardly reachable at R:R ${crv}: no account type reaches this goal in this time with a win rate of 80% or less. ` +
      'Try a higher R:R, more time or a smaller goal.',
    vorKicker: 'What your numbers make',
    annahmen: 'Adjust assumptions',
  },

  app: {
    titel: 'Prop firm calculator',
    start: 'Price Action Trader, home page',
    soRechnet: 'How the calculator works',
    impressum: 'Legal notice',
    datenschutz: 'Privacy policy',
    cookies: 'Cookies',
    keineBeratung: 'Not financial advice',
    schliessen: 'Close',
    rechtliches: 'Legal and contact',
    punkte: 'Progress',
    punkt: (i: number, n: number) => `Step ${i} of ${n}`,
    groesse: {
      frage: 'How large may the account be?',
      unter: 'Optional. Larger accounts forgive more but cost more.',
      erklaerung:
        'This is the account size at the firm, for example 50K. Larger accounts have more drawdown and allow more risk per ' +
        'trade, but cost more. “All” includes every size.',
    },
    groessen: { alle: 'All', k50: 'up to 50K', k100: 'up to 100K', k150: 'up to 150K' } as Record<string, string>,
    fertigTitel: 'Your result is ready.',
    fertigUnter: 'Before you look: three ways to go from here. Your result is already unlocked.',
    ergebnisAnsehen: 'See result',
    rechnetVor: (n: string) => `Simulating ${n} years per account type …`,
    intro: (zeit: string, ziel: string, s: number) => `You want ${ziel} paid out within ${zeit}, in ${s} of 10 cases.`,
    muss: 'Then your strategy has to deliver this:',
    trefferMin: 'Win rate at least',
    beiCrv: (c: string) => `at R:R ${c}`,
    tradesProWoche: 'trades per week',
    tradeProWoche: 'trade per week',
    risikoJeTrade: 'Risk per trade',
    risikoAnteil: (a: string) => `${a} of the drawdown`,
    erwartung: (e: string) => `That is at least ${e} per trade after costs.`,
    leichtesten: 'You reach it most easily at',
    ddArt: {
      eod_trailing: 'only trailed at the end of the day',
      intraday_trailing: 'trailed in real time',
      statisch: 'static, not trailed',
      keiner: 'no drawdown limit',
    } as Record<string, string>,
    warum: (dd: string, art: string, preis: string) => `Why there: ${dd} drawdown, ${art}, for ${preis}.`,
    preisEinmalig: (b: string) => `${b} one-time`,
    preisMonatlich: (b: string) => `${b} per month until you pass`,
    darunter: (punkte: number, p: string, x: number) =>
      x === 0
        ? `If your win rate is ${punkte} points lower (${p}), you reach this goal at this account in none of 10 cases.`
        : `If your win rate is ${punkte} points lower (${p}), you reach this goal at this account in only ${x} of 10 cases.`,
    scheitert: (name: string, anteil: string) => `Where it mostly fails: ${name} (${anteil} of purchases).`,
    keinScheitern: 'Only a few purchases failed in the simulation.',
    andereKonten: 'See other accounts',
    andereTitel: 'Other accounts',
    neuRechnen: 'Start over',
    eigeneZahlen: 'My own numbers',
    keinKonto: (crv: string) =>
      `At R:R ${crv}, this goal is not reachable in this time at any matching account with a win rate of 80% or less. ` +
      'Try a higher R:R, more time, a larger account or a smaller goal.',
    vorIntro: (p: string, crv: string, risiko: string, tpw: string) =>
      `With a ${p} win rate at R:R ${crv}, ${risiko} risk per trade and ${tpw} ${tpw === '1' ? 'trade' : 'trades'} per week, you make the most at:`,
    proMonat: 'per month net',
    bei: 'at',
    nachGebuehren: 'After all fees, on average over 12 months, buying again after every lost account.',
    imPlus: (x: number) => `In ${x} of 10 simulated years you end up positive there.`,
    vorErwartung: (e: string) => `Your numbers give ${e} per trade after costs.`,
    vorMinus: 'No account ends up positive with these numbers. You lose the least at:',
    annahmen: 'Adjust assumptions',
    vomZiel: 'Start from a goal',
  },

  cta: {
    titel: 'What’s next',
    folgen: { titel: 'Follow me on X and YouTube', text: 'What I’m testing right now, what holds up and what doesn’t.', x: 'X', yt: 'YouTube' },
    lab: {
      titel: 'Join the AI Lab',
      text: 'My research newsletter on Substack: AI agents test strategies on data they have never seen.',
      knopf: 'Subscribe on Substack',
    },
    etoro: {
      titel: 'First month of mentorship free, sponsored by eToro',
      zusatz: 'German-language mentorship',
      bedingung: (min: string) =>
        `How it works: open an eToro account through my partner link and make a first deposit of at least ${min}. ` +
        'eToro will then automatically email you your code for the first month.',
      codeHilfe: (days: number) => `Only if your code has not arrived after ${days} days, email me at`,
      knopf: 'Open an eToro account',
      wie: 'All steps (German page)',
      anzeige: 'Ad',
      risikoTitel: 'Risk warning:',
    },
  },

  eingaben: {
    titel: 'Your inputs',
    trades: 'Your trades',
    trefferquote: 'Win rate',
    crv: 'R:R',
    crvHilfe: 'Reward-to-risk ratio: a winner makes R:R times your risk, a loser costs your risk (−1 R).',
    rHinweis: 'Wins and losses are net, after fees and slippage.',
    tradesProWoche: 'Trades per week',
    mehrEinstellungen: 'More settings',
    gewinner: 'Winners',
    streuung: { gleich: 'always +R:R', gemischt: 'mixed', wenige_grosse: 'few big ones' },
    streuungHilfe: 'Same average, different spread: “few big ones” means many small winners and the occasional outlier.',
    verlustStreuung: 'Losses vary (no fixed stop)',
    verlustStreuungHilfe: 'Losers cost your risk on average, sometimes less, now and then much more (about one in 10 above 1.8 R). Matters for daily loss limits.',
    groesse: 'Position size',
    risiko: 'Risk per trade',
    instrument: 'Instrument',
    stopp: 'Stop',
    punkte: 'points',
    stoppSatz:
      'The stop size only changes the result through the number of contracts (whole contracts, the firm’s contract limits) and perp costs. Wins and losses in R stay the same.',
    futuresHinweis: (k: number, instrument: string, echt: string, perp: string) =>
      `Futures: ${k} ${instrument} per trade (${echt} actual risk, whole contracts, capped by the firm’s limits). Perps: ${perp}.`,
    keinKontrakt: 'With this risk and stop, not even one contract fits. Futures accounts will not trade at all.',
    rahmen: 'Payout path and setup',
    weg: 'Payout path',
    polster: 'Cushion',
    polsterOptionen: { '1': '1x drawdown', '2': '2x drawdown' },
    bot: 'I trade with a bot (API)',
    botHilfe: 'Adds API fees and hides firms that don’t allow bots.',
    perp: 'Include extra perp costs',
    perpHilfe: 'Spread 0.5 points, funding 10% a year, the firm’s commission (Vest, MyFundedPerps).',
    genauigkeit: 'Precision',
    pfade: { '500': 'fast', '1500': 'precise', '3000': 'very precise' },
    pfadeHilfe: (n: string) => `${n} simulated years per account type.`,
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
      crv: 'R:R above 0 and at most 20',
      trades: 'Trades per week between 0.2 and 60',
      stopp: 'Stop between 1 and 500 points',
      risiko: 'Risk per trade between 1 and 100,000 USD',
    },
    berechnen: 'Recalculate',
    fortschritt: (a: string, b: string) => `Simulating ${a} of ${b} years …`,
    fertig: (pfade: string, varianten: number, sekunden: string) =>
      `${pfade} years × ${varianten} rule variants in ${sekunden} s, right in your browser.`,
    fehlerPrefix: 'Error:',
    workerAbbruch: 'The background calculation stopped.',
  },

  ergebnis: {
    groessen: { k10: 'up to 10K', k25: '20K to 25K', k50: '50K', k100: '100K', k150: '150K and up' },
    unter: (pfade: string, weg: string, faktor: number | null, bot: boolean) =>
      `${pfade} simulated years per account type, payout path “${weg}”${faktor ? ` with a ${faktor}x drawdown cushion` : ''}` +
      `${bot ? ', trading by bot' : ''}. Net per month means: all payouts after the split minus all fees (purchase, subscription, ` +
      'reset, activation, fixed costs) over twelve months, buying again after every lost account.',
    proMonatKurz: '/ month',
    zusammenfassung: (name: string, netto: string) => `Best account type: ${name} with ${netto} per month net.`,
    zusammenfassungMinus: (name: string, netto: string) =>
      `No account type ends up positive. You lose the least with ${name} (${netto} per month net).`,
    erwartungSatz: (e: string) => `Your numbers give ${e} per trade.`,
    rechnet: 'Calculating …',
    sicherTitel: 'How certain is your edge?',
    sicherText: (erw: string, sd: string) => `Your inputs give ${erw} per trade with a standard deviation of ${sd}.`,
    sicherBand: (lo: string, hi: string, n: string) =>
      ` Estimated from 100 trades, the true expectancy could be anywhere between ${lo} and ${hi}. Only from about ${n} trades is ` +
      'it above zero with 95% confidence.',
    sicherOhne: ' Without a positive expectancy, no profit comes from your trades. Across many accounts, the fees are lost.',
    schaetzung:
      'Your win rate and R:R are estimates themselves. If they come from a few trades or from a backtest picked for its ' +
      'result, part of it comes from the selection, not from a real edge. The calculator can only be as good as these numbers.',
    topTitel: 'The three best account types',
    topUnter:
      'Sorted by net per month, using the more cautious reading when a firm’s rule is unclear. The best value out of many account ' +
      'types is always estimated a little too high: the simulation has noise too (± figure).',
    platz: (i: number) => `Rank ${i}`,
    proMonatPlusMinus: (x: string) => `per month, ± ${x} USD`,
    bestehen60: 'Pass within 60 trading days',
    ohnePruefung: 'no evaluation',
    ausz6: 'First payout within 6 months',
    gesprengt12: 'Blown within 12 months',
    gerechnetMit: (v: string) => `Calculated with: ${v}.`,
    alleTitel: 'All account types',
    angezeigt: (a: number, b: number, bot: number) =>
      `${a} of ${b} account types selected${bot ? `, ${bot} hidden (firm does not allow bots)` : ''}. Tap a row for reasons, rules, costs and sources.`,
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
    vergleich: (betrag: string) =>
      `For comparison: a trader without an advantage (expectancy 0) would get ${betrag} per month net with this account. That shows how much of the result comes from the rules alone.`,
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
        { b: 'From your goal (default).' },
        ' Here the calculator works backwards, from a table computed in advance. The grid: goals from 500 to 50,000 USD net, ' +
          'periods of 1, 2, 3, 6 and 12 months, 1, 2, 3, 4, 5, 7, 10, 15 or 20 trades per week, R:R 1 : 1, 1 : 1.5, 1 : 2, ' +
          '1 : 2.5, 1 : 3 and 1 : 4 (the sliders snap to these values), risk per ' +
          'trade 2.5, 5, 7.5 or 10% of the drawdown and 29 win rates from 10 to 80% in steps of 2.5 points. Each grid point runs ' +
          '300 paths, all with the same random numbers: a higher win rate only turns losers into winners, everything else on ' +
          'each path stays the same. That keeps the win rates fairly comparable.',
      ],
      [
        'It models one account slot with rebuys: if an account is lost, a new one is bought. Payouts follow the “Take and go” ' +
          'path, so every possible payout is taken right away, in full. Net means: all payouts after the split minus all fees ' +
          'for purchases, subscriptions, resets and activation. For each risk level the calculator looks for the lowest win ' +
          'rate at which your goal is reached in X out of 10 paths, interpolated linearly between two grid points, and picks ' +
          'the risk level that needs the lowest win rate. If even 80% is not enough, the goal counts as hardly reachable. The ' +
          'win rate is rounded up to a whole percent so it is sure to be enough; “X in 10” is rounded down. The sentence ' +
          '“5 points lower” is recomputed live in your browser, with the same 300 paths.',
      ],
      [
        { b: 'With your own numbers.' },
        ' For each account type, the calculator generates 1,000 random trading years from your inputs, not from real market data. ' +
          'A year has about 260 trading days. How ' +
          'many trades fall on a given day is random, on average as many as you enter per week. Each trade wins with your win rate. ' +
          'A winner makes your R:R in R, a loser costs 1 R, which is your risk. Under “Adjust assumptions” winners and losses can vary.',
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
